import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { McpController } from './mcp.controller';
import { LunaToolsService } from './luna-tools.service';
import { LunaAgentService } from './luna-agent.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RdoModule } from '../rdo/rdo.module';
import { ObraModule } from '../obra/obra.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { LunaAcoesService } from './luna-acoes.service';

@Module({
  imports: [PrismaModule, ScheduleModule, RdoModule, ObraModule, CatalogoModule, UsuariosModule],
  providers: [AiService, LunaToolsService, LunaAgentService, LunaAcoesService],
  controllers: [AiController, McpController],
})
export class AiModule {}
