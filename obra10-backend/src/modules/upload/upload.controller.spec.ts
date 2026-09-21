import { Test, TestingModule } from '@nestjs/testing';
import { UploadController } from './upload.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

describe('UploadController', () => {
  let controller: UploadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        { provide: PrismaService, useValue: {} },
        { provide: CapabilitiesService, useValue: { hasCapability: async () => false } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UploadController>(UploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
