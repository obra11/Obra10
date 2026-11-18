import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ModuloGuard } from '../../core/guards/modulo.guard';
import { Modulo } from '../../core/decorators/modulo.decorator';
import { EstoqueService } from './estoque.service';

@Controller('estoque')
@Modulo('MATERIAIS')
@UseGuards(JwtAuthGuard, ModuloGuard)
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  private empresaId(req: any): string {
    return req.user.empresaId || req.user.empresa_id;
  }

  private userId(req: any): string {
    return req.user.sub || req.user.id;
  }

  @Get('locais')
  locais(@Req() req: any, @Query('obraId') obraId?: string) {
    return this.estoque.listarLocais(this.empresaId(req), this.userId(req), obraId);
  }

  @Get('obras')
  obras(@Req() req: any) {
    return this.estoque.listarObras(this.empresaId(req));
  }

  @Get('recebedores')
  recebedores(@Req() req: any) {
    return this.estoque.listarRecebedores(this.empresaId(req));
  }

  @Get('saldos')
  saldos(@Req() req: any, @Query('localId') localId: string) {
    return this.estoque.listarSaldos(this.empresaId(req), this.userId(req), localId);
  }

  @Get('relatorio/pdf')
  async relatorioPdf(
    @Req() req: any,
    @Res() res: any,
    @Query('localId') localId?: string,
    @Query('movimento') movimento?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('retiradoPor') retiradoPor?: string,
    @Query('fornecedor') fornecedor?: string,
    @Query('insumoId') insumoId?: string,
    @Query('tipoInsumo') tipoInsumo?: string,
    @Query('categoria') categoria?: string,
  ) {
    try {
      const buffer = await this.estoque.relatorioPdf(this.empresaId(req), this.userId(req), {
        localId,
        movimento,
        de,
        ate,
        retiradoPor,
        fornecedor,
        insumoId,
        tipoInsumo,
        categoria,
      });
      const nome = `relatorio-estoque${de ? `-${de}` : ''}${ate ? `-a-${ate}` : ''}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (err: any) {
      if (res.headersSent) return;
      const status = typeof err?.getStatus === 'function' ? err.getStatus() : 500;
      const corpo = typeof err?.getResponse === 'function' ? err.getResponse() : null;
      const message =
        typeof corpo === 'string'
          ? corpo
          : corpo?.message || err?.message || 'Não foi possível gerar o PDF.';
      res.status(status).json({ message });
    }
  }

  @Get('relatorio')
  relatorio(
    @Req() req: any,
    @Query('localId') localId?: string,
    @Query('movimento') movimento?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('retiradoPor') retiradoPor?: string,
    @Query('fornecedor') fornecedor?: string,
    @Query('insumoId') insumoId?: string,
    @Query('tipoInsumo') tipoInsumo?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.estoque.relatorio(this.empresaId(req), this.userId(req), {
      localId,
      movimento,
      de,
      ate,
      retiradoPor,
      fornecedor,
      insumoId,
      tipoInsumo,
      categoria,
    });
  }

  @Get('insumos/por-codigo')
  porCodigo(
    @Req() req: any,
    @Query('codigo') codigo: string,
    @Query('localId') localId: string,
  ) {
    return this.estoque.porCodigo(this.empresaId(req), this.userId(req), codigo, localId);
  }

  @Get('insumos/:id/etiqueta')
  etiqueta(@Req() req: any, @Param('id') id: string) {
    return this.estoque.etiqueta(this.empresaId(req), id);
  }

  @Get('movimentos')
  movimentos(@Req() req: any, @Query('localId') localId?: string) {
    return this.estoque.listarMovimentos(this.empresaId(req), this.userId(req), localId);
  }

  @Get('entradas')
  entradas(
    @Req() req: any,
    @Query('localId') localId?: string,
    @Query('obraId') obraId?: string,
  ) {
    return this.estoque.listarEntradas(this.empresaId(req), this.userId(req), {
      localId,
      obraId,
    });
  }

  @Get('entradas/:id')
  entrada(@Req() req: any, @Param('id') id: string) {
    return this.estoque.obterEntrada(this.empresaId(req), this.userId(req), id);
  }

  @Post('entradas')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  criarEntrada(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { localId?: string; tipo?: string; recebedorId?: string; obraId?: string },
  ) {
    return this.estoque.criarEntrada(this.empresaId(req), this.userId(req), file, body);
  }

  @Post('entradas/manual')
  criarEntradaManual(@Req() req: any, @Body() body: any) {
    return this.estoque.criarEntradaManual(this.empresaId(req), this.userId(req), body);
  }

  @Post('entradas/:id/ler')
  ler(@Req() req: any, @Param('id') id: string, @Body() body: { tipoInsumo?: string }) {
    return this.estoque.lerArquivo(this.empresaId(req), this.userId(req), id, body?.tipoInsumo);
  }

  @Post('entradas/:id/itens')
  adicionarItem(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.estoque.adicionarItem(this.empresaId(req), this.userId(req), id, body);
  }

  @Put('entradas/:id/itens/:itemId')
  resolverItem(
    @Req() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: any,
  ) {
    return this.estoque.resolverItem(this.empresaId(req), this.userId(req), id, itemId, body);
  }

  @Post('entradas/:id/aceitar-sugestoes')
  aceitar(@Req() req: any, @Param('id') id: string) {
    return this.estoque.aceitarSugestoes(this.empresaId(req), this.userId(req), id);
  }

  @Put('entradas/:id')
  cabecalho(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.estoque.atualizarCabecalho(this.empresaId(req), this.userId(req), id, body);
  }

  @Post('entradas/:id/confirmar')
  confirmar(@Req() req: any, @Param('id') id: string) {
    return this.estoque.confirmar(this.empresaId(req), this.userId(req), id);
  }

  @Post('entradas/:id/rejeitar')
  rejeitar(@Req() req: any, @Param('id') id: string, @Body() body: { motivo?: string }) {
    return this.estoque.rejeitar(this.empresaId(req), this.userId(req), id, body?.motivo);
  }

  @Post('entradas/:id/estornar')
  estornar(@Req() req: any, @Param('id') id: string) {
    return this.estoque.estornar(this.empresaId(req), this.userId(req), id);
  }

  @Post('saidas')
  saida(@Req() req: any, @Body() body: any) {
    return this.estoque.saida(this.empresaId(req), this.userId(req), body);
  }

  @Post('transferencias')
  transferir(@Req() req: any, @Body() body: any) {
    return this.estoque.transferir(this.empresaId(req), this.userId(req), body);
  }
}
