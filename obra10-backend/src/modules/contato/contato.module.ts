import { Module } from '@nestjs/common';
import { ContatoController } from './contato.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [ContatoController],
})
export class ContatoModule {}
