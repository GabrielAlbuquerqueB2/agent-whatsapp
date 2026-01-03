import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PacientesController } from './pacientes.controller';
import { PacientesService } from './pacientes.service';
import { Paciente, Auditoria } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Paciente, Auditoria])],
  controllers: [PacientesController],
  providers: [PacientesService],
  exports: [PacientesService],
})
export class PacientesModule {}
