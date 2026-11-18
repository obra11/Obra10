import { Module } from '@nestjs/common';
import { EstoqueModule } from '../estoque/estoque.module';
import { RhController } from './rh.controller';
import { RhService } from './rh.service';

@Module({
  imports: [EstoqueModule],
  controllers: [RhController],
  providers: [RhService],
})
export class RhModule {}
