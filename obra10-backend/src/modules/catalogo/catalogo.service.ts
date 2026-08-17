import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { ImportInsumosDto } from './dto/import-insumos.dto';
import { TipoInsumo } from '@prisma/client';

const SEED_DEFAULT_ITEMS = [
  // MATERIAIS
  { tipo: TipoInsumo.MATERIAL, nome: 'Cimento CP II', unidade: 'kg', observacao: 'Saco 50kg' },
  { tipo: TipoInsumo.MATERIAL, nome: 'Areia Média', unidade: 'm³', observacao: 'Para alvenaria e reboco' },
  { tipo: TipoInsumo.MATERIAL, nome: 'Brita nº 1', unidade: 'm³', observacao: 'Para concreto' },
  { tipo: TipoInsumo.MATERIAL, nome: 'Tijolo Cerâmico 9x19x19', unidade: 'un', observacao: 'Bloco 6 furos' },
  { tipo: TipoInsumo.MATERIAL, nome: 'Aço CA-50 10mm (3/8")', unidade: 'kg', observacao: 'Vergalhão estrutural' },
  { tipo: TipoInsumo.MATERIAL, nome: 'Concreto Usinado FCK 30 MPa', unidade: 'm³', observacao: 'Bomba inclusa' },
  { tipo: TipoInsumo.MATERIAL, nome: 'Argamassa AC-II', unidade: 'kg', observacao: 'Saco 20kg' },
  { tipo: TipoInsumo.MATERIAL, nome: 'Tinta Acrílica Branca', unidade: 'l', observacao: 'Lata 18L' },
  { tipo: TipoInsumo.MATERIAL, nome: 'Tubo PVC 100mm Esgoto', unidade: 'm', observacao: 'Barra 6m' },
  { tipo: TipoInsumo.MATERIAL, nome: 'Fio Flexível 2,5mm²', unidade: 'm', observacao: 'Rolo 100m' },

  // EQUIPAMENTOS
  { tipo: TipoInsumo.EQUIPAMENTO, nome: 'Betoneira 400L', unidade: 'un', observacao: 'Operando' },
  { tipo: TipoInsumo.EQUIPAMENTO, nome: 'Andaime Tubular', unidade: 'un', observacao: 'Operando' },
  { tipo: TipoInsumo.EQUIPAMENTO, nome: 'Martelete Demolidor 15kg', unidade: 'un', observacao: 'Operando' },
  { tipo: TipoInsumo.EQUIPAMENTO, nome: 'Compactador de Solo (Sapo)', unidade: 'un', observacao: 'Operando' },
  { tipo: TipoInsumo.EQUIPAMENTO, nome: 'Serra Circular de Bancada', unidade: 'un', observacao: 'Operando' },
  { tipo: TipoInsumo.EQUIPAMENTO, nome: 'Gerador de Energia 10kVA', unidade: 'un', observacao: 'Operando' },
  { tipo: TipoInsumo.EQUIPAMENTO, nome: 'Poliguindaste / Caçamba', unidade: 'un', observacao: 'Operando' },
  { tipo: TipoInsumo.EQUIPAMENTO, nome: 'Retroescavadeira', unidade: 'un', observacao: 'Operando' },

  // MAO_DE_OBRA
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Pedreiro', unidade: 'un', observacao: 'Oficial' },
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Servente de Obras', unidade: 'un', observacao: 'Ajudante' },
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Mestre de Obras', unidade: 'un', observacao: 'Supervisão' },
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Armador / Ferreiro', unidade: 'un', observacao: 'Oficial' },
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Carpinteiro de Fôrmas', unidade: 'un', observacao: 'Oficial' },
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Pintor', unidade: 'un', observacao: 'Oficial' },
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Eletricista', unidade: 'un', observacao: 'Oficial' },
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Encanador / Hidráulico', unidade: 'un', observacao: 'Oficial' },
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Engenheiro Civil', unidade: 'un', observacao: 'Responsável técnico' },
  { tipo: TipoInsumo.MAO_DE_OBRA, nome: 'Técnico em Segurança do Trabalho', unidade: 'un', observacao: 'TST' },
];

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(empresaId: string, tipo?: TipoInsumo) {
    const totalCount = await this.prisma.catalogoInsumo.count({
      where: { empresaId, deletedAt: null },
    });

    // Se a empresa ainda não tiver nenhum item no catálogo, popula com os itens padrão iniciais
    if (totalCount === 0) {
      await this.prisma.catalogoInsumo.createMany({
        data: SEED_DEFAULT_ITEMS.map((item) => ({
          ...item,
          empresaId,
        })),
      });
    }

    return this.prisma.catalogoInsumo.findMany({
      where: {
        empresaId,
        deletedAt: null,
        ...(tipo ? { tipo } : {}),
      },
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    });
  }

  async findOne(id: string, empresaId: string) {
    const insumo = await this.prisma.catalogoInsumo.findFirst({
      where: { id, empresaId, deletedAt: null },
    });
    if (!insumo) {
      throw new NotFoundException('Item do catálogo não encontrado');
    }
    return insumo;
  }

  async create(empresaId: string, dto: CreateInsumoDto) {
    if (!empresaId) {
      throw new BadRequestException('Empresa não identificada na sessão.');
    }
    if (!dto.nome?.trim()) {
      throw new BadRequestException('Nome do item é obrigatório.');
    }
    try {
      return await this.prisma.catalogoInsumo.create({
        data: {
          empresaId,
          tipo: dto.tipo,
          nome: dto.nome.trim(),
          unidade: dto.unidade?.trim() || null,
          codigo: dto.codigo?.trim() || null,
          observacao: dto.observacao?.trim() || null,
        },
      });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('catalogo_insumos') || msg.includes('does not exist')) {
        throw new BadRequestException(
          'Tabela do Cadastro Base ainda não está disponível. Aguarde o próximo deploy ou contate o suporte.',
        );
      }
      throw err;
    }
  }

  async update(id: string, empresaId: string, dto: UpdateInsumoDto) {
    await this.findOne(id, empresaId);

    return this.prisma.catalogoInsumo.update({
      where: { id },
      data: {
        ...(dto.tipo ? { tipo: dto.tipo } : {}),
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.unidade !== undefined ? { unidade: dto.unidade.trim() || null } : {}),
        ...(dto.codigo !== undefined ? { codigo: dto.codigo.trim() || null } : {}),
        ...(dto.observacao !== undefined ? { observacao: dto.observacao.trim() || null } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
    });
  }

  async remove(id: string, empresaId: string) {
    await this.findOne(id, empresaId);

    return this.prisma.catalogoInsumo.update({
      where: { id },
      data: { deletedAt: new Date(), ativo: false },
    });
  }

  /**
   * Importação em lote do Cadastro Base (somente da empresa do usuário).
   * Match: codigo (se informado) → senão tipo+nome (case-insensitive).
   */
  async importar(empresaId: string, dto: ImportInsumosDto) {
    if (!empresaId) {
      throw new BadRequestException('Empresa não identificada.');
    }

    const atualizar = dto.atualizarExistentes !== false;
    const existentes = await this.prisma.catalogoInsumo.findMany({
      where: { empresaId, deletedAt: null },
      select: {
        id: true,
        tipo: true,
        nome: true,
        codigo: true,
        unidade: true,
        observacao: true,
      },
    });

    const byCodigo = new Map<string, (typeof existentes)[0]>();
    const byTipoNome = new Map<string, (typeof existentes)[0]>();
    for (const e of existentes) {
      if (e.codigo?.trim()) {
        byCodigo.set(e.codigo.trim().toLowerCase(), e);
      }
      byTipoNome.set(`${e.tipo}|${e.nome.trim().toLowerCase()}`, e);
    }

    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;
    const erros: Array<{ linha: number; mensagem: string }> = [];

    for (let i = 0; i < dto.itens.length; i++) {
      const raw = dto.itens[i];
      const linha = i + 1;
      const tipo = raw.tipo;
      const nome = (raw.nome || '').trim();
      if (!nome) {
        erros.push({ linha, mensagem: 'Nome obrigatório.' });
        continue;
      }
      if (!Object.values(TipoInsumo).includes(tipo)) {
        erros.push({ linha, mensagem: `Tipo inválido: ${tipo}` });
        continue;
      }

      const unidade = raw.unidade?.trim() || null;
      const codigo = raw.codigo?.trim() || null;
      const observacao = raw.observacao?.trim() || null;

      const match =
        (codigo ? byCodigo.get(codigo.toLowerCase()) : undefined) ||
        byTipoNome.get(`${tipo}|${nome.toLowerCase()}`);

      try {
        if (match) {
          if (!atualizar) {
            ignorados++;
            continue;
          }
          await this.prisma.catalogoInsumo.update({
            where: { id: match.id },
            data: {
              tipo,
              nome,
              unidade,
              codigo,
              observacao,
              ativo: true,
            },
          });
          atualizados++;
          // Atualiza índices locais
          if (match.codigo?.trim()) byCodigo.delete(match.codigo.trim().toLowerCase());
          byTipoNome.delete(`${match.tipo}|${match.nome.trim().toLowerCase()}`);
          const updated = { id: match.id, tipo, nome, codigo, unidade, observacao };
          if (codigo) byCodigo.set(codigo.toLowerCase(), updated);
          byTipoNome.set(`${tipo}|${nome.toLowerCase()}`, updated);
        } else {
          const created = await this.prisma.catalogoInsumo.create({
            data: {
              empresaId,
              tipo,
              nome,
              unidade,
              codigo,
              observacao,
            },
          });
          criados++;
          const entry = {
            id: created.id,
            tipo,
            nome,
            codigo,
            unidade,
            observacao,
          };
          if (codigo) byCodigo.set(codigo.toLowerCase(), entry);
          byTipoNome.set(`${tipo}|${nome.toLowerCase()}`, entry);
        }
      } catch (err: any) {
        erros.push({
          linha,
          mensagem: err?.message || 'Falha ao salvar item.',
        });
      }
    }

    return {
      totalRecebido: dto.itens.length,
      criados,
      atualizados,
      ignorados,
      erros,
    };
  }
}
