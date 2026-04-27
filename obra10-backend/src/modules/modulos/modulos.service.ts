import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ModulosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the full module catalog with submodules and pricing.
   * Used by the admin panel and the contracting page.
   */
  async findAll() {
    const modulos = await (this.prisma as any).modulo.findMany({
      where: { ativo: true },
      orderBy: { ordemExibicao: 'asc' },
      include: {
        submodulos: {
          where: { ativo: true },
          select: { slug: true, nome: true, descricao: true },
          orderBy: { slug: 'asc' },
        },
      },
    });

    return modulos.map((m: any) => ({
      slug: m.slug,
      nome: m.nome,
      sigla: m.sigla,
      grupo: m.grupo,
      descricao: m.descricao,
      preco: Number(m.preco),
      versao: m.versao,
      dependencias: m.dependencias,
      ordemExibicao: m.ordemExibicao,
      submodulos: m.submodulos,
    }));
  }

  /**
   * Returns the catalog grouped by category. Useful for the contracting UI.
   */
  async findAllGrouped() {
    const modulos = await this.findAll();
    const groups: Record<string, typeof modulos> = {};
    for (const m of modulos) {
      if (!groups[m.grupo]) groups[m.grupo] = [];
      groups[m.grupo].push(m);
    }
    return groups;
  }

  /**
   * Returns active submodules of a parent module by slug.
   */
  async findSubmodulos(moduloSlug: string) {
    const modulo = await (this.prisma as any).modulo.findUnique({
      where: { slug: moduloSlug },
      include: {
        submodulos: {
          where: { ativo: true },
          orderBy: { slug: 'asc' },
        },
      },
    });

    if (!modulo) return null;
    return modulo.submodulos;
  }

  /**
   * Returns integration events that the module emits or consumes.
   */
  async findIntegracoes(moduloSlug: string) {
    const integracoes = await (this.prisma as any).integracaoModulo.findMany({
      where: {
        ativo: true,
        OR: [{ moduloOrigem: moduloSlug }, { moduloDestino: moduloSlug }],
      },
    });

    return {
      slug: moduloSlug,
      emite: integracoes.filter((i: any) => i.moduloOrigem === moduloSlug),
      consome: integracoes.filter((i: any) => i.moduloDestino === moduloSlug),
    };
  }
}
