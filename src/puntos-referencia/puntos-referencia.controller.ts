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
  ParseIntPipe,
} from '@nestjs/common';
import { PuntosReferenciaService } from './puntos-referencia.service';
import { CreatePuntoReferenciaDto } from './dto/create-punto-referencia.dto';
import { UpdatePuntoReferenciaDto } from './dto/update-punto-referencia.dto';
import { ResponseUtil } from '../common/utils/response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Controlador para gestionar puntos de referencia HKN
 * Solo accesible por Administradores
 */
@Controller('puntos-referencia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class PuntosReferenciaController {
  constructor(private readonly puntosReferenciaService: PuntosReferenciaService) {}

  @Get()
  async findAll() {
    const puntos = await this.puntosReferenciaService.findAll();
    return ResponseUtil.success(puntos, 'Puntos de referencia obtenidos exitosamente');
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const punto = await this.puntosReferenciaService.findOne(id);
    return ResponseUtil.success(punto, 'Punto de referencia obtenido exitosamente');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreatePuntoReferenciaDto) {
    const punto = await this.puntosReferenciaService.create(createDto);
    return ResponseUtil.success(punto, 'Punto de referencia creado exitosamente');
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdatePuntoReferenciaDto,
  ) {
    const punto = await this.puntosReferenciaService.update(id, updateDto);
    return ResponseUtil.success(punto, 'Punto de referencia actualizado exitosamente');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.puntosReferenciaService.remove(id);
    return ResponseUtil.success(null, 'Punto de referencia eliminado exitosamente');
  }
}
