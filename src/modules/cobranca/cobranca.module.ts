import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobrancaController } from './cobranca.controller';
import { CobrancaService } from './cobranca.service';
import { Pagamento, Auditoria } from '../../database/entities';
import { ConsultasModule } from '../consultas/consultas.module';
import { PacientesModule } from '../pacientes/pacientes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pagamento, Auditoria]),
    ConsultasModule,
    PacientesModule,
  ],
  controllers: [CobrancaController],
  providers: [CobrancaService],
  exports: [CobrancaService],
})
export class CobrancaModule {}
