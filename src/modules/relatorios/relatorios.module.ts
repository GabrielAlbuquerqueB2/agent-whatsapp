import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';
import { Consulta, Pagamento, Paciente, Auditoria } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Consulta, Pagamento, Paciente, Auditoria])],
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
  exports: [RelatoriosService],
})
export class RelatoriosModule {}
