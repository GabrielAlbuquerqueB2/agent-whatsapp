import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import {
  Consulta,
  Pagamento,
  Paciente,
  Auditoria,
  StatusConsulta,
  StatusPagamentoAsaas,
  TipoEventoAuditoria,
} from '../../database/entities';

export interface ResumoFinanceiro {
  periodo: { inicio: Date; fim: Date };
  totalConsultas: number;
  consultasRealizadas: number;
  consultasCanceladas: number;
  consultasNaoCompareceu: number;
  valorTotalGerado: number;
  valorTotalRecebido: number;
  valorPendente: number;
  taxaRealizacao: number;
  taxaConversao: number;
}

export interface RelatorioConsultas {
  periodo: { inicio: Date; fim: Date };
  porStatus: Record<string, number>;
  porDia: Array<{ data: string; quantidade: number }>;
  mediaConsultasPorDia: number;
}

export interface LogAuditoria {
  id: string;
  tipo_evento: string;
  paciente_id?: string;
  consulta_id?: string;
  pagamento_id?: string;
  dados: any;
  created_at: Date;
}

@Injectable()
export class RelatoriosService {
  constructor(
    @InjectRepository(Consulta)
    private consultaRepository: Repository<Consulta>,
    @InjectRepository(Pagamento)
    private pagamentoRepository: Repository<Pagamento>,
    @InjectRepository(Paciente)
    private pacienteRepository: Repository<Paciente>,
    @InjectRepository(Auditoria)
    private auditoriaRepository: Repository<Auditoria>,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Gera resumo financeiro do período
   */
  async getResumoFinanceiro(
    dataInicio: Date,
    dataFim: Date,
  ): Promise<ResumoFinanceiro> {
    // Total de consultas no período
    const consultas = await this.consultaRepository.find({
      where: {
        data_hora_inicio: Between(dataInicio, dataFim),
      },
      relations: ['pagamento'],
    });

    const consultasRealizadas = consultas.filter(
      (c) => c.status_consulta === StatusConsulta.REALIZADA,
    );
    const consultasCanceladas = consultas.filter(
      (c) => c.status_consulta === StatusConsulta.CANCELADA,
    );
    const consultasNaoCompareceu = consultas.filter(
      (c) => c.status_consulta === StatusConsulta.NAO_COMPARECEU,
    );

    // Valores financeiros
    const valorTotalGerado = consultasRealizadas.reduce(
      (sum, c) => sum + Number(c.valor),
      0,
    );

    const pagamentosRecebidos = await this.pagamentoRepository.find({
      where: {
        status: StatusPagamentoAsaas.RECEIVED,
        data_pagamento: Between(dataInicio, dataFim),
      },
    });

    const valorTotalRecebido = pagamentosRecebidos.reduce(
      (sum, p) => sum + Number(p.valor),
      0,
    );

    const pagamentosPendentes = await this.pagamentoRepository.find({
      where: {
        status: StatusPagamentoAsaas.PENDING,
      },
    });

    const valorPendente = pagamentosPendentes.reduce(
      (sum, p) => sum + Number(p.valor),
      0,
    );

    // Taxas
    const taxaRealizacao = consultas.length > 0
      ? (consultasRealizadas.length / consultas.length) * 100
      : 0;

    const taxaConversao = valorTotalGerado > 0
      ? (valorTotalRecebido / valorTotalGerado) * 100
      : 0;

    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      totalConsultas: consultas.length,
      consultasRealizadas: consultasRealizadas.length,
      consultasCanceladas: consultasCanceladas.length,
      consultasNaoCompareceu: consultasNaoCompareceu.length,
      valorTotalGerado,
      valorTotalRecebido,
      valorPendente,
      taxaRealizacao: Math.round(taxaRealizacao * 100) / 100,
      taxaConversao: Math.round(taxaConversao * 100) / 100,
    };
  }

