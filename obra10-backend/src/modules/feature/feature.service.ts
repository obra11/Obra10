import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeatureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica se uma feature está disponível para uma empresa.
   * Lógica de 3 níveis:
   * 1. Flag global ON → disponível para todos
   * 2. Flag global OFF + EmpresaFeature ativo → apenas essa empresa
   * 3. Flag global OFF + sem EmpresaFeature → indisponível
   */
  async isEnabled(codigo: string, empresaId: string): Promise<boolean> {
    const feature = await this.prisma.featureFlag.findUnique({
      where: { codigo },
      include: {
        empresas: { where: { empresaId, ativo: true } }
      }
    });

    if (!feature) return false;
    if (feature.ativo) return true;
    return feature.empresas.length > 0;
  }

  /**
   * Retorna todos os códigos de features ativas para uma empresa.
   * Usado pelo frontend via GET /features/minhas.
   */
  async getEmpresaFeatures(empresaId: string): Promise<string[]> {
    const features = await this.prisma.featureFlag.findMany({
      where: {
        OR: [
          { ativo: true },
          { empresas: { some: { empresaId, ativo: true } } }
        ]
      }
    });
    return features.map(f => f.codigo);
  }

  /** Lista todas as features com contagem de empresas ativas (admin). */
  async listAll() {
    return this.prisma.featureFlag.findMany({
      include: {
        _count: { select: { empresas: true } },
        empresas: {
          where: { ativo: true },
          include: {
            empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
