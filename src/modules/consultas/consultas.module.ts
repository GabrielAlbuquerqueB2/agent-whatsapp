import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultasController } from './consultas.controller';
import { ConsultasService } from './consultas.service';
import { Consulta, Auditoria } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Consulta, Auditoria])],
  controllers: [ConsultasController],
  providers: [ConsultasService],
  exports: [ConsultasService],
})
export class ConsultasModule {}
