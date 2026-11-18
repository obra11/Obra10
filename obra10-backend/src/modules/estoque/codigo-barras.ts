import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type Db = Prisma.TransactionClient | PrismaService;

export async function gerarCodigoBarras(db: Db, empresaId: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const bytes = randomBytes(8);
    let codigo = 'O10';
    for (let b = 0; b < 8; b++) codigo += ALFABETO[bytes[b] % ALFABETO.length];
    const existe = await db.catalogoInsumo.findFirst({
      where: { empresaId, codigoBarras: codigo },
      select: { id: true },
    });
    if (!existe) return codigo;
  }
  throw new BadRequestException('Não foi possível gerar o código de barras.');
}

export async function garantirCodigosBarras(db: Db, empresaId: string) {
  const semCodigo = await db.catalogoInsumo.findMany({
    where: { empresaId, deletedAt: null, codigoBarras: null },
    select: { id: true },
  });
  for (const item of semCodigo) {
    await db.catalogoInsumo.update({
      where: { id: item.id },
      data: { codigoBarras: await gerarCodigoBarras(db, empresaId) },
    });
  }
}
