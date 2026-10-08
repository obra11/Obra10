import { Module } from '@nestjs/common';
import { VisualizadorController } from './visualizador.controller';
import { VisualizadorService } from './visualizador.service';

@Module({
  controllers: [VisualizadorController],
  providers: [VisualizadorService],
})
export class VisualizadorModule {}
