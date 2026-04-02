import { Module } from '@nestjs/common';
import { ObraService } from './obra.service';
import { ObraController } from './obra.controller';

@Module({
  controllers: [ObraController],
  providers: [ObraService],
})
export class ObraModule {}
