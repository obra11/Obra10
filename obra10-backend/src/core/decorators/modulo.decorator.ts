import { SetMetadata } from '@nestjs/common';
export const MODULO_KEY = 'modulo';
export const Modulo = (slug: string) => SetMetadata(MODULO_KEY, slug);
