import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { RdoService } from './rdo.service';
import { PdfService } from './pdf.service';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ModuloGuard } from '../../core/guards/modulo.guard';
import { Modulo } from '../../core/decorators/modulo.decorator';
import {
  CreateRdoDto,
  SaveRascunhoDto,
  SubmeterRdoDto,
  ReprovarRdoDto,
} from './dto/rdo.dto';
import {
  AddAtividadeDto,
  AddEfetivoDto,
  AddOcorrenciaDto,
  AddTarefaDto,
  UpdateTarefaDto,
} from './dto/rdo-children.dto';

@Modulo('RDO')
@UseGuards(JwtAuthGuard, ObraContextGuard, ModuloGuard)
@Controller('rdos')
export class RdoController {
  constructor(
    private readonly rdoService: RdoService,
    private readonly pdfService: PdfService,
  ) {}

  private assertWritePermission(req: any) {
    const permRdo = req.obraRole?.permissoes?.RDO || req.obraRole?.permissoes?.rdo;
    if (
      permRdo === 'VIEW' ||
      permRdo === 'VIEW_APPROVED' ||
      permRdo === 'VIEW_PARTIAL_APPROVED'
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para realizar alterações no diário de obra.',
      );
    }
  }

  // ── STATS (dashboard) — ANTES das rotas com :id para evitar conflito ──────────
  @Get('stats')
  async getStats(@Query() query: any, @Req() req: any) {
    return this.rdoService.getStats(
      query.obraId || req.headers['x-obra-id'],
      query.dataInicio,
      query.dataFim,
      req.obraRole,
    );
  }

  // ── PROFISSIONAIS RECENTES ────────────────────────────────────────────────────
  @Get('profissionais/recentes')
  async profissionaisRecentes(@Req() req: any) {
    this.assertWritePermission(req);
    return this.rdoService.getRecentProfissionais(
      req.headers['x-obra-id'],
      req.user.sub,
    );
  }

  // ── SETUP ───────────────────────────────────────────────────────────────────
  @Get('setup')
  async getSetupInfo(@Req() req: any) {
    return this.rdoService.getSetupInfo(req.headers['x-obra-id']);
  }

  // ── LEITURA ──────────────────────────────────────────────────────────────────
  @Get()
  async listar(@Req() req: any) {
    return this.rdoService.findAllByObra(req.headers['x-obra-id'], req.obraRole);
  }

  // ── PDF DO RDO APROVADO ───────────────────────────────────────────────────────
  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: any,
    @Query('fotos') fotosParam?: string,
  ) {
    const incluirFotos = fotosParam === 'true' || fotosParam === '1';
    // Valida se o usuário tem acesso a este RDO baseado no status/permissões
    await this.rdoService.findOne(id, req.headers['x-obra-id'], req.obraRole);

    const buffer = await this.pdfService.gerarPdfRdo(id, req.user.empresaId, incluirFotos);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="RDO_${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id')
  async buscarUm(@Param('id') id: string, @Req() req: any) {
    return this.rdoService.findOne(id, req.headers['x-obra-id'], req.obraRole);
  }

  // ── CRUD RDO BASE ─────────────────────────────────────────────────────────────
  @Post()
  async criar(@Body() dto: CreateRdoDto, @Req() req: any) {
    this.assertWritePermission(req);
    return this.rdoService.create(req.headers['x-obra-id'], req.user.sub, dto);
  }

  // ── SALVAR RASCUNHO COMPLETO (DiarioDeObra) ───────────────────────────────────
  /** PUT /rdos/:id/rascunho — Persiste o JSON completo do formulário no campo dadosExtras. */
  @Put(':id/rascunho')
  async salvarRascunho(
    @Param('id') id: string,
    @Body() dto: SaveRascunhoDto,
    @Req() req: any,
  ) {
    this.assertWritePermission(req);
    return this.rdoService.saveRascunho(id, req.headers['x-obra-id'], dto, req.user);
  }

  // ── REGISTROS FILHOS ──────────────────────────────────────────────────────────
  @Post(':id/atividades')
  async addAtividade(
    @Param('id') id: string,
    @Body() dto: AddAtividadeDto,
    @Req() req: any,
  ) {
    this.assertWritePermission(req);
    return this.rdoService.addAtividade(
      id,
      req.headers['x-obra-id'],
      req.user.sub,
      dto,
    );
  }

  @Post(':id/efetivos')
  async addEfetivo(
    @Param('id') id: string,
    @Body() dto: AddEfetivoDto,
    @Req() req: any,
  ) {
    this.assertWritePermission(req);
    return this.rdoService.addEfetivo(
      id,
      req.headers['x-obra-id'],
      req.user.sub,
      dto,
    );
  }

  @Post(':id/ocorrencias')
  async addOcorrencia(
    @Param('id') id: string,
    @Body() dto: AddOcorrenciaDto,
    @Req() req: any,
  ) {
    this.assertWritePermission(req);
    return this.rdoService.addOcorrencia(
      id,
      req.headers['x-obra-id'],
      req.user.sub,
      dto,
    );
  }

  // ── TAREFAS COM MOTIVO DE NÃO EXECUÇÃO ───────────────────────────────────────
  @Post(':id/tarefas')
  async addTarefa(
    @Param('id') id: string,
    @Body() dto: AddTarefaDto,
    @Req() req: any,
  ) {
    this.assertWritePermission(req);
    return this.rdoService.addTarefa(
      id,
      req.headers['x-obra-id'],
      req.user.sub,
      dto,
    );
  }

  @Patch(':id/tarefas/:tarefaId')
  async updateTarefa(
    @Param('id') id: string,
    @Param('tarefaId') tarefaId: string,
    @Body() dto: UpdateTarefaDto,
    @Req() req: any,
  ) {
    this.assertWritePermission(req);
    return this.rdoService.updateTarefa(
      id,
      tarefaId,
      req.headers['x-obra-id'],
      dto,
    );
  }

  // ── MÁQUINA DE STATUS ────────────────────────────────────────────────────────
  @Put(':id/submeter')
  async submeter(
    @Param('id') id: string,
    @Body() dto: SubmeterRdoDto,
    @Req() req: any,
  ) {
    this.assertWritePermission(req);
    return this.rdoService.submeter(
      id,
      req.headers['x-obra-id'],
      req.obraRole,
      dto?.aprovadorIdSelecionado,
    );
  }

  @Put(':id/aprovar')
  async aprovar(@Param('id') id: string, @Req() req: any) {
    this.assertWritePermission(req);
    return this.rdoService.aprovar(
      id,
      req.headers['x-obra-id'],
      req.obraRole,
      req.user.sub,
    );
  }

  @Put(':id/rejeitar')
  async rejeitar(
    @Param('id') id: string,
    @Body() dto: ReprovarRdoDto,
    @Req() req: any,
  ) {
    this.assertWritePermission(req);
    return this.rdoService.rejeitar(
      id,
      req.headers['x-obra-id'],
      req.obraRole,
      req.user.sub,
      dto.motivo,
    );
  }

  /** PUT /rdos/:id/revisar — Reabre um RDO rejeitado para reedição. */
  @Put(':id/revisar')
  async revisar(@Param('id') id: string, @Req() req: any) {
    this.assertWritePermission(req);
    return this.rdoService.revisar(id, req.headers['x-obra-id']);
  }

  /** PUT /rdos/:id/reabrir — Reabre um RDO aprovado ou submetido (somente gestor/admin). */
  @Put(':id/reabrir')
  @UseGuards(JwtAuthGuard)
  async reabrir(@Param('id') id: string, @Req() req: any) {
    this.assertWritePermission(req);
    return this.rdoService.reabrir(id, req.user.empresaId, req.user);
  }

  /** DELETE /rdos/:id — Exclui um RDO. */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    this.assertWritePermission(req);
    return this.rdoService.remove(id, req.headers['x-obra-id']);
  }
}