  /**
   * Relatório de consultas por período
   */
  async getRelatorioConsultas(
    dataInicio: Date,
    dataFim: Date,
  ): Promise<RelatorioConsultas> {
    const consultas = await this.consultaRepository.find({
      where: {
        data_hora_inicio: Between(dataInicio, dataFim),
      },
    });

    // Por status
    const porStatus: Record<string, number> = {};
    for (const consulta of consultas) {
      porStatus[consulta.status_consulta] =
        (porStatus[consulta.status_consulta] || 0) + 1;
    }

    // Por dia
    const porDiaMap: Record<string, number> = {};
    for (const consulta of consultas) {
      const dataStr = consulta.data.toISOString().split('T')[0];
      porDiaMap[dataStr] = (porDiaMap[dataStr] || 0) + 1;
    }

    const porDia = Object.entries(porDiaMap)
      .map(([data, quantidade]) => ({ data, quantidade }))
      .sort((a, b) => a.data.localeCompare(b.data));

    // Média por dia
    const diasUteis = porDia.length || 1;
    const mediaConsultasPorDia = consultas.length / diasUteis;

    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      porStatus,
      porDia,
      mediaConsultasPorDia: Math.round(mediaConsultasPorDia * 100) / 100,
    };
  }

  /**
   * Lista pagamentos pendentes
   */
  async getPagamentosPendentes(): Promise<Pagamento[]> {
    return this.pagamentoRepository.find({
      where: {
        status: StatusPagamentoAsaas.PENDING,
      },
      relations: ['consulta', 'consulta.paciente'],
      order: { data_vencimento: 'ASC' },
    });
  }

  /**
   * Lista pagamentos vencidos
   */
  async getPagamentosVencidos(): Promise<Pagamento[]> {
    return this.pagamentoRepository.find({
      where: {
        status: StatusPagamentoAsaas.OVERDUE,
      },
      relations: ['consulta', 'consulta.paciente'],
      order: { data_vencimento: 'ASC' },
    });
  }

  /**
   * Histórico de pagamentos de um paciente
   */
  async getHistoricoPagamentosPaciente(pacienteId: string): Promise<Pagamento[]> {
    return this.pagamentoRepository
      .createQueryBuilder('pagamento')
      .innerJoin('pagamento.consulta', 'consulta')
      .where('consulta.paciente_id = :pacienteId', { pacienteId })
      .orderBy('pagamento.created_at', 'DESC')
      .getMany();
  }

  /**
   * Logs de auditoria com filtros
   */
  async getLogsAuditoria(
    filtros: {
      tipo_evento?: TipoEventoAuditoria;
      paciente_id?: string;
      consulta_id?: string;
      dataInicio?: Date;
      dataFim?: Date;
    },
    limite: number = 100,
  ): Promise<Auditoria[]> {
    const query = this.auditoriaRepository.createQueryBuilder('auditoria');

    if (filtros.tipo_evento) {
      query.andWhere('auditoria.tipo_evento = :tipo', { tipo: filtros.tipo_evento });
    }

    if (filtros.paciente_id) {
      query.andWhere('auditoria.paciente_id = :pacienteId', {
        pacienteId: filtros.paciente_id,
      });
    }

    if (filtros.consulta_id) {
      query.andWhere('auditoria.consulta_id = :consultaId', {
        consultaId: filtros.consulta_id,
      });
    }

    if (filtros.dataInicio) {
      query.andWhere('auditoria.created_at >= :dataInicio', {
        dataInicio: filtros.dataInicio,
      });
    }

    if (filtros.dataFim) {
      query.andWhere('auditoria.created_at <= :dataFim', {
        dataFim: filtros.dataFim,
      });
    }

    query.orderBy('auditoria.created_at', 'DESC');
    query.limit(limite);

    return query.getMany();
  }

  /**
   * Logs de auditoria financeira (pagamentos)
   */
  async getAuditoriaFinanceira(
    dataInicio: Date,
    dataFim: Date,
  ): Promise<Auditoria[]> {
    const tiposFinanceiros = [
      TipoEventoAuditoria.COBRANCA_CRIADA,
      TipoEventoAuditoria.PAGAMENTO_RECEBIDO,
      TipoEventoAuditoria.PAGAMENTO_CONFIRMADO,
      TipoEventoAuditoria.PAGAMENTO_VENCIDO,
      TipoEventoAuditoria.PAGAMENTO_REEMBOLSADO,
      TipoEventoAuditoria.WEBHOOK_ASAAS_RECEBIDO,
    ];

    return this.auditoriaRepository.find({
      where: {
        tipo_evento: tiposFinanceiros as any,
        created_at: Between(dataInicio, dataFim),
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Dashboard resumido
   */
  async getDashboard(): Promise<any> {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

    const [
      resumoFinanceiro,
      consultasHoje,
      pagamentosPendentes,
      totalPacientes,
    ] = await Promise.all([
      this.getResumoFinanceiro(inicioMes, fimMes),
      this.consultaRepository.count({
        where: {
          data: hoje,
          status_consulta: StatusConsulta.AGENDADA,
        },
      }),
      this.getPagamentosPendentes(),
      this.pacienteRepository.count({ where: { ativo: true } }),
    ]);

    return {
      consultasHoje,
      totalPacientes,
      pagamentosPendentes: pagamentosPendentes.length,
      valorPendenteTotal: pagamentosPendentes.reduce(
        (sum, p) => sum + Number(p.valor),
        0,
      ),
      resumoMes: resumoFinanceiro,
    };
  }
}
