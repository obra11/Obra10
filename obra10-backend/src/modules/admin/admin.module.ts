import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CryptoModule } from '../../core/services/crypto.module';
import { AdminEmpresasController } from './admin-empresas.controller';
import { AdminUsuariosController, AdminUsuariosEmpresaController } from './admin-usuarios.controller';
import { AdminCuponsController } from './admin-cupons.controller';
import { AdminMetricasController } from './admin-metricas.controller';
import { AdminModulosController } from './admin-modulos.controller';
import { AdminMetricasService } from './admin-metricas.service';

@Module({
  imports: [PrismaModule, CryptoModule],
  controllers: [
    AdminEmpresasController,
    AdminUsuariosController,
    AdminUsuariosEmpresaController,
    AdminCuponsController,
    AdminMetricasController,
    AdminModulosController,
  ],
  providers: [AdminMetricasService],
})
export class AdminModule {}
