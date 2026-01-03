/**
 * PSI Agenda - Main Application
 * Dashboard controller and UI interactions
 */

class PsiAgendaApp {
  constructor() {
    this.currentPage = 'dashboard';
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateCurrentDate();
    this.loadDashboard();
    this.startAutoRefresh();
  }

  // ============================================
  // Event Listeners
  // ============================================

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        this.navigateTo(page);
      });
    });

    // Mobile menu toggle
    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('active');
    });

    // Refresh button
    document.getElementById('btn-refresh').addEventListener('click', () => {
      this.refreshCurrentPage();
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') {
        this.closeModal();
      }
    });

    // Agenda date picker
    const agendaDate = document.getElementById('agenda-date');
    agendaDate.value = this.getTodayDate();
    agendaDate.addEventListener('change', () => {
      this.loadAgenda(agendaDate.value);
    });

    // Novo paciente
    document.getElementById('btn-novo-paciente')?.addEventListener('click', () => {
      this.showNovoPacienteModal();
    });

    // Nova consulta
    document.getElementById('btn-nova-consulta')?.addEventListener('click', () => {
      this.showNovaConsultaModal();
    });

    // Search pacientes
    document.getElementById('search-pacientes')?.addEventListener('input', (e) => {
      this.filterPacientes(e.target.value);
    });

    // Report cards
    document.querySelectorAll('.report-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showReport(card.dataset.report);
      });
    });
  }

  // ============================================
  // Navigation
  // ============================================

  navigateTo(page) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Update title
    const titles = {
      dashboard: 'Dashboard',
      agenda: 'Agenda do Dia',
      pacientes: 'Pacientes',
      consultas: 'Consultas',
      handoff: 'Handoff',
      financeiro: 'Financeiro',
      relatorios: 'Relatórios',
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    this.currentPage = page;
    this.loadPageData(page);

    // Close mobile menu
    document.querySelector('.sidebar').classList.remove('active');
  }

  loadPageData(page) {
    switch (page) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'agenda':
        this.loadAgenda();
        break;
      case 'pacientes':
        this.loadPacientes();
        break;
      case 'consultas':
        this.loadConsultas();
        break;
      case 'handoff':
        this.loadHandoff();
        break;
      case 'financeiro':
        this.loadFinanceiro();
        break;
      case 'disponibilidade':
        this.loadDisponibilidade();
        break;
    }
  }

  refreshCurrentPage() {
    this.loadPageData(this.currentPage);
    this.showToast('Dados atualizados!', 'success');
  }

  // ============================================
  // Dashboard
  // ============================================

  async loadDashboard() {
    try {
      // Load dashboard stats
      const dashboard = await api.getDashboard().catch(() => ({
        consultasHoje: 0,
        consultasRealizadasMes: 0,
        pagamentosPendentes: 0,
        totalPacientes: 0,
      }));

      document.getElementById('stat-consultas-hoje').textContent = dashboard.consultasHoje || 0;
      document.getElementById('stat-realizadas').textContent = dashboard.consultasRealizadasMes || 0;
      document.getElementById('stat-pendentes').textContent = dashboard.pagamentosPendentes || 0;
      document.getElementById('stat-pacientes').textContent = dashboard.totalPacientes || 0;

      // Load próximas consultas
      this.loadProximasConsultas();

      // Load handoffs
      this.loadHandoffsResumo();

      // Load pagamentos pendentes
      this.loadPagamentosPendentes();

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    }
  }

  async loadProximasConsultas() {
    const container = document.getElementById('proximas-consultas');
    try {
      const consultas = await api.getConsultasPorData(this.getTodayDate()).catch(() => []);
      
      if (!consultas || consultas.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-calendar-check"></i>
            <p>Nenhuma consulta agendada para hoje</p>
          </div>
        `;
        return;
      }

      container.innerHTML = consultas
        .filter(c => c.statusConsulta !== 'cancelada')
        .slice(0, 5)
        .map(c => `
          <div class="consulta-item">
            <div class="consulta-info">
              <span class="consulta-time">${this.formatTime(c.dataHora)}</span>
              <span class="consulta-patient">${c.paciente?.nome || 'Paciente'}</span>
            </div>
            <span class="status-badge status-${c.statusConsulta}">${this.formatStatus(c.statusConsulta)}</span>
          </div>
        `).join('');

    } catch (error) {
      container.innerHTML = '<div class="empty-state"><p>Erro ao carregar consultas</p></div>';
    }
  }

  async loadHandoffsResumo() {
    const container = document.getElementById('handoffs-aguardando');
    try {
      const handoffs = await api.getHandoffsAguardando().catch(() => []);
      
      // Update badge
      document.getElementById('handoff-badge').textContent = handoffs.length || 0;
      
      if (!handoffs || handoffs.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-check-circle"></i>
            <p>Nenhum handoff aguardando</p>
          </div>
        `;
        return;
      }

      container.innerHTML = handoffs.slice(0, 5).map(h => `
        <div class="handoff-item">
          <div class="handoff-info">
            <span class="handoff-patient">${h.paciente?.nome || 'Paciente'}</span>
            <span class="handoff-reason">${this.formatMotivo(h.motivo)}</span>
            <span class="handoff-time">${this.formatTimeAgo(h.createdAt)}</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="app.iniciarHandoff('${h.id}')">
            Atender
          </button>
        </div>
      `).join('');

    } catch (error) {
      container.innerHTML = '<div class="empty-state"><p>Erro ao carregar handoffs</p></div>';
    }
  }

  async loadPagamentosPendentes() {
    const tbody = document.querySelector('#pagamentos-pendentes-table tbody');
    try {
      const pagamentos = await api.getPagamentosPendentes().catch(() => []);
      
      if (!pagamentos || pagamentos.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <i class="fas fa-check-circle"></i>
              <p>Nenhum pagamento pendente</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = pagamentos.slice(0, 10).map(p => `
        <tr>
          <td>${p.paciente?.nome || 'N/A'}</td>
          <td>${this.formatDate(p.consulta?.dataHora)}</td>
          <td>R$ ${this.formatMoney(p.valor)}</td>
          <td>${this.formatDate(p.dataVencimento)}</td>
          <td><span class="status-badge status-${p.status}">${this.formatStatus(p.status)}</span></td>
          <td>
            <button class="btn btn-sm btn-icon" title="Ver detalhes" onclick="app.showPagamentoDetails('${p.id}')">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>
      `).join('');

    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Erro ao carregar pagamentos</td></tr>';
    }
  }

  // ============================================
  // Agenda
  // ============================================

  async loadAgenda(date = null) {
    const container = document.getElementById('agenda-timeline');
    const targetDate = date || this.getTodayDate();
    
    try {
      const consultas = await api.getConsultasPorData(targetDate).catch(() => []);
      
      if (!consultas || consultas.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-calendar-times"></i>
            <p>Nenhuma consulta agendada para esta data</p>
          </div>
        `;
        return;
      }

      container.innerHTML = consultas
        .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora))
        .map(c => `
          <div class="timeline-item status-${c.statusConsulta}">
            <div class="timeline-time">${this.formatTime(c.dataHora)}</div>
            <div class="timeline-content">
              <div class="timeline-patient">${c.paciente?.nome || 'Paciente'}</div>
              <div class="timeline-details">
                <span><i class="fas fa-phone"></i> ${c.paciente?.telefone || 'N/A'}</span>
                <span><i class="fas fa-clock"></i> ${c.duracao || 50} min</span>
                <span class="status-badge status-${c.statusConsulta}">${this.formatStatus(c.statusConsulta)}</span>
              </div>
            </div>
            <div class="timeline-actions">
              ${this.getConsultaActions(c)}
            </div>
          </div>
        `).join('');

    } catch (error) {
      container.innerHTML = '<div class="empty-state"><p>Erro ao carregar agenda</p></div>';
    }
  }

  getConsultaActions(consulta) {
    const status = consulta.statusConsulta;
    let actions = '';

    if (status === 'agendada') {
      actions += `<button class="btn btn-success btn-sm" onclick="app.confirmarConsulta('${consulta.id}')"><i class="fas fa-check"></i></button>`;
    }
    
    if (status === 'agendada' || status === 'confirmada') {
      actions += `<button class="btn btn-primary btn-sm" onclick="app.realizarConsulta('${consulta.id}')"><i class="fas fa-play"></i></button>`;
      actions += `<button class="btn btn-danger btn-sm" onclick="app.cancelarConsulta('${consulta.id}')"><i class="fas fa-times"></i></button>`;
    }

    return actions || '<span class="text-secondary">-</span>';
  }

  // ============================================
  // Pacientes
  // ============================================

  async loadPacientes() {
    const tbody = document.querySelector('#pacientes-table tbody');
    try {
      const pacientes = await api.getPacientes().catch(() => []);
      this.pacientesData = pacientes;
      
      if (!pacientes || pacientes.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state">
              <i class="fas fa-users"></i>
              <p>Nenhum paciente cadastrado</p>
            </td>
          </tr>
        `;
        return;
      }

      this.renderPacientes(pacientes);

    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Erro ao carregar pacientes</td></tr>';
    }
  }

  renderPacientes(pacientes) {
    const tbody = document.querySelector('#pacientes-table tbody');
    tbody.innerHTML = pacientes.map(p => `
      <tr>
        <td><strong>${p.nome}</strong></td>
        <td>${p.telefone}</td>
        <td>${p.email || '-'}</td>
        <td>R$ ${this.formatMoney(p.valorConsulta)}</td>
        <td>${this.formatTipoCobranca(p.tipoCobranca)}</td>
        <td><span class="status-badge ${p.ativo ? 'status-confirmada' : 'status-cancelada'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td>
          <button class="btn btn-sm btn-icon" title="Editar" onclick="app.editarPaciente('${p.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-icon" title="Nova consulta" onclick="app.agendarConsultaPaciente('${p.id}')">
            <i class="fas fa-calendar-plus"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  filterPacientes(search) {
    if (!this.pacientesData) return;
    
    const filtered = this.pacientesData.filter(p => 
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.telefone.includes(search) ||
      (p.email && p.email.toLowerCase().includes(search.toLowerCase()))
    );
    
    this.renderPacientes(filtered);
  }

  // ============================================
  // Consultas
  // ============================================

  async loadConsultas() {
    const tbody = document.querySelector('#consultas-table tbody');
    try {
      // Load consultas from today onwards
      const today = this.getTodayDate();
      const consultas = await api.getConsultasPorData(today).catch(() => []);
      
      if (!consultas || consultas.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <p>Nenhuma consulta encontrada</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = consultas.map(c => `
        <tr>
          <td>${this.formatDateTime(c.dataHora)}</td>
          <td>${c.paciente?.nome || 'N/A'}</td>
          <td><span class="status-badge status-${c.statusConsulta}">${this.formatStatus(c.statusConsulta)}</span></td>
          <td><span class="status-badge status-${c.statusPagamento}">${this.formatStatus(c.statusPagamento)}</span></td>
          <td>R$ ${this.formatMoney(c.valorCobrado || c.paciente?.valorConsulta)}</td>
          <td>${this.getConsultaActions(c)}</td>
        </tr>
      `).join('');

    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Erro ao carregar consultas</td></tr>';
    }
  }

  // ============================================
  // Handoff
  // ============================================

  async loadHandoff() {
    await Promise.all([
      this.loadHandoffAguardando(),
      this.loadHandoffEmAtendimento()
    ]);
  }

  async loadHandoffAguardando() {
    const container = document.getElementById('handoff-aguardando-list');
    try {
      const handoffs = await api.getHandoffsAguardando().catch(() => []);
      
      if (!handoffs || handoffs.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-check-circle"></i>
            <p>Nenhum handoff aguardando</p>
          </div>
        `;
        return;
      }

      container.innerHTML = handoffs.map(h => `
        <div class="handoff-item">
          <div class="handoff-info">
            <span class="handoff-patient"><strong>${h.paciente?.nome || 'Paciente'}</strong></span>
            <span class="handoff-reason"><i class="fas fa-tag"></i> ${this.formatMotivo(h.motivo)}</span>
            <span class="handoff-time"><i class="fas fa-clock"></i> ${this.formatTimeAgo(h.createdAt)}</span>
          </div>
          <button class="btn btn-primary" onclick="app.iniciarHandoff('${h.id}')">
            <i class="fas fa-headset"></i> Iniciar Atendimento
          </button>
        </div>
      `).join('');

    } catch (error) {
      container.innerHTML = '<div class="empty-state"><p>Erro ao carregar</p></div>';
    }
  }

  async loadHandoffEmAtendimento() {
    const container = document.getElementById('handoff-atendimento-list');
    try {
      const handoffs = await api.getHandoffsEmAtendimento().catch(() => []);
      
      if (!handoffs || handoffs.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>Nenhum atendimento em andamento</p>
          </div>
        `;
        return;
      }

      container.innerHTML = handoffs.map(h => `
        <div class="handoff-item">
          <div class="handoff-info">
            <span class="handoff-patient"><strong>${h.paciente?.nome || 'Paciente'}</strong></span>
            <span><i class="fas fa-phone"></i> ${h.paciente?.telefone}</span>
            <span class="handoff-reason"><i class="fas fa-tag"></i> ${this.formatMotivo(h.motivo)}</span>
          </div>
          <button class="btn btn-success" onclick="app.finalizarHandoff('${h.id}')">
            <i class="fas fa-check"></i> Finalizar
          </button>
        </div>
      `).join('');

    } catch (error) {
      container.innerHTML = '<div class="empty-state"><p>Erro ao carregar</p></div>';
    }
  }

  async iniciarHandoff(id) {
    try {
      await api.iniciarHandoff(id);
      this.showToast('Atendimento iniciado!', 'success');
      this.loadHandoff();
      this.loadHandoffsResumo();
    } catch (error) {
      this.showToast('Erro ao iniciar atendimento', 'error');
    }
  }

  async finalizarHandoff(id) {
    const observacoes = prompt('Observações do atendimento:');
    if (observacoes === null) return;
    
    try {
      await api.finalizarHandoff(id, observacoes);
      this.showToast('Atendimento finalizado!', 'success');
      this.loadHandoff();
      this.loadHandoffsResumo();
    } catch (error) {
      this.showToast('Erro ao finalizar atendimento', 'error');
    }
  }

  // ============================================
  // Financeiro
  // ============================================

  async loadFinanceiro() {
    try {
      const resumo = await api.getFinanceiroResumo().catch(() => ({
        recebido: 0,
        aReceber: 0,
        vencido: 0,
        movimentacoes: [],
      }));

      document.getElementById('stat-recebido').textContent = `R$ ${this.formatMoney(resumo.recebido || 0)}`;
      document.getElementById('stat-a-receber').textContent = `R$ ${this.formatMoney(resumo.aReceber || 0)}`;
      document.getElementById('stat-vencido').textContent = `R$ ${this.formatMoney(resumo.vencido || 0)}`;

      // Render table
      const tbody = document.querySelector('#financeiro-table tbody');
      const movimentacoes = resumo.movimentacoes || [];
      
      if (movimentacoes.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <p>Nenhuma movimentação encontrada</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = movimentacoes.map(m => `
        <tr>
          <td>${this.formatDate(m.dataPagamento || m.dataVencimento)}</td>
          <td>${m.paciente?.nome || 'N/A'}</td>
          <td>Consulta ${this.formatDate(m.consulta?.dataHora)}</td>
          <td>R$ ${this.formatMoney(m.valor)}</td>
          <td><span class="status-badge status-${m.status}">${this.formatStatus(m.status)}</span></td>
          <td>${this.formatMetodo(m.metodoPagamento)}</td>
        </tr>
      `).join('');

    } catch (error) {
      console.error('Erro ao carregar financeiro:', error);
    }
  }

  // ============================================
  // Disponibilidade
  // ============================================

  async loadDisponibilidade() {
    try {
      // Carregar resumo
      const resumo = await api.getDisponibilidadeResumo().catch(() => ({
        diasAtivos: [],
        totalHorasSemana: 0,
        slotsDisponiveis: 0,
      }));

      const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const diasAtivosNomes = resumo.diasAtivos.map(d => diasNomes[d]).join(', ') || 'Nenhum';
      
      document.getElementById('resumo-dias').textContent = diasAtivosNomes;
      document.getElementById('resumo-horas').textContent = `${resumo.totalHorasSemana}h`;
      document.getElementById('resumo-slots').textContent = resumo.slotsDisponiveis;

      // Carregar disponibilidades
      const disponibilidades = await api.getDisponibilidades().catch(() => []);

      // Agrupar por dia
      const porDia = {};
      for (let i = 0; i <= 6; i++) {
        porDia[i] = [];
      }
      
      disponibilidades.forEach(d => {
        porDia[d.diaSemana].push(d);
      });

      // Renderizar cada dia
      document.querySelectorAll('.dia-card').forEach(card => {
        const dia = parseInt(card.dataset.dia);
        const horarios = porDia[dia] || [];
        const statusEl = card.querySelector('.dia-status');
        const horariosEl = card.querySelector('.dia-horarios');

        if (horarios.length > 0) {
          card.classList.add('ativo');
          statusEl.textContent = `${horarios.length} período(s)`;
          statusEl.classList.remove('inativo');
          statusEl.classList.add('ativo');
        } else {
          card.classList.remove('ativo');
          statusEl.textContent = 'Não atende';
          statusEl.classList.remove('ativo');
          statusEl.classList.add('inativo');
        }

        horariosEl.innerHTML = horarios.map(h => `
          <div class="horario-item">
            <div class="horario-info">
              <span class="horario-range">${h.horarioInicio} - ${h.horarioFim}</span>
              <span class="horario-config">${h.duracaoConsulta}min consulta | ${h.intervaloConsultas}min intervalo</span>
            </div>
            <div class="horario-actions">
              <button class="btn-toggle ${h.ativo ? '' : 'inactive'}" onclick="app.toggleDisponibilidade('${h.id}')" title="${h.ativo ? 'Desativar' : 'Ativar'}">
                <i class="fas fa-${h.ativo ? 'toggle-on' : 'toggle-off'}"></i>
              </button>
              <button class="btn-delete" onclick="app.removerDisponibilidade('${h.id}')" title="Remover">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('');
      });

      // Botão adicionar
      document.getElementById('btn-add-disponibilidade')?.addEventListener('click', () => {
        this.showAddDisponibilidadeModal();
      });

    } catch (error) {
      console.error('Erro ao carregar disponibilidade:', error);
      this.showToast('Erro ao carregar disponibilidade', 'error');
    }
  }

  showAddDisponibilidadeModal() {
    const diasSemana = [
      { value: 0, label: 'Domingo' },
      { value: 1, label: 'Segunda-feira' },
      { value: 2, label: 'Terça-feira' },
      { value: 3, label: 'Quarta-feira' },
      { value: 4, label: 'Quinta-feira' },
      { value: 5, label: 'Sexta-feira' },
      { value: 6, label: 'Sábado' },
    ];

    const content = `
      <form class="form-disponibilidade" id="form-disponibilidade">
        <div class="form-row">
          <div class="form-group">
            <label for="diaSemana">Dia da Semana</label>
            <select id="diaSemana" name="diaSemana" required>
              ${diasSemana.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="horarioInicio">Horário Início</label>
            <input type="time" id="horarioInicio" name="horarioInicio" value="08:00" required>
          </div>
          <div class="form-group">
            <label for="horarioFim">Horário Fim</label>
            <input type="time" id="horarioFim" name="horarioFim" value="18:00" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="duracaoConsulta">Duração Consulta (min)</label>
            <input type="number" id="duracaoConsulta" name="duracaoConsulta" value="50" min="15" max="180" required>
          </div>
          <div class="form-group">
            <label for="intervaloConsultas">Intervalo (min)</label>
            <input type="number" id="intervaloConsultas" name="intervaloConsultas" value="10" min="0" max="60" required>
          </div>
        </div>

        <div class="form-actions" style="display: flex; gap: 12px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    `;

    this.showModal('Adicionar Horário de Disponibilidade', content);

    document.getElementById('form-disponibilidade').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarDisponibilidade();
    });
  }

  async salvarDisponibilidade() {
    const form = document.getElementById('form-disponibilidade');
    const data = {
      diaSemana: parseInt(form.diaSemana.value),
      horarioInicio: form.horarioInicio.value,
      horarioFim: form.horarioFim.value,
      duracaoConsulta: parseInt(form.duracaoConsulta.value),
      intervaloConsultas: parseInt(form.intervaloConsultas.value),
    };

    try {
      await api.criarDisponibilidade(data);
      this.closeModal();
      this.showToast('Disponibilidade adicionada com sucesso!', 'success');
      this.loadDisponibilidade();
    } catch (error) {
      this.showToast(error.message || 'Erro ao salvar disponibilidade', 'error');
    }
  }

  async toggleDisponibilidade(id) {
    try {
      await api.toggleDisponibilidade(id);
      this.showToast('Status alterado!', 'success');
      this.loadDisponibilidade();
    } catch (error) {
      this.showToast('Erro ao alterar status', 'error');
    }
  }

  async removerDisponibilidade(id) {
    if (!confirm('Deseja realmente remover este horário?')) return;

    try {
      await api.removerDisponibilidade(id);
      this.showToast('Horário removido!', 'success');
      this.loadDisponibilidade();
    } catch (error) {
      this.showToast('Erro ao remover horário', 'error');
    }
  }

  // ============================================
  // Consulta Actions
  // ============================================

  async confirmarConsulta(id) {
    try {
      await api.confirmarConsulta(id);
      this.showToast('Consulta confirmada!', 'success');
      this.refreshCurrentPage();
    } catch (error) {
      this.showToast('Erro ao confirmar consulta', 'error');
    }
  }

  async realizarConsulta(id) {
    if (!confirm('Marcar esta consulta como realizada?')) return;
    
    try {
      await api.realizarConsulta(id);
      this.showToast('Consulta realizada! Cobrança será gerada.', 'success');
      this.refreshCurrentPage();
    } catch (error) {
      this.showToast('Erro ao realizar consulta', 'error');
    }
  }

  async cancelarConsulta(id) {
    const motivo = prompt('Motivo do cancelamento:');
    if (!motivo) return;
    
    try {
      await api.cancelarConsulta(id, motivo);
      this.showToast('Consulta cancelada!', 'success');
      this.refreshCurrentPage();
    } catch (error) {
      this.showToast('Erro ao cancelar consulta', 'error');
    }
  }

  // ============================================
  // Modals
  // ============================================

  showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('active');
  }

  closeModal() {
    document.getElementById('modal').classList.remove('active');
  }

  showNovoPacienteModal() {
    const content = `
      <form id="form-paciente" onsubmit="app.salvarPaciente(event)">
        <div class="form-group">
          <label>Nome Completo *</label>
          <input type="text" name="nome" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Telefone (WhatsApp) *</label>
          <input type="text" name="telefone" class="form-control" placeholder="5511999999999" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" class="form-control">
        </div>
        <div class="form-group">
          <label>CPF/CNPJ</label>
          <input type="text" name="cpfCnpj" class="form-control">
        </div>
        <div class="form-group">
          <label>Valor da Consulta *</label>
          <input type="number" name="valorConsulta" class="form-control" step="0.01" required>
        </div>
        <div class="form-group">
          <label>Tipo de Cobrança</label>
          <select name="tipoCobranca" class="form-control">
            <option value="pos_consulta">Pós-consulta</option>
            <option value="antecipado">Antecipado</option>
            <option value="mensal">Mensal</option>
          </select>
        </div>
        <div class="form-group">
          <label>Tipo de Pagamento Preferido</label>
          <select name="tipoPagamento" class="form-control">
            <option value="pix">PIX</option>
            <option value="boleto">Boleto</option>
            <option value="cartao">Cartão</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 16px;">
          <i class="fas fa-save"></i> Salvar Paciente
        </button>
      </form>
    `;
    this.showModal('Novo Paciente', content);
  }

  async salvarPaciente(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
      nome: formData.get('nome'),
      telefone: formData.get('telefone'),
      email: formData.get('email') || undefined,
      cpfCnpj: formData.get('cpfCnpj') || undefined,
      valorConsulta: parseFloat(formData.get('valorConsulta')),
      tipoCobranca: formData.get('tipoCobranca'),
      tipoPagamento: formData.get('tipoPagamento'),
    };

    try {
      await api.criarPaciente(data);
      this.showToast('Paciente criado com sucesso!', 'success');
      this.closeModal();
      this.loadPacientes();
    } catch (error) {
      this.showToast('Erro ao criar paciente: ' + error.message, 'error');
    }
  }

  showNovaConsultaModal() {
    const content = `
      <form id="form-consulta" onsubmit="app.salvarConsulta(event)">
        <div class="form-group">
          <label>Telefone do Paciente *</label>
          <input type="text" name="telefone" class="form-control" placeholder="5511999999999" required>
        </div>
        <div class="form-group">
          <label>Data e Hora *</label>
          <input type="datetime-local" name="dataHora" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Duração (minutos)</label>
          <input type="number" name="duracao" class="form-control" value="50">
        </div>
        <div class="form-group">
          <label>Observações</label>
          <textarea name="observacoes" class="form-control" rows="3"></textarea>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 16px;">
          <i class="fas fa-calendar-plus"></i> Agendar Consulta
        </button>
      </form>
    `;
    this.showModal('Nova Consulta', content);
  }

  async salvarConsulta(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
      telefone: formData.get('telefone'),
      dataHora: new Date(formData.get('dataHora')).toISOString(),
      duracao: parseInt(formData.get('duracao')) || 50,
      observacoes: formData.get('observacoes') || undefined,
    };

    try {
      await api.criarConsulta(data);
      this.showToast('Consulta agendada com sucesso!', 'success');
      this.closeModal();
      this.loadConsultas();
      this.loadAgenda();
    } catch (error) {
      this.showToast('Erro ao agendar consulta: ' + error.message, 'error');
    }
  }

  showReport(type) {
    this.showToast(`Gerando relatório de ${type}...`, 'info');
    // TODO: Implement report generation
  }

  // ============================================
  // Utilities
  // ============================================

  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  updateCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = 
      new Date().toLocaleDateString('pt-BR', options);
  }

  formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  formatTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatMoney(value) {
    if (value === null || value === undefined) return '0,00';
    return parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  formatStatus(status) {
    const map = {
      agendada: 'Agendada',
      confirmada: 'Confirmada',
      realizada: 'Realizada',
      cancelada: 'Cancelada',
      nao_compareceu: 'Não compareceu',
      pendente: 'Pendente',
      pago: 'Pago',
      vencido: 'Vencido',
      aguardando: 'Aguardando',
      em_atendimento: 'Em atendimento',
      finalizado: 'Finalizado',
    };
    return map[status] || status;
  }

  formatMotivo(motivo) {
    const map = {
      duvida_agendamento: 'Dúvida sobre agendamento',
      problema_pagamento: 'Problema com pagamento',
      urgencia: 'Urgência',
      reclamacao: 'Reclamação',
      outro: 'Outro assunto',
    };
    return map[motivo] || motivo;
  }

  formatTipoCobranca(tipo) {
    const map = {
      pos_consulta: 'Pós-consulta',
      antecipado: 'Antecipado',
      mensal: 'Mensal',
    };
    return map[tipo] || tipo;
  }

  formatMetodo(metodo) {
    const map = {
      pix: 'PIX',
      boleto: 'Boleto',
      cartao: 'Cartão',
    };
    return map[metodo] || metodo || '-';
  }

  formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60);
    
    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff} min atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    return `${Math.floor(diff / 1440)} dias atrás`;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${this.getToastIcon(type)}"></i> ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => toast.remove(), 4000);
  }

  getToastIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle',
    };
    return icons[type] || 'info-circle';
  }

  startAutoRefresh() {
    // Refresh handoffs every 30 seconds
    setInterval(() => {
      this.loadHandoffsResumo();
    }, 30000);
  }
}

// Initialize app
const app = new PsiAgendaApp();
