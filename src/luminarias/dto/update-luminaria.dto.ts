import { PartialType } from '@nestjs/mapped-types';
import { CreateLuminariaDto } from './create-luminaria.dto';

/**
 * DTO para actualizar una luminaria existente
 */
export class UpdateLuminariaDto extends PartialType(CreateLuminariaDto) {}

