import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { CronService } from './cron.service';

@Module({
  imports: [PrismaModule],
  controllers: [UploadController],
  providers: [CronService]
})
export class UploadModule {}
