import { Module } from '@nestjs/common';
import { ObraService } from './obra.service';
import { ObraController } from './obra.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [ObraController],
  providers: [ObraService],
})
export class ObraModule {}
