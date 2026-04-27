import {
  Controller,
  Get,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@Controller('modulos')
export class ModulosController {
  constructor(private readonly modulosService: ModulosService) {}

  /**
   * GET /modulos — PUBLIC (no JWT required)
   * Returns the full module catalog: slug, nome, grupo, sigla, descricao, preco,
   * versao, dependencias, ordemExibicao, submodulos[].
   * Used in the registration / contracting flow by unauthenticated users.
   */
  @Get()
  async findAll() {
    return this.modulosService.findAll();
  }

  /**
   * GET /modulos/agrupado — PUBLIC (no JWT required)
   * Returns modules grouped by category (Operacional, Qualidade, Gestão, Pessoas).
   * Useful for the contracting page grouped view.
   */
  @Get('agrupado')
  async findAllGrouped() {
    return this.modulosService.findAllGrouped();
  }

  /**
   * GET /modulos/:slug/submodulos — JWT required
   * Returns active submodules of a parent module.
   * Example: GET /modulos/CTRL_TEC/submodulos → Concreto, Solo, Argamassa, Asfalto
   */
  @UseGuards(JwtAuthGuard)
  @Get(':slug/submodulos')
  async findSubmodulos(@Param('slug') slug: string) {
    const submodulos = await this.modulosService.findSubmodulos(
      slug.toUpperCase(),
    );
    if (submodulos === null) {
      throw new NotFoundException(
        `Módulo "${slug}" não encontrado no catálogo.`,
      );
    }
    return submodulos;
  }

  /**
   * GET /modulos/:slug/integracoes — JWT required
   * Returns events that this module emits and events it consumes.
   * Example: GET /modulos/RDO/integracoes → { emite: [...], consome: [...] }
   */
  @UseGuards(JwtAuthGuard)
  @Get(':slug/integracoes')
  async findIntegracoes(@Param('slug') slug: string) {
    return this.modulosService.findIntegracoes(slug.toUpperCase());
  }
}
