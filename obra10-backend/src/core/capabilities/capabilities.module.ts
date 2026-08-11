import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CapabilitiesService } from './capabilities.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [CapabilitiesService],
  exports: [CapabilitiesService],
})
export class CapabilitiesModule {}
