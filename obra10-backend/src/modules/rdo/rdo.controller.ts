import { Controller, Get, Post, Put, Patch, Body, Param, Req, Res, Query, UseGuards } from '@nestjs/common';
import { RdoService } from './rdo.service';
import { PdfService } from './pdf.service';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ModuloGuard } from '../../core/guards/modulo.guard';
import { Modulo } from '../../core/decorators/modulo.decorator';

@Modulo('RDO')
@UseGuards(JwtAuthGuard, ObraContextGuard, ModuloGuard)
@Controller('rdos')
export class RdoController {
  constructor(
    private readonly rdoService: RdoService,
    private readonly pdfService: PdfService,
  ) {}

  // ── STATS (dashboard) — ANTES das rotas com :id para evitar conflito ──────────
  @Get('stats')
  async getStats(@Query() query: any, @Req() req: any) {
    return this.rdoService.getStats(query.obraId || req.headers['x-obra-id'], query.dataInicio, query.dataFim);
  }

  // ── PROFISSIONAIS RECENTES ────────────────────────────────────────────────────
  @Get('profissionais/recentes')
  async profissionaisRecentes(@Req() req: any) {
    return this.rdoService.getRecentProfissionais(req.headers['x-obra-id'], req.user.sub);
  }

  // ── SETUP ───────────────────────────────────────────────────────────────────
  @Get('setup')
  async getSetupInfo(@Req() req: any) {
    return this.rdoService.getSetupInfo(req.headers['x-obra-id']);
  }

  // ── LEITURA ──────────────────────────────────────────────────────────────────
  @Get()
  async listar(@Req() req: any) {
    return this.rdoService.findAllByObra(req.headers['x-obra-id']);
  }

  @Get(':id')
  async buscarUm(@Param('id') id: string, @Req() req: any) {
    return this.rdoService.findOne(id, req.headers['x-obra-id']);
  }

  // ── PDF DO RDO APROVADO ───────────────────────────────────────────────────────
  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const buffer = await this.pdfService.gerarPdfRdo(id, req.user.empresaId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="RDO_${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ── CRUD RDO BASE ─────────────────────────────────────────────────────────────
  @Post()
  async criar(@Body() body: any, @Req() req: any) {
    return this.rdoService.create(req.headers['x-obra-id'], req.user.sub, body);
  }

  // ── SALVAR RASCUNHO COMPLETO (DiarioDeObra) ───────────────────────────────────
  /** PUT /rdos/:id/rascunho — Persiste o JSON completo do formulário no campo dadosExtras. */
  @Put(':id/rascunho')
  async salvarRascunho(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.rdoService.saveRascunho(id, req.headers['x-obra-id'], body);
  }

  // ── REGISTROS FILHOS ──────────────────────────────────────────────────────────
  @Post(':id/atividades')
  async addAtividade(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.rdoService.addAtividade(id, req.headers['x-obra-id'], req.user.sub, body);
  }

  @Post(':id/efetivos')
  async addEfetivo(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.rdoService.addEfetivo(id, req.headers['x-obra-id'], req.user.sub, body);
  }

  @Post(':id/ocorrencias')
  async addOcorrencia(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.rdoService.addOcorrencia(id, req.headers['x-obra-id'], req.user.sub, body);
  }

  // ── TAREFAS COM MOTIVO DE NÃO EXECUÇÃO ───────────────────────────────────────
  @Post(':id/tarefas')
  async addTarefa(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.rdoService.addTarefa(id, req.headers['x-obra-id'], req.user.sub, body);
  }

  @Patch(':id/tarefas/:tarefaId')
  async updateTarefa(@Param('id') id: string, @Param('tarefaId') tarefaId: string, @Body() body: any, @Req() req: any) {
    return this.rdoService.updateTarefa(id, tarefaId, req.headers['x-obra-id'], body);
  }

  // ── MÁQUINA DE STATUS ────────────────────────────────────────────────────────
  @Put(':id/submeter')
  async submeter(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.rdoService.submeter(id, req.headers['x-obra-id'], req.obraRole, body?.aprovadorIdSelecionado);
  }

  @Put(':id/aprovar')
  async aprovar(@Param('id') id: string, @Req() req: any) {
    return this.rdoService.aprovar(id, req.headers['x-obra-id'], req.obraRole, req.user.sub);
  }

  @Put(':id/rejeitar')
  async rejeitar(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.rdoService.rejeitar(id, req.headers['x-obra-id'], req.obraRole, req.user.sub, body.motivo);
  }

  /** PUT /rdos/:id/revisar — Reabre um RDO rejeitado para reedição. */
  @Put(':id/revisar')
  async revisar(@Param('id') id: string, @Req() req: any) {
    return this.rdoService.revisar(id, req.headers['x-obra-id']);
  }
}
