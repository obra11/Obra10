import { Controller, Post, Body, Param, Req, Res, Headers, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { LunaAgentService } from './luna-agent.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly luna: LunaAgentService,
  ) {}

  /**
   * POST /obras/:obraId/relatorio-ia
   * Body: { dataInicio: "YYYY-MM-DD", dataFim: "YYYY-MM-DD" }
   *
   * Consolida todos os RDOs APROVADOS do período e gera insights estruturados.
   * Cache: 24h. Rate limit: 3x/dia por obra.
   */
  @UseGuards(ObraContextGuard)
  @Post('obras/:obraId/relatorio-ia')
  async gerarRelatorio(
    @Param('obraId') obraId: string,
    @Body() body: { dataInicio: string; dataFim: string; foco?: string; secoes?: string[] },
    @Req() req: any,
  ) {
    const empresaId = req.user.empresaId;
    return this.aiService.gerarRelatorioObra(
      obraId,
      empresaId,
      body.dataInicio,
      body.dataFim,
      body.foco,
      body.secoes,
    );
  }

  /**
   * POST /obras/:obraId/relatorio-ia/perguntar
   * Body: { dataInicio: "YYYY-MM-DD", dataFim: "YYYY-MM-DD", pergunta: "pergunta" }
   *
   * Responde a uma pergunta interativa do usuário baseando-se nos RDOs do período.
   */
  @UseGuards(ObraContextGuard)
  @Post('obras/:obraId/relatorio-ia/perguntar')
  async perguntarRelatorio(
    @Param('obraId') obraId: string,
    @Body() body: { dataInicio: string; dataFim: string; pergunta: string },
    @Req() req: any,
  ) {
    const empresaId = req.user.empresaId;
    return this.aiService.perguntarRelatorioObra(
      obraId,
      empresaId,
      body.dataInicio,
      body.dataFim,
      body.pergunta,
    );
  }

  /**
   * POST /ai/chat
   * Body: { message, history }
   * Header opcional: x-obra-id (contexto da tela, não limita a busca)
   */
  @Post('ai/chat')
  async chat(
    @Body() body: { message: string; history: Array<{ role: 'user' | 'assistant'; content: string }> },
    @Req() req: any,
    @Headers('x-obra-id') obraIdHeader?: string,
  ) {
    const reply = await this.luna.chat(
      {
        userId: req.user.sub || req.user.id,
        empresaId: req.user.empresaId,
        perfilGlobal: req.user.perfilGlobal,
      },
      body.message,
      body.history || [],
      obraIdHeader || null,
    );
    return { reply };
  }

  /** POST /ai/chat/stream — SSE (delta/done) para o widget da Luna. */
  @Post('ai/chat/stream')
  async chatStream(
    @Body() body: { message: string; history: Array<{ role: 'user' | 'assistant'; content: string }> },
    @Req() req: any,
    @Res() res: Response,
    @Headers('x-obra-id') obraIdHeader?: string,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const auth = {
      userId: req.user.sub || req.user.id,
      empresaId: req.user.empresaId,
      perfilGlobal: req.user.perfilGlobal,
    };

    try {
      for await (const ev of this.luna.stream(
        auth,
        body.message,
        body.history || [],
        obraIdHeader || null,
      )) {
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
      }
    } catch (err: any) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          reply:
            err?.message ||
            'Não consegui responder agora. Tente novamente em instantes.',
        })}\n\n`,
      );
    }
    res.end();
  }
}
