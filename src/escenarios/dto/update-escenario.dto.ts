import { PartialType } from '@nestjs/mapped-types';
import { CreateEscenarioDto } from './create-escenario.dto';

/**
 * DTO para actualizar un botón de escenario existente
 */
export class UpdateEscenarioDto extends PartialType(CreateEscenarioDto) {}

