import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { EscenariosService } from './escenarios.service';
import { CreateEscenarioDto } from './dto/create-escenario.dto';
import { UpdateEscenarioDto } from './dto/update-escenario.dto';
import { ResponseUtil } from '../common/utils/response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestionar escenarios/botones
 */
@Controller('escenarios')
@UseGuards(JwtAuthGuard)
export class EscenariosController {
  constructor(private readonly escenariosService: EscenariosService) {}

  @Get()
  async findAll() {
    const escenarios = await this.escenariosService.findAll();
    return ResponseUtil.success(escenarios, 'Escenarios obtenidos exitosamente');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const escenario = await this.escenariosService.findOne(id);
    return ResponseUtil.success(escenario, 'Escenario obtenido exitosamente');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createEscenarioDto: CreateEscenarioDto) {
    const escenario = await this.escenariosService.create(createEscenarioDto);
    return ResponseUtil.success(escenario, 'Escenario creado exitosamente');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateEscenarioDto: UpdateEscenarioDto) {
    const escenario = await this.escenariosService.update(id, updateEscenarioDto);
    return ResponseUtil.success(escenario, 'Escenario actualizado exitosamente');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.escenariosService.remove(id);
    return ResponseUtil.success(null, 'Escenario eliminado exitosamente');
  }
}

