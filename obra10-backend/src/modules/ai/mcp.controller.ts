import {
  Controller,
  Get,
  Post,
  Delete,
  Options,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { LunaToolsService, LUNA_TOOL_DEFS } from './luna-tools.service';

export const MCP_PROTOCOL = '2025-03-26';
export const MCP_SERVER_INFO = { name: 'obra10', version: '2.9.25' };
export const MCP_INSTRUCTIONS = `Obra 10 MCP: leitura da empresa do token JWT (nunca de outra construtora).
Use listar_obras, painel_obra/ver_obra, listar_relatorios, ver_rdo, agregar_diarios (clima/efetivo/atividades), listar_catalogo, listar_equipe, listar_efetivo_obra, listar_alertas, ver_plano e ajuda_obra10.
Sem escrita. Sem perguntar_luna. Dúvida de uso do sistema → ajuda_obra10.`;

function applyMcpHeaders(res: Response, sessionId?: string) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('MCP-Protocol-Version', MCP_PROTOCOL);
  if (sessionId) res.setHeader('Mcp-Session-Id', sessionId);
}

function sessionFrom(req: Request): string {
  const raw = req.headers['mcp-session-id'];
  const existing = Array.isArray(raw) ? raw[0] : raw;
  return existing || randomUUID();
}

/**
 * MCP Streamable HTTP (JSON-RPC) — ChatGPT / Claude / Gemini.
 * POST https://obra10.app.br/mcp
 * Header: Authorization: Bearer <token de POST /auth/token>
 */
@UseGuards(JwtAuthGuard)
@Controller('mcp')
export class McpController {
  constructor(private readonly tools: LunaToolsService) {}

  @Options()
  @HttpCode(204)
  options(@Res() res: Response) {
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
    );
    return res.status(204).end();
  }

  @Get()
  getInfo(@Req() req: Request, @Res() res: Response) {
    const sessionId = sessionFrom(req);
    applyMcpHeaders(res, sessionId);
    const accept = String(req.headers.accept || '');
    if (accept.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      res.write(': connected\n\n');
      const ping = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clearInterval(ping);
        }
      }, 25000);
      req.on('close', () => clearInterval(ping));
      return;
    }
    return res.json({
      protocolVersion: MCP_PROTOCOL,
      serverInfo: MCP_SERVER_INFO,
      transport: 'streamable-http',
      instructions: MCP_INSTRUCTIONS,
    });
  }

  @Delete()
  @HttpCode(204)
  endSession(@Res() res: Response) {
    return res.status(204).end();
  }

  @Post()
  async handle(@Req() req: Request, @Res() res: Response) {
    const sessionId = sessionFrom(req);
    applyMcpHeaders(res, sessionId);

    const body = (req as any).body;
    const auth = {
      userId: (req as any).user?.sub,
      empresaId: (req as any).user?.empresaId,
      perfilGlobal: (req as any).user?.perfilGlobal,
    };

    if (Array.isArray(body)) {
      const results: any[] = [];
      for (const item of body) {
        const r = await this.dispatch(item, auth);
        if (r) results.push(r);
      }
      return res.json(results);
    }

    const result = await this.dispatch(body, auth);
    if (result === null) {
      return res.status(202).end();
    }
    return res.json(result);
  }

  private async dispatch(
    rpc: any,
    auth: { userId: string; empresaId: string; perfilGlobal?: string },
  ) {
    if (!rpc || rpc.jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id: rpc?.id ?? null,
        error: { code: -32600, message: 'JSON-RPC 2.0 inválido' },
      };
    }

    const { id, method, params } = rpc;
    if (id === undefined || id === null) {
      return null; // notification
    }

    try {
      if (method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: MCP_PROTOCOL,
            capabilities: {
              tools: { listChanged: false },
              resources: { listChanged: false },
              prompts: { listChanged: false },
            },
            serverInfo: MCP_SERVER_INFO,
            instructions: MCP_INSTRUCTIONS,
          },
        };
      }
      if (method === 'ping' || method === 'notifications/initialized') {
        return { jsonrpc: '2.0', id, result: {} };
      }
      if (method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: LUNA_TOOL_DEFS.filter((t) => t.name !== 'perguntar_luna').map(
              (t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
              }),
            ),
          },
        };
      }
      if (method === 'tools/call') {
        const name = String(params?.name || '');
        if (!name || name === 'perguntar_luna') {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Ferramenta indisponível no MCP.',
            },
          };
        }
        const args = params?.arguments || {};
        const text = await this.tools.execute(name, args, auth);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text }],
            isError: false,
          },
        };
      }
      if (method === 'resources/list') {
        return { jsonrpc: '2.0', id, result: { resources: [] } };
      }
      if (method === 'prompts/list') {
        return { jsonrpc: '2.0', id, result: { prompts: [] } };
      }
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Método não suportado: ${method}` },
      };
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: err?.message || 'Erro interno' },
      };
    }
  }
}
