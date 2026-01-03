import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancelamentoService } from './cancelamento.service';
import { Paciente } from '../../database/entities';
import { ConsultasModule } from '../consultas/consultas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Paciente]),
    ConsultasModule,
  ],
  providers: [CancelamentoService],
  exports: [CancelamentoService],
})
export class CancelamentoModule {}
