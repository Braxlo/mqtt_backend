import { PartialType } from '@nestjs/mapped-types';
import { CreateBarreraDto } from './create-barrera.dto';

/**
 * DTO para actualizar una barrera existente
 */
export class UpdateBarreraDto extends PartialType(CreateBarreraDto) {}

