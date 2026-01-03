/**
 * PSI Agenda - API Service
 * Handles all API communications
 */

const API_BASE = '/api/v1';

const api = {
  /**
   * Generic fetch wrapper
   */
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Erro ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // ============================================
  // Dashboard
  // ============================================
  
  async getDashboard() {
    return this.request('/relatorios/dashboard');
  },

  async getFinanceiroResumo(mes) {
    const params = mes ? `?mes=${mes}` : '';
    return this.request(`/relatorios/financeiro${params}`);
  },

  // ============================================
  // Pacientes
  // ============================================
  
  async getPacientes() {
    return this.request('/pacientes');
  },

  async getPaciente(id) {
    return this.request(`/pacientes/${id}`);
  },

  async getPacientePorTelefone(telefone) {
    return this.request(`/pacientes/telefone/${telefone}`);
  },

  async criarPaciente(data) {
    return this.request('/pacientes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async atualizarPaciente(id, data) {
    return this.request(`/pacientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getPacientesPendentes() {
    return this.request('/pacientes/pendentes/pagamento');
  },

  // ============================================
  // Consultas
  // ============================================
  
  async getConsultasPorData(data) {
    return this.request(`/consultas/data/${data}`);
  },

  async getConsultasPorPaciente(pacienteId) {
    return this.request(`/consultas/paciente/${pacienteId}`);
  },

  async getProximasConsultas(pacienteId) {
    return this.request(`/consultas/paciente/${pacienteId}/proximas`);
  },

  async getConsulta(id) {
    return this.request(`/consultas/${id}`);
  },

  async criarConsulta(data) {
    return this.request('/consultas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async realizarConsulta(id) {
    return this.request(`/consultas/${id}/realizar`, {
      method: 'PUT',
    });
  },

  async confirmarConsulta(id) {
    return this.request(`/consultas/${id}/confirmar`, {
      method: 'PUT',
    });
  },

  async cancelarConsulta(id, motivo) {
    return this.request(`/consultas/${id}/cancelar`, {
      method: 'PUT',
      body: JSON.stringify({ motivo }),
    });
  },

  async marcarNaoCompareceu(id) {
    return this.request(`/consultas/${id}/nao-compareceu`, {
      method: 'PUT',
    });
  },

  async getConsultasPendentesCobranca() {
    return this.request('/consultas/pendentes/cobranca');
  },

  // ============================================
  // Handoff
  // ============================================
  
  async getHandoffsAguardando() {
    return this.request('/handoff/aguardando');
  },

  async getHandoffsEmAtendimento() {
    return this.request('/handoff/em-atendimento');
  },

  async iniciarHandoff(id) {
    return this.request(`/handoff/${id}/iniciar`, {
      method: 'PUT',
    });
  },

  async finalizarHandoff(id, observacoes) {
    return this.request(`/handoff/${id}/finalizar`, {
      method: 'PUT',
      body: JSON.stringify({ observacoes }),
    });
  },

  // ============================================
  // Cobrança
  // ============================================
  
  async gerarCobranca(consultaId) {
    return this.request(`/cobranca/gerar/${consultaId}`, {
      method: 'POST',
    });
  },

  async processarCobrancas() {
    return this.request('/cobranca/processar', {
      method: 'POST',
    });
  },

  // ============================================
  // Relatórios
  // ============================================
  
  async getRelatorioConsultas(dataInicio, dataFim) {
    const params = new URLSearchParams();
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    return this.request(`/relatorios/consultas?${params}`);
  },

  async getRelatorioFinanceiro(mes) {
    const params = mes ? `?mes=${mes}` : '';
    return this.request(`/relatorios/financeiro${params}`);
  },

  async getPagamentosPendentes() {
    return this.request('/relatorios/pagamentos/pendentes');
  },

  async getPagamentosVencidos() {
    return this.request('/relatorios/pagamentos/vencidos');
  },

  async getAuditoria(dataInicio, dataFim) {
    const params = new URLSearchParams();
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    return this.request(`/relatorios/auditoria?${params}`);
  },

  // ============================================
  // Lembretes
  // ============================================
  
  async enviarLembrete(consultaId) {
    return this.request(`/lembretes/enviar/${consultaId}`, {
      method: 'POST',
    });
  },

  // ============================================
  // Disponibilidade
  // ============================================
  
  async getDisponibilidades() {
    return this.request('/disponibilidade');
  },

  async getDisponibilidadesAtivas() {
    return this.request('/disponibilidade/ativas');
  },

  async getDisponibilidadeResumo() {
    return this.request('/disponibilidade/resumo');
  },

  async getDisponibilidadePorDia(diaSemana) {
    return this.request(`/disponibilidade/dia/${diaSemana}`);
  },

  async getHorariosDisponiveis(data) {
    return this.request(`/disponibilidade/horarios/${data}`);
  },

  async criarDisponibilidade(data) {
    return this.request('/disponibilidade', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async atualizarDisponibilidade(id, data) {
    return this.request(`/disponibilidade/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async toggleDisponibilidade(id) {
    return this.request(`/disponibilidade/${id}/toggle`, {
      method: 'PUT',
    });
  },

  async removerDisponibilidade(id) {
    return this.request(`/disponibilidade/${id}`, {
      method: 'DELETE',
    });
  },
};

// Export for use
window.api = api;
