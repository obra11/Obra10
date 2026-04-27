import { Controller, Get, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { AdminMetricasService } from './admin-metricas.service';

@Controller('admin/metricas')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminMetricasController {
  constructor(private readonly adminMetricasService: AdminMetricasService) {}

  @Get()
  async getDashboardMetrics() {
    return this.adminMetricasService.getDashboardMetrics();
  }
}
