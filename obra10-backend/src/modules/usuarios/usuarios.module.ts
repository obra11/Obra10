import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [UsuariosService],
  controllers: [UsuariosController],
  exports: [UsuariosService],
})
export class UsuariosModule {}
