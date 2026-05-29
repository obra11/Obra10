import { Controller, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';

@UseGuards(JwtAuthGuard, ObraContextGuard)
@Controller('obras/:obraId')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /obras/:obraId/relatorio-ia
   * Body: { dataInicio: "YYYY-MM-DD", dataFim: "YYYY-MM-DD" }
   *
   * Consolida todos os RDOs APROVADOS do período e gera insights estruturados.
   * Cache: 24h. Rate limit: 3x/dia por obra.
   */
  @Post('relatorio-ia')
  async gerarRelatorio(
    @Param('obraId') obraId: string,
    @Body() body: { dataInicio: string; dataFim: string },
    @Req() req: any,
  ) {
    const empresaId = req.user.empresaId;
    return this.aiService.gerarRelatorioObra(
      obraId,
      empresaId,
      body.dataInicio,
      body.dataFim,
    );
  }

  /**
   * POST /obras/:obraId/relatorio-ia/perguntar
   * Body: { dataInicio: "YYYY-MM-DD", dataFim: "YYYY-MM-DD", pergunta: "pergunta" }
   *
   * Responde a uma pergunta interativa do usuário baseando-se nos RDOs aprovados do período.
   */
  @Post('relatorio-ia/perguntar')
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
}
