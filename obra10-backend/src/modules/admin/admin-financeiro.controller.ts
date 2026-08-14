import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { AdminFinanceiroService } from './admin-financeiro.service';
import {
  AtualizarDespesaFinanceiraDto,
  CriarDespesaFinanceiraDto,
} from './dto/admin.dto';

@Controller('admin/financeiro')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminFinanceiroController {
  constructor(private readonly financeiro: AdminFinanceiroService) {}

  @Get('resumo')
  resumo(@Query('inicio') inicio?: string, @Query('fim') fim?: string) {
    return this.financeiro.getResumo(inicio, fim);
  }

  @Get('recebimentos')
  recebimentos(
    @Query('status') status?: string,
    @Query('formaPagamento') formaPagamento?: string,
    @Query('empresaId') empresaId?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('periodoCampo') periodoCampo?: 'vencimento' | 'pagamento',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.financeiro.listarRecebimentos({
      status,
      formaPagamento,
      empresaId,
      inicio,
      fim,
      periodoCampo,
      page,
      pageSize,
    });
  }

  @Get('fluxo-caixa')
  fluxo(
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('granularidade') granularidade?: 'dia' | 'mes',
  ) {
    return this.financeiro.getFluxoCaixa(inicio, fim, granularidade || 'dia');
  }

  @Get('projecao')
  projecao(@Query('dias') dias?: string) {
    return this.financeiro.getProjecao(Number(dias || 90));
  }

  @Get('despesas')
  despesas(@Query('inicio') inicio?: string, @Query('fim') fim?: string) {
    return this.financeiro.listarDespesas(inicio, fim);
  }

  @Post('sincronizar-asaas')
  sincronizarAsaas() {
    return this.financeiro.sincronizarAsaas();
  }

  @Post('despesas')
  criarDespesa(@Body() dto: CriarDespesaFinanceiraDto, @Req() req: any) {
    return this.financeiro.criarDespesa(dto, req.user?.sub);
  }

  @Patch('despesas/:id')
  atualizarDespesa(
    @Param('id') id: string,
    @Body() dto: AtualizarDespesaFinanceiraDto,
  ) {
    return this.financeiro.atualizarDespesa(id, dto);
  }

  @Delete('despesas/:id')
  excluirDespesa(@Param('id') id: string) {
    return this.financeiro.excluirDespesa(id);
  }
}
