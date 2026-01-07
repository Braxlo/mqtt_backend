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
import { BarrerasService } from './barreras.service';
import { CreateBarreraDto } from './dto/create-barrera.dto';
import { UpdateBarreraDto } from './dto/update-barrera.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ResponseUtil } from '../common/utils/response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestionar barreras
 */
@Controller('barreras')
@UseGuards(JwtAuthGuard)
export class BarrerasController {
  constructor(private readonly barrerasService: BarrerasService) {}

  @Get()
  async findAll() {
    const barreras = await this.barrerasService.findAll();
    return ResponseUtil.success(barreras, 'Barreras obtenidas exitosamente');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const barrera = await this.barrerasService.findOne(id);
    return ResponseUtil.success(barrera, 'Barrera obtenida exitosamente');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createBarreraDto: CreateBarreraDto) {
    const barrera = await this.barrerasService.create(createBarreraDto);
    return ResponseUtil.success(barrera, 'Barrera creada exitosamente');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateBarreraDto: UpdateBarreraDto) {
    const barrera = await this.barrerasService.update(id, updateBarreraDto);
    return ResponseUtil.success(barrera, 'Barrera actualizada exitosamente');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.barrerasService.remove(id);
    return ResponseUtil.success(null, 'Barrera eliminada exitosamente');
  }

  @Post('orden')
  @HttpCode(HttpStatus.OK)
  async updateOrder(@Body() updateOrderDto: UpdateOrderDto) {
    await this.barrerasService.updateOrder(updateOrderDto.barreras);
    return ResponseUtil.success(null, 'Orden de barreras actualizado exitosamente');
  }
}

