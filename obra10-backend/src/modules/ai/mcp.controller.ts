import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { LunaToolsService, LUNA_TOOL_DEFS } from './luna-tools.service';

const PROTOCOL = '2025-03-26';
const SERVER_INFO = { name: 'obra10', version: '2.9.24' };

/**
 * MCP Streamable HTTP (JSON-RPC) — ChatGPT / Claude / Gemini.
 * POST https://obra10.app.br/mcp
 * Header: Authorization: Bearer <token de POST /auth/token>
 */
@UseGuards(JwtAuthGuard)
@Controller('mcp')
export class McpController {
  constructor(private readonly tools: LunaToolsService) {}

  @Get()
  @HttpCode(405)
  getInfo(@Res() res: Response) {
    res.setHeader('Allow', 'POST');
    return res.json({
      error: 'Use POST JSON-RPC neste endpoint (Streamable HTTP).',
      protocolVersion: PROTOCOL,
      serverInfo: SERVER_INFO,
    });
  }

  @Post()
  async handle(@Req() req: Request, @Res() res: Response) {
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

  private async dispatch(rpc: any, auth: { userId: string; empresaId: string; perfilGlobal?: string }) {
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
            protocolVersion: PROTOCOL,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
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
            tools: LUNA_TOOL_DEFS.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
        };
      }
      if (method === 'tools/call') {
        const name = params?.name;
        const args = params?.arguments || {};
        const text = await this.tools.execute(name, args, auth);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text }],
          },
        };
      }
      if (method === 'resources/list' || method === 'prompts/list') {
        return { jsonrpc: '2.0', id, result: { resources: [], prompts: [] } };
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
