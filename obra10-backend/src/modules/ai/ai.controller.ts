import { Controller, Post, Body, Param, Req, Headers, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

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
   * Body: { message: "pergunta", history: [] }
   * Header opcional: x-obra-id (obra ativa do canteiro)
   *
   * Responde a perguntas gerais do chatbot Luna com contexto rico do banco.
   */
  @Post('ai/chat')
  async chat(
    @Body() body: { message: string; history: Array<{ role: 'user' | 'assistant'; content: string }> },
    @Req() req: any,
    @Headers('x-obra-id') obraIdHeader?: string,
  ) {
    const empresaId = req.user.empresaId;
    const userId = req.user.sub || req.user.id;
    return this.aiService.chat(
      empresaId,
      userId,
      body.message,
      body.history || [],
      obraIdHeader || null,
    );
  }
}
