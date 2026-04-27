import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminMetricasService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics() {
    const agora = new Date();
    
    // Total numbers
    const totalEmpresas = await this.prisma.empresa.count({ where: { deletedAt: null } });
    const empresasAtivas = await this.prisma.empresa.count({ where: { deletedAt: null, ativo: true } });
    const totalUsuarios = await this.prisma.usuario.count({ where: { deletedAt: null } });
    const totalObras = await this.prisma.obra.count({ where: { deletedAt: null } });
    const totalRdos = await this.prisma.rdo.count();
    
    // Mes atual
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
    
    // Mes anterior
    const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0);
    
    const cobrancasMesAtualResult = await this.prisma.cobranca.aggregate({
      _sum: { valor: true },
      where: { status: 'PAGO', dataPagamento: { gte: inicioMesAtual } }
    });
    const receitaMensal = Number(cobrancasMesAtualResult._sum.valor || 0);

    const cobrancasMesAnteriorResult = await this.prisma.cobranca.aggregate({
      _sum: { valor: true },
      where: { status: 'PAGO', dataPagamento: { gte: inicioMesAnterior, lte: fimMesAnterior } }
    });
    const receitaMesAnterior = Number(cobrancasMesAnteriorResult._sum.valor || 0);

    let variacaoReceita = 0;
    if (receitaMesAnterior > 0) {
      variacaoReceita = ((receitaMensal - receitaMesAnterior) / receitaMesAnterior) * 100;
    }

    const ticketMedio = empresasAtivas > 0 ? receitaMensal / empresasAtivas : 0;

    // Receita por modulo
    const modulosDb = await this.prisma.modulo.findMany();
    const receitaPorModuloMap: Record<string, { nome: string; receita: number; totalEmpresas: number }> = {};
    for (const mod of modulosDb) {
      receitaPorModuloMap[mod.id] = { nome: mod.nome, receita: 0, totalEmpresas: 0 };
    }

    // Simplificando receita por modulo: estimativa na base do "preço atual" vezes ativas
    // Se cobramos separadamente, o correto é somar do registro, mas vamos pegar os modulos ativos
    const tenantModulos = await this.prisma.tenantModulo.groupBy({
      by: ['moduloId'],
      _count: true,
      where: { ativo: true },
    });
    
    const receitaPorModuloArr = tenantModulos.map(tm => {
      const mod = modulosDb.find(m => m.id === tm.moduloId);
      return {
        codigo: mod?.slug || 'DESC',
        nome: mod?.nome || 'Desconhecido',
        receita: Number(mod?.preco || 0) * tm._count, // Calculo estimado pelo preco de catalogo atual
        totalEmpresas: tm._count,
      };
    }).sort((a, b) => b.totalEmpresas - a.totalEmpresas);

    // Inadimplencia
    const inadimplencia = {
      vencidas5dias: 0,
      vencidas15dias: 0,
      vencidas30dias: 0,
      valorTotalInadimplente: 0
    };
    
    const cobrancasInadimplentes = await this.prisma.cobranca.findMany({
      where: { status: 'VENCIDO' }
    });
    
    for (const cob of cobrancasInadimplentes) {
      const msDiff = agora.getTime() - cob.dataVencimento.getTime();
      const diasAtraso = msDiff / (1000 * 60 * 60 * 24);
      
      if (diasAtraso >= 30) inadimplencia.vencidas30dias++;
      else if (diasAtraso >= 15) inadimplencia.vencidas15dias++;
      else if (diasAtraso >= 5) inadimplencia.vencidas5dias++;
      
      inadimplencia.valorTotalInadimplente += Number(cob.valor);
    }
    
    const cobrancasPendentes = await this.prisma.cobranca.count({
      where: { status: 'PENDENTE' }
    });

    // Engajamento - 7 dias
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const catorzeDiasAtras = new Date(agora.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const usuariosAtivos7dias = await this.prisma.usuario.count({
      where: { ultimoLogin: { gte: seteDiasAtras } }
    });
    
    const taxaAtivacao = totalUsuarios > 0 ? (usuariosAtivos7dias / totalUsuarios) * 100 : 0;
    
    const rdosSemana = await this.prisma.rdo.count({
      where: { createdAt: { gte: seteDiasAtras } }
    });
    
    const rdosSemanaAnterior = await this.prisma.rdo.count({
      where: { createdAt: { gte: catorzeDiasAtras, lt: seteDiasAtras } }
    });
    
    const mediaRdosPorObra = totalObras > 0 ? totalRdos / totalObras : 0;
    
    // Top obras por uso -> mapear para empresas
    const rdosPorObra = await this.prisma.rdo.groupBy({
      by: ['obraId'],
      _count: true,
      _max: { createdAt: true },
      orderBy: { _count: { obraId: 'desc' } },
      take: 20 // pegar mais para poder agrupar por empresa
    });
    
    // Buscar obras para descobrir a empresa
    const obrasDosRdos = await this.prisma.obra.findMany({
      where: { id: { in: rdosPorObra.map(r => r.obraId) } },
      select: { id: true, empresaId: true, empresa: { select: { nomeFantasia: true, razaoSocial: true } } }
    });
    
    // Agrupar por empresa no codigo
    const empresasMap: Record<string, { nome: string; totalRdos: number; ultimoRdo: Date | null }> = {};
    for (const r of rdosPorObra) {
      const obra = obrasDosRdos.find(o => o.id === r.obraId);
      if (!obra) continue;
      const empId = obra.empresaId;
      if (!empresasMap[empId]) {
        empresasMap[empId] = { 
          nome: obra.empresa.nomeFantasia || obra.empresa.razaoSocial || 'Desconhecida',
          totalRdos: 0,
          ultimoRdo: null
        };
      }
      empresasMap[empId].totalRdos += r._count;
      
      const rMax = r._max?.createdAt;
      if (rMax) {
        if (!empresasMap[empId].ultimoRdo || rMax > empresasMap[empId].ultimoRdo) {
           empresasMap[empId].ultimoRdo = rMax;
        }
      }
    }
    
    const topEmpresasUso = Object.values(empresasMap).sort((a, b) => b.totalRdos - a.totalRdos).slice(0, 5).map(e => ({
      nome: e.nome,
      totalRdos: e.totalRdos,
      ultimoRdo: e.ultimoRdo ? e.ultimoRdo.toISOString() : null
    }));

    // --- ALERTAS (Lógica Híbrida)
    const alertas: any[] = [];
    
    // ALERTA: Inadimplencia > 30d
    if (inadimplencia.vencidas30dias > 0) {
      alertas.push({
        tipo: 'INADIMPLENCIA',
        mensagem: `${inadimplencia.vencidas30dias} empresa(s) com cobranças vencidas há 30+ dias`,
        gravidade: 'ALTA'
      });
    }
    
    // ALERTA: Empresas inativas 30 dias
    const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Vamos pegar empresas ativas e ver o ultimo RDO
    // Buscar rdos recentes agrupados por obra
    const ultimosRdosObras = await this.prisma.rdo.groupBy({
      by: ['obraId'],
      _max: { createdAt: true },
    });
    
    const obrasComRdo = await this.prisma.obra.findMany({
      where: { id: { in: ultimosRdosObras.map(u => u.obraId) } },
      select: { id: true, empresaId: true }
    });
    
    // Mapear ultima atividade por empresa
    const lastRdoPorEmpresa: Record<string, Date> = {};
    for (const ur of ultimosRdosObras) {
      const obra = obrasComRdo.find(o => o.id === ur.obraId);
      if (obra && ur._max?.createdAt) {
        if (!lastRdoPorEmpresa[obra.empresaId] || ur._max.createdAt > lastRdoPorEmpresa[obra.empresaId]) {
          lastRdoPorEmpresa[obra.empresaId] = ur._max.createdAt;
        }
      }
    }
    
    let inativas30d = 0;
    const empresasFullAtivas = await this.prisma.empresa.findMany({
      where: { ativo: true, deletedAt: null },
      select: { id: true, nomeFantasia: true, razaoSocial: true, createdAt: true }
    });
    
    for (const emp of empresasFullAtivas) {
      if (emp.createdAt > catorzeDiasAtras) continue;
      
      const lastRdoDate = lastRdoPorEmpresa[emp.id];
      if (!lastRdoDate || lastRdoDate < trintaDiasAtras) {
        inativas30d++;
        if (inativas30d <= 2) {
           alertas.push({
             tipo: 'INATIVA_30D',
             mensagem: `${emp.nomeFantasia || emp.razaoSocial}: Risco de churning (sem RDO há +30d)`,
             empresaId: emp.id,
             gravidade: 'ALTA'
           });
        }
      }
    }
    
    // ALERTA: Módulos Expirando em <= 15 dias
    const daqui15Dias = new Date(agora.getTime() + 15 * 24 * 60 * 60 * 1000);
    const modulosExpirando = await this.prisma.tenantModulo.findMany({
      where: { 
        ativo: true, 
        expiresAt: { not: null, lte: daqui15Dias, gte: agora }
      },
      include: { empresa: { select: { razaoSocial: true, nomeFantasia: true, id: true } }, modulo: true }
    });
    
    for (const modExp of modulosExpirando) {
      alertas.push({
        tipo: 'MODULO_EXPIRANDO',
        mensagem: `${modExp.empresa.nomeFantasia || modExp.empresa.razaoSocial}: módulo ${modExp.modulo.nome} expira em breve`,
        empresaId: modExp.empresaId,
        gravidade: 'MEDIA'
      });
    }
    
    // ALERTA: Usuarios bloqueados (loginAttempts >= 10 ou lockedUntil exists)
    const usuariosBloqueadosCount = await this.prisma.usuario.count({
      where: { 
        OR: [
          { loginAttempts: { gte: 10 } },
          { lockedUntil: { gt: agora } },
          { ativo: false }
        ],
        deletedAt: null
      }
    });
    if (usuariosBloqueadosCount > 0) {
      alertas.push({
        tipo: 'USUARIO_BLOQUEADO',
        mensagem: `${usuariosBloqueadosCount} usuário(s) bloqueado(s) ou inativo(s)`,
        gravidade: 'MEDIA'
      });
    }
    
    // ALERTA: Cupom limite
    const cupons = await this.prisma.cupomDesconto.findMany({ where: { ativo: true } });
    for (const cp of cupons) {
      if (cp.usosMaximos && cp.usosMaximos > 0) {
        if (cp.usosAtuais >= cp.usosMaximos) {
          alertas.push({ tipo: 'CUPOM_LIMITE', mensagem: `Cupom ${cp.codigo} esgotado! (${cp.usosAtuais}/${cp.usosMaximos})`, gravidade: 'MEDIA' });
        } else if (cp.usosAtuais >= cp.usosMaximos * 0.9) {
          alertas.push({ tipo: 'CUPOM_LIMITE', mensagem: `Cupom ${cp.codigo} próximo do limite (${cp.usosAtuais}/${cp.usosMaximos})`, gravidade: 'BAIXA' });
        }
      }
    }
    
    const modulosMaisContratados = receitaPorModuloArr.slice(0, 5).map(m => ({
      codigo: m.codigo,
      nome: m.nome,
      total: m.totalEmpresas
    }));

    const empresasRecentes = await this.prisma.empresa.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        createdAt: true,
        ativo: true,
        plano: true,
      }
    });

    // Sort alertas (ALTA -> MEDIA -> BAIXA)
    const prio = { ALTA: 1, MEDIA: 2, BAIXA: 3 };
    alertas.sort((a, b) => prio[a.gravidade as keyof typeof prio] - prio[b.gravidade as keyof typeof prio]);

    return {
      totalEmpresas,
      empresasAtivas,
      totalUsuarios,
      totalObras,
      totalRdos,
      receitaMensal,
      modulosMaisContratados,
      empresasRecentes,
      cobrancasPendentes,
      
      receitaMesAnterior,
      variacaoReceita,
      ticketMedio,
      receitaPorModulo: receitaPorModuloArr,
      inadimplencia,
      
      usuariosAtivos7dias,
      taxaAtivacao,
      rdosSemana,
      rdosSemanaAnterior,
      mediaRdosPorObra,
      topEmpresasUso,
      
      alertas: alertas.slice(0, 10) // Retornar maximo de 10
    };
  }
}
