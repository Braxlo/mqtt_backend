import { PartialType } from '@nestjs/mapped-types';
import { CreatePuntoReferenciaDto } from './create-punto-referencia.dto';

/**
 * DTO para actualizar un punto de referencia existente
 */
export class UpdatePuntoReferenciaDto extends PartialType(CreatePuntoReferenciaDto) {}
