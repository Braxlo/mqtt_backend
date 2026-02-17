import { PartialType } from '@nestjs/mapped-types';
import { CreateLetreroDto } from './create-letrero.dto';

/**
 * DTO para actualizar un letrero existente
 */
export class UpdateLetreroDto extends PartialType(CreateLetreroDto) {}
