import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export type ModuloEventName =
  | 'RDO_FECHADO'
  | 'AFERICAO_VENCENDO'
  | 'FVS_REPROVADO'
  | 'ENSAIO_REPROVADO'
  | 'VISTORIA_APROVADA';

export interface RdoFechadoPayload {
  rdoId: string;
  obraId: string;
  empresaId: string;
}

export interface EnsaioReprovadoPayload {
  ensaioId: string;
  obraId: string;
  empresaId: string;
  moduloSlug: string;
  submoduloSlug: string;
  valorMedido: number;
  limiteEsperado: number;
}

export interface AfericaoVencendoPayload {
  equipamentoId: string;
  obraId: string;
  empresaId: string;
  diasRestantes: number;
}

export interface FvsReprovadoPayload {
  fvsId: string;
  obraId: string;
  empresaId: string;
  frenteServico?: string;
}

export interface VistoriaAprovadaPayload {
  vistoriaId: string;
  obraId: string;
  empresaId: string;
  clienteId?: string;
}

/**
 * ModuloEventsService — Internal event bus for cross-module communication.
 */
@Injectable()
export class ModuloEventsService {
  private readonly logger = new Logger(ModuloEventsService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit(event: ModuloEventName, payload: Record<string, any>): void {
    this.eventEmitter.emit(event, payload);
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`📡 ${event} ${JSON.stringify(payload)}`);
    }
  }

  emitAsync(event: ModuloEventName, payload: Record<string, any>): Promise<any[]> {
    return this.eventEmitter.emitAsync(event, payload);
  }
}

