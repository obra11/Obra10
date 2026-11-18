import { SetMetadata } from '@nestjs/common';
export const MODULO_KEY = 'modulo';
export const Modulo = (...slugs: string[]) => SetMetadata(MODULO_KEY, slugs);
