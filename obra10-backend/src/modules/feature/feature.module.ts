import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeatureService } from './feature.service';
import { FeatureController } from './feature.controller';
import { AdminFeaturesController } from './admin-features.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FeatureController, AdminFeaturesController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
