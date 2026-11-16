/**
 * Seavora — Main Application
 * SPA navigation, UI rendering, interactions
 */

const App = (() => {
  let currentPage = 'dashboard';
  let chartPeriod = '1m';

  function init() {
    Storage.load();
    // Migrate old installs without explicit auto
    const data = Storage.get();
    if (!data.settings.theme) {
      Storage.update(d => { d.settings.theme = 'auto'; });
    }
    applyTheme();
    watchSystemTheme();
    bindGlobalEvents();
    updateUserUI();
    generateSmartNotifications();
    navigate(routeFromHash());
    if (typeof lucide !== 'undefined') lucide.createIcons();
    checkFirstAccess();
  }

  function generateSmartNotifications() {
    const data = Storage.get();
    const total = Caixinhas.totalBalance();
    const goals = Goals.getGoalsView();
    // Near goal
    goals.forEach(g => {
      if (g.progress >= 80 && g.progress < 100) {
        const lack = g.goal - g.balance;
        const key = 'near_' + g.id;
        if (!data.notifications.some(n => n.message && n.message.includes(g.name) && n.message.includes('da sua meta'))) {
          Storage.addNotification({
            icon: '🎯',
            message: `Você está a ${Calculators.formatMoney(lack)} da meta "${g.name}"!`
          });
        }
      }
    });
    // Monthly habit
    const monthAportes = Caixinhas.monthlyAportes();
    if (monthAportes > 0 && data.transactions.filter(t => t.type === 'aporte').length >= 3) {
      if (!data.notifications.some(n => n.message && n.message.includes('hábito'))) {
        Storage.addNotification({
          icon: '🔥',
          message: 'Você está mantendo seu hábito de investir!'
        });
      }
    }
  }

  function animateValue(el, end, duration = 700) {
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = el.dataset.money === '1' ? Calculators.formatMoney(end) : String(end); return; }
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=el.dataset.money==='1'?Calculators.formatMoney(end):String(Math.round(end));return;}
    const start = 0;
    const startTime = performance.now();
    const isMoney = el.dataset.money === '1';
    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (end - start) * eased;
      el.textContent = isMoney ? Calculators.formatMoney(current) : Math.round(current).toString();
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = isMoney ? Calculators.formatMoney(end) : Math.round(end).toString();
    }
    requestAnimationFrame(frame);
  }

  function launchConfetti() {
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    const colors = ['#08756f', '#5acbb5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDelay = Math.random() * 0.4 + 's';
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      p.style.width = (6 + Math.random() * 6) + 'px';
      p.style.height = (6 + Math.random() * 6) + 'px';
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 2800);
  }
  // Expose for caixinhas module
  window.__finflowConfetti = launchConfetti;

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function getEffectiveTheme() {
    const pref = Storage.get().settings.theme || 'auto';
    if (pref === 'auto') return getSystemTheme();
    return pref === 'dark' ? 'dark' : 'light';
  }

  function applyTheme() {
    const pref = Storage.get().settings.theme || 'auto';
    const effective = getEffectiveTheme();
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-pref', pref);

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = effective === 'dark' ? '#0f0f12' : '#08756f';

    const toggleIcon = document.querySelector('#theme-toggle');
    if (toggleIcon) toggleIcon.innerHTML = '<i data-lucide="'+(pref === 'auto' ? 'monitor' : effective === 'dark' ? 'sun' : 'moon')+'"></i>';
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
      if (pref === 'auto') {
        icon.setAttribute('data-lucide', 'monitor');
      } else {
        icon.setAttribute('data-lucide', effective === 'dark' ? 'sun' : 'moon');
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      const labels = { auto: 'Tema automático (sistema)', light: 'Tema claro', dark: 'Tema escuro' };
      toggle.setAttribute('aria-label', labels[pref] || 'Alternar tema');
      toggle.title = pref === 'auto'
        ? `Automático (${effective === 'dark' ? 'escuro' : 'claro'})`
        : (pref === 'dark' ? 'Escuro' : 'Claro');
    }
  }

  function cycleTheme() {
    const current = Storage.get().settings.theme || 'auto';
    const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    Storage.update(d => { d.settings.theme = next; });
    applyTheme();
    const labels = { auto: 'Tema automático (sistema)', light: 'Tema claro', dark: 'Tema escuro' };
    toast(labels[next], 'info');
  }

  function watchSystemTheme() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if ((Storage.get().settings.theme || 'auto') === 'auto') {
        applyTheme();
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  function updateUserUI() {
    const data = Storage.get();
    const name = data.user.name || 'Usuário';
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
    updateNotifBadge();
  }

  function updateNotifBadge() {
    const unread = Storage.get().notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (unread > 0) {
      badge.hidden = false;
      badge.textContent = unread > 9 ? '9+' : unread;
    } else {
      badge.hidden = true;
    }
  }

  function checkFirstAccess() {}

  const validPages = new Set(['dashboard','financas','calendario','carteira','caixinhas','metas','simulador','calculadoras','laboratorio','diagnostico','investimentos','historico','educacao','conquistas','configuracoes','mais']);
  function routeFromHash(){const v=location.hash.slice(1);return validPages.has(v)?v:'dashboard';}
  window.addEventListener('popstate',()=>navigate(routeFromHash(),false));
  function navigate(page,write=true) {
    if(!validPages.has(page)) page='dashboard';
    if(write && location.hash!=='#'+page) history.pushState(null,'','#'+page);
    window.scrollTo(0,0);

    if (page === 'mais') {
      currentPage=page; Charts.destroyAll(); closeSidebar(); document.getElementById('page-title').textContent='Mais opções'; document.querySelectorAll('.bottom-nav-item,.sidebar-nav .nav-item').forEach(e=>{e.classList.toggle('active',e.dataset.page==='mais');e.removeAttribute('aria-current')}); renderMoreMenu();
      return;
    }
    currentPage = page;
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
      if(el.dataset.page === page) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    });
    const titles = {
      laboratorio: 'Laboratório financeiro', diagnostico: 'Diagnóstico financeiro', financas: 'Minhas finanças', calendario: 'Calendário financeiro', carteira: 'Minha carteira', dashboard: 'Visão Geral', caixinhas: 'Minhas Caixinhas', metas: 'Metas',
      simulador: 'Simulador', calculadoras: 'Calculadoras', investimentos: 'Investimentos',
      historico: 'Histórico', educacao: 'Academia Seavora', conquistas: 'Conquistas',
      configuracoes: 'Configurações'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[page] || 'Seavora';
    closeSidebar();
    Charts.destroyAll();
    renderPage(page);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderPage(page) {
    const content = document.getElementById('content');
    content.innerHTML = '';
    const renderers = {
      laboratorio: Advanced.render, diagnostico: Diagnostics.render, financas: el => Money.render(el, "financas"), calendario: el => Money.render(el, "calendario"), carteira: el => Money.render(el, "carteira"), dashboard: renderDashboard, caixinhas: renderCaixinhas, metas: renderMetas,
      simulador: renderSimulador, calculadoras: renderCalculadoras, investimentos: renderInvestimentos,
      historico: renderHistorico, educacao: renderEducacao, conquistas: renderConquistas,
      configuracoes: renderConfiguracoes
    };
    (renderers[page] || renderDashboard)(content);
  }

  function renderMoreMenu() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="more-menu"><button class="nav-item" data-page="laboratorio">Laboratório financeiro</button><button class="nav-item" data-page="diagnostico">Diagnóstico financeiro</button><button class="nav-item" data-page="financas"><i data-lucide="wallet"></i><span>Minhas finanças</span></button><button class="nav-item" data-page="calendario"><i data-lucide="calendar-days"></i><span>Calendário financeiro</span></button><button class="nav-item" data-page="carteira"><i data-lucide="chart-pie"></i><span>Minha carteira</span></button>
        <button class="nav-item" data-page="calculadoras"><i data-lucide="calculator"></i><span>Calculadoras</span></button>
        <button class="nav-item" data-page="investimentos"><i data-lucide="trending-up"></i><span>Investimentos</span></button>
        <button class="nav-item" data-page="historico"><i data-lucide="history"></i><span>Histórico</span></button>
        <button class="nav-item" data-page="educacao"><i data-lucide="book-open"></i><span>Academia Seavora</span></button>
        <button class="nav-item" data-page="conquistas"><i data-lucide="trophy"></i><span>Conquistas</span></button>
        <button class="nav-item" data-page="configuracoes"><i data-lucide="settings"></i><span>Configurações</span></button>
      </div>`;
    content.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.page));
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderDashboard(el) {
    const data = Storage.get();
    const total = Caixinhas.totalBalance();
    const invested = Caixinhas.totalInvested();
    const yields = Caixinhas.totalYields();
    const monthAportes = Caixinhas.monthlyAportes();
    const completed = Caixinhas.completedGoals();
    const hasData = data.caixinhas.length > 0;
    const goals = Goals.getGoalsView();
    const nearGoal = goals.find(g => g.progress >= 70 && g.progress < 100);
    const bestProgress = goals.length ? goals.reduce((a, b) => a.progress > b.progress ? a : b) : null;

    // Insights
    const insights = [];
    if (monthAportes > 0) {
      insights.push({ icon: '📈', cls: 'green', title: Calculators.formatMoney(monthAportes), sub: 'Aportados este mês' });
    }
    if (nearGoal) {
      insights.push({ icon: '🎯', cls: 'purple', title: nearGoal.name, sub: `${nearGoal.progress.toFixed(0)}% — falta ${Calculators.formatMoney(nearGoal.goal - nearGoal.balance)}` });
    }
    if (completed > 0) {
      insights.push({ icon: '🎉', cls: 'green', title: `${completed} meta${completed > 1 ? 's' : ''}`, sub: 'Concluída(s)' });
    }
    if (yields > 0) {
      insights.push({ icon: '✨', cls: 'yellow', title: Calculators.formatMoney(yields), sub: 'Rendimentos registrados' });
    }
    if (hasData && insights.length === 0) {
      insights.push({ icon: '💪', cls: 'purple', title: 'Continue assim', sub: 'Faça um aporte hoje' });
    }

    el.innerHTML = `
      <div class="greeting">
        <h2>Olá${data.user.name ? ', ' + escapeHtml(data.user.name.split(' ')[0]) : ''}!</h2>
        <p>Organize, planeje e aprenda a fazer seu dinheiro evoluir.</p>
      </div>
      ${!hasData && !data.isDemo ? `
        <div class="card empty-state" style="margin-bottom:24px">
          <div class="empty-state-icon"><i data-lucide="sparkles" style="width:28px;height:28px"></i></div>
          <h3>Comece a organizar seu dinheiro</h3>
          <p>Crie sua primeira caixinha, defina uma meta e acompanhe a evolução do seu patrimônio.</p>
          <div class="flex gap-1" style="justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" id="btn-start">Começar</button>
            <button class="btn btn-secondary" id="btn-demo">Usar dados de demonstração</button>
          </div>
        </div>` : ''}
      <div class="hero-card">
        <div class="hero-label">SALDO DAS CAIXINHAS ${data.isDemo ? '<span class="demo-badge">Exemplo</span>' : ''}</div>
        <div class="hero-value anim-number" id="hero-value" data-money="1">${Calculators.formatMoney(0)}</div>
        <div class="hero-mini-stats">
          <div class="hero-mini-stat"><strong id="stat-caixinhas">${data.caixinhas.length}</strong> Caixinhas</div>
          <div class="hero-mini-stat"><strong>${completed}</strong> Metas ok</div>
          <div class="hero-mini-stat"><strong>${Calculators.formatMoney(monthAportes)}</strong> Este mês</div>
        </div>
        <div class="hero-actions">
          <button class="btn" id="btn-add-money"><i data-lucide="plus" style="width:16px;height:16px"></i> Adicionar dinheiro</button>
          <button class="btn" id="btn-new-caixinha"><i data-lucide="wallet" style="width:16px;height:16px"></i> Nova Caixinha</button>
        </div>
      </div>
      ${insights.length ? `
        <div class="insights-row">
          ${insights.map(i => `
            <div class="insight-chip">
              <div class="insight-chip-icon ${i.cls}">${i.icon}</div>
              <div><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.sub)}</span></div>
            </div>
          `).join('')}
        </div>` : ''}
      ${hasData ? `
        <div class="quick-actions">
          <button class="quick-action" id="qa-add"><i data-lucide="plus" style="width:14px;height:14px"></i> Aporte rápido</button>
          <button class="quick-action" id="qa-sim"><i data-lucide="line-chart" style="width:14px;height:14px"></i> Simular</button>
          <button class="quick-action" id="qa-calc"><i data-lucide="calculator" style="width:14px;height:14px"></i> Calculadoras</button>
          <button class="quick-action" id="qa-edu"><i data-lucide="book-open" style="width:14px;height:14px"></i> Aprender</button>
        </div>` : ''}
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Total investido</div><div class="stat-value anim-number" data-money="1" id="st-invested">${Calculators.formatMoney(0)}</div></div>
        <div class="stat-card"><div class="stat-label">Rendimentos</div><div class="stat-value positive anim-number" data-money="1" id="st-yields">${Calculators.formatMoney(0)}</div></div>
        <div class="stat-card"><div class="stat-label">Aportes deste mês</div><div class="stat-value anim-number" data-money="1" id="st-month">${Calculators.formatMoney(0)}</div></div>
        <div class="stat-card"><div class="stat-label">Metas concluídas</div><div class="stat-value anim-number" id="st-goals">0</div></div>
      </div>
      <div class="card chart-card">
        <div class="card-header">
          <div><div class="card-title">Evolução patrimonial</div><div class="card-subtitle">Atualizado conforme seus aportes</div></div>
          <div class="chart-periods">
            <button class="period-btn ${chartPeriod==='7d'?'active':''}" data-period="7d">7 dias</button>
            <button class="period-btn ${chartPeriod==='1m'?'active':''}" data-period="1m">1 mês</button>
            <button class="period-btn ${chartPeriod==='6m'?'active':''}" data-period="6m">6 meses</button>
            <button class="period-btn ${chartPeriod==='1y'?'active':''}" data-period="1y">1 ano</button>
            <button class="period-btn ${chartPeriod==='5y'?'active':''}" data-period="5y">5 anos</button>
          </div>
        </div>
        <div class="chart-container"><canvas id="chart-portfolio"></canvas></div>
      </div>
      ${hasData || data.isDemo ? `
        <div class="section-header">
          <h3 class="section-title">Suas Caixinhas</h3>
          <button class="btn btn-ghost btn-sm" id="btn-see-all-caixinhas">Ver todas</button>
        </div>
        <div class="caixinhas-grid" id="dash-caixinhas"></div>` : ''}
      ${hasData ? `
        <div class="card chart-card mt-2">
          <div class="card-title mb-1">Distribuição por categoria</div>
          <div class="chart-container" style="height:220px"><canvas id="chart-dist"></canvas></div>
        </div>` : ''}
      <div class="legal-footer">
        Este projeto é uma ferramenta educacional e de simulação. Os resultados apresentados são estimativas e não constituem recomendação de investimento. Rentabilidades passadas ou taxas utilizadas em simulações não garantem resultados futuros.<br>
        Os dados financeiros inseridos neste projeto são armazenados localmente no navegador.
      </div>`;

    if (hasData || data.isDemo) {
      const list = Caixinhas.getAll().slice(0, 4);
      const grid = document.getElementById('dash-caixinhas');
      if (grid) {
        grid.innerHTML = list.map(c => caixinhaCardHTML(c)).join('') || '<p class="text-muted">Nenhuma caixinha ainda.</p>';
        bindCaixinhaCards(grid);
      }
    }
    setTimeout(() => {
      Charts.portfolioChart('chart-portfolio', data.portfolioHistory, chartPeriod);
      if (hasData) Charts.distributionChart('chart-dist', data.caixinhas);
    }, 50);

    // Animate numbers
    setTimeout(() => {
      animateValue(document.getElementById('hero-value'), total);
      animateValue(document.getElementById('st-invested'), invested);
      animateValue(document.getElementById('st-yields'), yields);
      animateValue(document.getElementById('st-month'), monthAportes);
      animateValue(document.getElementById('st-goals'), completed, 500);
    }, 80);

    document.getElementById('btn-add-money')?.addEventListener('click', () => openAddMoneyModal());
    document.getElementById('btn-new-caixinha')?.addEventListener('click', () => openCreateCaixinhaModal());
    document.getElementById('btn-start')?.addEventListener('click', () => openCreateCaixinhaModal());
    document.getElementById('btn-demo')?.addEventListener('click', loadDemoData);
    document.getElementById('btn-see-all-caixinhas')?.addEventListener('click', () => navigate('caixinhas'));
    document.getElementById('qa-add')?.addEventListener('click', () => openAddMoneyModal());
    document.getElementById('qa-sim')?.addEventListener('click', () => navigate('simulador'));
    document.getElementById('qa-calc')?.addEventListener('click', () => navigate('calculadoras'));
    document.getElementById('qa-edu')?.addEventListener('click', () => navigate('educacao'));
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        chartPeriod = btn.dataset.period;
        document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b === btn));
        Charts.portfolioChart('chart-portfolio', Storage.get().portfolioHistory, chartPeriod);
      });
    });
  }

  function caixinhaCardHTML(c) {
    const progress = Caixinhas.getProgress(c);
    const projected = Caixinhas.getProjectedDate(c);
    const yieldEst = Caixinhas.getEstimatedYield(c, 12);
    return `
      <div class="caixinha-card" data-id="${escapeHtml(c.id)}">
        <div class="caixinha-header">
          <div class="caixinha-icon">${escapeHtml(c.icon || '💰')}</div>
          <div>
            <div class="caixinha-name">${escapeHtml(c.name)}</div>
            <div class="caixinha-category">${escapeHtml(c.category)}</div>
          </div>
        </div>
        <div class="caixinha-balance">${Calculators.formatMoney(c.balance)}</div>
        <div class="caixinha-goal">de ${Calculators.formatMoney(c.goal)}</div>
        <div class="progress-bar"><div class="progress-fill ${progress>=100?'complete':''}" style="width:${progress}%"></div></div>
        <div class="progress-text"><span>${progress.toFixed(0)}%</span><span>${progress >= 100 ? '🎉 Concluída!' : ''}</span></div>
        <div class="caixinha-meta">
          <span>Rend. est. 12m: ${Calculators.formatMoney(yieldEst)}</span>
          ${projected ? `<span>Previsão: ${projected.toLocaleDateString('pt-BR', {month:'2-digit', year:'numeric'})}</span>` : ''}
        </div>
        <div class="caixinha-actions">
          <button class="btn btn-primary btn-sm btn-add" data-id="${escapeHtml(c.id)}">Adicionar</button>
          <button class="btn btn-secondary btn-sm btn-withdraw" data-id="${escapeHtml(c.id)}">Retirar</button>
          <button class="btn btn-ghost btn-sm btn-detail" data-id="${escapeHtml(c.id)}">Detalhes</button>
        </div>
      </div>`;
  }

  function bindCaixinhaCards(container) {
    container.querySelectorAll('.btn-add').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openAddMoneyModal(btn.dataset.id); });
    });
    container.querySelectorAll('.btn-withdraw').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openWithdrawModal(btn.dataset.id); });
    });
    container.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openCaixinhaDetail(btn.dataset.id); });
    });
  }

  function renderCaixinhas(el) {
    let list = Caixinhas.getAll();
    el.innerHTML = `
      <div class="section-header">
        <h3 class="section-title">Minhas Caixinhas ${list.length ? `<span class="nav-badge" style="display:inline-flex;vertical-align:middle;margin-left:6px">${list.length}</span>` : ''}</h3>
        <button class="btn btn-primary" id="btn-create-c"><i data-lucide="plus" style="width:16px;height:16px"></i> Criar Caixinha</button>
      </div>
      ${list.length === 0 ? `
        <div class="card empty-state">
          <div class="empty-state-icon"><i data-lucide="wallet" style="width:28px;height:28px"></i></div>
          <h3>Nenhuma caixinha ainda</h3>
          <p>Crie caixinhas para organizar suas metas: viagem, reserva, tecnologia e muito mais.</p>
          <button class="btn btn-primary" id="btn-create-c2">Criar primeira Caixinha</button>
        </div>` : `
        <div class="toolbar">
          <div class="search-wrap">
            <i data-lucide="search"></i>
            <input type="search" class="search-input" id="cx-search" placeholder="Buscar caixinha..." autocomplete="off">
          </div>
          <select class="sort-select" id="cx-sort">
            <option value="recent">Mais recentes</option>
            <option value="balance">Maior saldo</option>
            <option value="progress">Maior progresso</option>
            <option value="name">Nome A–Z</option>
            <option value="goal">Maior objetivo</option>
          </select>
        </div>
        <div class="caixinhas-grid" id="caixinhas-list"></div>`}`;
    document.getElementById('btn-create-c')?.addEventListener('click', () => openCreateCaixinhaModal());
    document.getElementById('btn-create-c2')?.addEventListener('click', () => openCreateCaixinhaModal());

    function applyFilterSort() {
      const q = (document.getElementById('cx-search')?.value || '').toLowerCase().trim();
      const sort = document.getElementById('cx-sort')?.value || 'recent';
      let filtered = Caixinhas.getAll().filter(c =>
        !q || c.name.toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q)
      );
      if (sort === 'balance') filtered.sort((a, b) => b.balance - a.balance);
      else if (sort === 'progress') filtered.sort((a, b) => Caixinhas.getProgress(b) - Caixinhas.getProgress(a));
      else if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      else if (sort === 'goal') filtered.sort((a, b) => b.goal - a.goal);
      else filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const grid = document.getElementById('caixinhas-list');
      if (!grid) return;
      grid.innerHTML = filtered.length
        ? filtered.map(c => caixinhaCardHTML(c)).join('')
        : '<div class="empty-state" style="grid-column:1/-1"><p class="text-muted">Nenhuma caixinha encontrada.</p></div>';
      bindCaixinhaCards(grid);
    }

    if (list.length) {
      applyFilterSort();
      document.getElementById('cx-search')?.addEventListener('input', applyFilterSort);
      document.getElementById('cx-sort')?.addEventListener('change', applyFilterSort);
    }
  }

  function renderMetas(el) {
    const goals = Goals.getGoalsView();
    el.innerHTML = `
      <div class="section-header">
        <h3 class="section-title">Metas financeiras</h3>
        <button class="btn btn-primary btn-sm" id="btn-new-meta">Nova meta</button>
      </div>
      ${goals.length === 0 ? `
        <div class="card empty-state">
          <div class="empty-state-icon"><i data-lucide="target" style="width:28px;height:28px"></i></div>
          <h3>Nenhuma meta definida</h3>
          <p>Crie uma caixinha com objetivo para acompanhar o progresso aqui.</p>
          <button class="btn btn-primary" id="btn-new-meta2">Criar meta</button>
        </div>` : goals.map(g => {
          const r = 20;
          const circ = 2 * Math.PI * r;
          const offset = circ - (Math.min(100, g.progress) / 100) * circ;
          return `
        <div class="card mb-2">
          <div class="meta-card-top">
            <div class="ring-wrap">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle class="ring-bg" cx="24" cy="24" r="${r}"></circle>
                <circle class="ring-fill" cx="24" cy="24" r="${r}"
                  stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
                  style="stroke:${g.completed ? 'var(--green-500)' : 'var(--primary)'}"></circle>
              </svg>
              <div class="ring-text">${g.progress.toFixed(0)}%</div>
            </div>
            <div style="flex:1">
              <div class="card-title">${escapeHtml(g.icon)} ${escapeHtml(g.name)} ${g.completed ? '🎉' : ''}</div>
              <div class="card-subtitle">${escapeHtml(g.category)}</div>
            </div>
            <div style="text-align:right">
              <div class="font-mono" style="font-weight:700;font-size:1.05rem">${Calculators.formatMoney(g.balance)}</div>
              <div class="text-muted" style="font-size:0.8rem">de ${Calculators.formatMoney(g.goal)}</div>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill ${g.completed?'complete':''}" style="width:${g.progress}%"></div></div>
          <div class="progress-text mt-1">
            <span>Aporte mensal: ${Calculators.formatMoney(g.monthlyContribution)}</span>
            <span>Previsão: ${isFinite(g.monthsLeft) ? Calculators.formatMonths(g.monthsLeft) : '—'}</span>
          </div>
          ${g.completed ? '<div class="celebration mt-2"><div class="celebration-emoji">🎉</div><strong>META CONCLUÍDA!</strong></div>' : ''}
        </div>`;
        }).join('')}`;
    document.getElementById('btn-new-meta')?.addEventListener('click', () => openCreateCaixinhaModal());
    document.getElementById('btn-new-meta2')?.addEventListener('click', () => openCreateCaixinhaModal());
  }

  function renderSimulador(el) {
    const settings = Storage.get().settings;
    el.innerHTML = `
      <div class="tabs" id="sim-tabs">
        <button class="tab active" data-tab="planner">Aportes variáveis</button>
        <button class="tab" data-tab="invest">Simule seu dinheiro</button>
        <button class="tab" data-tab="compare">Comparador</button>
        <button class="tab" data-tab="turbo">Caixinha Turbo (CDI)</button>
        <button class="tab" data-tab="yield">Quanto rende?</button>
        <button class="tab" data-tab="retire">Longo prazo</button>
      </div>
      <div id="sim-content"></div>
      <div class="legal-footer mt-2">Todas as taxas e resultados são parâmetros de simulação para fins educacionais. Produtos reais têm condições, riscos e tributação que variam.</div>`;
    const tabs = el.querySelectorAll('.tab');
    const content = document.getElementById('sim-content');
    function showTab(tab) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      if (tab === 'planner') Planner.render(content, settings);
      else if (tab === 'invest') renderSimInvest(content, settings);
      else if (tab === 'compare') renderSimCompare(content, settings);
      else if (tab === 'turbo') renderSimTurbo(content, settings);
      else if (tab === 'yield') renderSimYield(content, settings);
      else if (tab === 'retire') renderSimRetire(content, settings);
    }
    tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
    showTab('planner');
  }

  function renderSimInvest(el, settings) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title mb-2">Simule seu dinheiro</div>
        <p class="text-muted mb-2" style="font-size:0.85rem">Compare cenários de renda fixa e variável. Ajuste as taxas — são apenas simulações.</p>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Tipo de investimento</label>
            <select class="form-select" id="sim-type">
              <option value="caixinha">Caixinha / RDB</option><option value="cdb">CDB</option>
              <option value="tesouro">Tesouro Selic</option><option value="poupanca">Poupança</option>
              <option value="etf">ETF (hipotético)</option><option value="fundo">Fundo de investimento</option>
              <option value="acoes">Ações (hipotético)</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Taxa (% CDI ou a.a.)</label>
            <input type="number" class="form-input" id="sim-rate" value="100" step="1">
            <div class="form-hint">Para CDI: 100 = 100% CDI. Para outros: taxa anual estimada.</div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">CDI estimado (% a.a.)</label>
            <input type="number" class="form-input" id="sim-cdi" value="${settings.cdiRate}" step="0.01"></div>
          <div class="form-group"><label class="form-label">Valor inicial (R$)</label>
            <input type="text" class="form-input input-money" id="sim-principal" value="1.000,00"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Aporte mensal (R$)</label>
            <input type="text" class="form-input input-money" id="sim-monthly" value="300,00"></div>
          <div class="form-group"><label class="form-label">Período (meses)</label>
            <input type="number" class="form-input" id="sim-months" value="36" min="1" max="600"></div>
        </div>
        <div class="form-group"><label class="form-label"><input type="checkbox" id="sim-tax"> Considerar impostos (estimativa educacional)</label></div>
        <button class="btn btn-primary" id="sim-run">Simular</button>
        <div id="sim-result"></div>
      </div>`;
    bindMoneyInputs(el);
    document.getElementById('sim-run').addEventListener('click', () => {
      const type = document.getElementById('sim-type').value;
      const rateInput = parseFloat(document.getElementById('sim-rate').value) || 0;
      const cdi = parseFloat(document.getElementById('sim-cdi').value) || 13.15;
      const principal = Calculators.parseMoney(document.getElementById('sim-principal').value);
      const monthly = Calculators.parseMoney(document.getElementById('sim-monthly').value);
      const months = parseInt(document.getElementById('sim-months').value) || 12;
      const useTax = document.getElementById('sim-tax').checked;
      let annualRate = rateInput;
      const isCdiBased = ['caixinha', 'cdb', 'tesouro', 'poupanca'].includes(type);
      if (isCdiBased) {
        const pct = type === 'poupanca' ? 70 : rateInput;
        annualRate = (pct / 100) * cdi;
      }
      const fv = Calculators.futureValue(principal, monthly, annualRate, months);
      const invested = principal + monthly * months;
      const grossYield = fv - invested;
      let tax = 0;
      if (useTax && !['etf', 'acoes'].includes(type)) tax = Calculators.estimateIR(grossYield, months * 30);
      const net = fv - tax;
      const riskMap = { caixinha: 'Baixo', cdb: 'Baixo', tesouro: 'Baixo', poupanca: 'Baixo', etf: 'Moderado/Alto', fundo: 'Variável', acoes: 'Alto' };
      const typeMap = { caixinha: 'Renda Fixa', cdb: 'Renda Fixa', tesouro: 'Renda Fixa', poupanca: 'Renda Fixa', etf: 'Renda Variável', fundo: 'Coletivo', acoes: 'Renda Variável' };
      document.getElementById('sim-result').innerHTML = `
        <div class="result-box">
          <div class="result-label">Valor final estimado (líquido)</div>
          <div class="result-value">${Calculators.formatMoney(net)}</div>
          <div class="result-details">
            <div class="result-detail"><div class="result-detail-label">Investido</div><div class="result-detail-value">${Calculators.formatMoney(invested)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Rendimento bruto</div><div class="result-detail-value text-green">${Calculators.formatMoney(grossYield)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Impostos est.</div><div class="result-detail-value">${Calculators.formatMoney(tax)}</div></div>
          </div>
          <p class="form-hint mt-2">Tipo: ${typeMap[type]} · Risco: ${riskMap[type]} · Taxa efetiva usada: ${annualRate.toFixed(2)}% a.a. (simulação)</p>
        </div>
        <div class="chart-container mt-2" style="height:220px"><canvas id="chart-sim"></canvas></div>`;
      const table = Calculators.compoundTable(principal, monthly, annualRate, Math.min(months, 120));
      Charts.compoundChart('chart-sim', table);
    });
  }

  function renderSimCompare(el, settings) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title mb-2">Compare seus investimentos</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Valor inicial</label><input type="text" class="form-input input-money" id="cmp-p" value="5.000,00"></div>
          <div class="form-group"><label class="form-label">Aporte mensal</label><input type="text" class="form-input input-money" id="cmp-m" value="500,00"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Período (meses)</label><input type="number" class="form-input" id="cmp-months" value="24"></div>
          <div class="form-group"><label class="form-label">CDI estimado (% a.a.)</label><input type="number" class="form-input" id="cmp-cdi" value="${settings.cdiRate}"></div>
        </div>
        <button class="btn btn-primary" id="cmp-run">Comparar</button>
        <div id="cmp-result" class="mt-2"></div>
      </div>`;
    bindMoneyInputs(el);
    document.getElementById('cmp-run').addEventListener('click', () => {
      const p = Calculators.parseMoney(document.getElementById('cmp-p').value);
      const m = Calculators.parseMoney(document.getElementById('cmp-m').value);
      const months = parseInt(document.getElementById('cmp-months').value) || 24;
      const cdi = parseFloat(document.getElementById('cmp-cdi').value) || 13.15;
      const scenarios = [
        { name: 'Caixinha 100% CDI', annualRate: cdi, applyIR: true, risk: 'Baixo', liquidity: 'Conforme produto' },
        { name: 'Poupança ~70% CDI', annualRate: cdi * 0.7, applyIR: false, risk: 'Baixo', liquidity: 'Diária' },
        { name: 'CDB 110% CDI', annualRate: cdi * 1.1, applyIR: true, risk: 'Baixo', liquidity: 'Varia' },
        { name: 'Tesouro Selic', annualRate: cdi * 0.98, applyIR: true, risk: 'Baixo', liquidity: 'D+1' }
      ];
      const results = Calculators.compareInvestments(p, m, months, scenarios);
      document.getElementById('cmp-result').innerHTML = `
        <div style="overflow-x:auto"><table class="compare-table">
          <thead><tr><th>Investimento</th><th>Investido</th><th>Rend. bruto</th><th>IR est.</th><th>Líquido</th><th>Risco</th><th>Liquidez</th></tr></thead>
          <tbody>${results.map(r => `<tr>
            <td><strong>${r.name}</strong></td><td>${Calculators.formatMoney(r.invested)}</td>
            <td class="text-green">${Calculators.formatMoney(r.yield)}</td><td>${Calculators.formatMoney(r.tax)}</td>
            <td><strong>${Calculators.formatMoney(r.net)}</strong></td><td>${r.risk}</td><td>${r.liquidity}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <div class="chart-container mt-2" style="height:240px"><canvas id="chart-cmp"></canvas></div>
        <p class="form-hint mt-1">Estimativas educacionais. Tributação e condições reais variam.</p>`;
      Charts.comparisonChart('chart-cmp', results);
    });
  }

  function renderSimTurbo(el, settings) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title mb-2">Caixinha Turbo — diferença de % do CDI</div>
        <p class="text-muted mb-2" style="font-size:0.85rem">Compare 100%, 115% e 120% do CDI. Parâmetros de simulação apenas.</p>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Valor inicial</label><input type="text" class="form-input input-money" id="turbo-p" value="1.000,00"></div>
          <div class="form-group"><label class="form-label">Aporte mensal</label><input type="text" class="form-input input-money" id="turbo-m" value="300,00"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Tempo (meses)</label><input type="number" class="form-input" id="turbo-months" value="24"></div>
          <div class="form-group"><label class="form-label">CDI (% a.a.)</label><input type="number" class="form-input" id="turbo-cdi" value="${settings.cdiRate}"></div>
        </div>
        <button class="btn btn-primary" id="turbo-run">Calcular diferença</button>
        <div id="turbo-result" class="mt-2"></div>
      </div>`;
    bindMoneyInputs(el);
    document.getElementById('turbo-run').addEventListener('click', () => {
      const p = Calculators.parseMoney(document.getElementById('turbo-p').value);
      const m = Calculators.parseMoney(document.getElementById('turbo-m').value);
      const months = parseInt(document.getElementById('turbo-months').value) || 24;
      const cdi = parseFloat(document.getElementById('turbo-cdi').value) || 13.15;
      const rates = [100, 115, 120];
      const results = rates.map(pct => {
        const annual = (pct / 100) * cdi;
        return { pct, fv: Calculators.futureValue(p, m, annual, months), annual };
      });
      const base = results[0].fv;
      document.getElementById('turbo-result').innerHTML = `
        <div class="result-details" style="grid-template-columns:repeat(3,1fr)">
          ${results.map(r => `<div class="result-box" style="margin:0">
            <div class="result-label">${r.pct}% CDI</div>
            <div class="result-value" style="font-size:1.25rem">${Calculators.formatMoney(r.fv)}</div>
            <div class="form-hint">${r.annual.toFixed(2)}% a.a.</div>
            ${r.pct > 100 ? `<div class="text-green" style="font-size:0.85rem;margin-top:6px">+${Calculators.formatMoney(r.fv - base)}</div>` : ''}
          </div>`).join('')}
        </div>
        <p class="form-hint mt-2">A disponibilidade e condições de produtos reais com esses percentuais podem mudar. Simulação educacional.</p>`;
    });
  }

  function renderSimYield(el, settings) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title mb-2">Quanto meu dinheiro rende?</div>
        <div class="form-group">
          <label class="form-label">Valor</label>
          <div class="flex gap-1" style="flex-wrap:wrap">
            ${[1000,5000,10000,50000,100000].map(v => `<button class="btn btn-secondary btn-sm yield-preset" data-v="${v}">${Calculators.formatMoney(v)}</button>`).join('')}
          </div>
          <input type="text" class="form-input input-money mt-1" id="yield-amount" value="10.000,00">
        </div>
        <div class="form-group">
          <label class="form-label">Taxa de simulação</label>
          <select class="form-select" id="yield-rate-type">
            <option value="100">100% CDI</option><option value="115">115% CDI</option>
            <option value="120">120% CDI</option><option value="poupanca">Poupança (~70% CDI)</option>
            <option value="custom">Taxa personalizada (% a.a.)</option>
          </select>
        </div>
        <div class="form-group" id="yield-custom-wrap" hidden>
          <label class="form-label">Taxa anual (%)</label>
          <input type="number" class="form-input" id="yield-custom" value="12" step="0.1">
        </div>
        <div class="form-group">
          <label class="form-label">CDI estimado (% a.a.)</label>
          <input type="number" class="form-input" id="yield-cdi" value="${settings.cdiRate}">
        </div>
        <button class="btn btn-primary" id="yield-run">Calcular</button>
        <div id="yield-result" class="mt-2"></div>
      </div>`;
    bindMoneyInputs(el);
    el.querySelectorAll('.yield-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('yield-amount').value = formatInputMoney(parseFloat(btn.dataset.v));
      });
    });
    document.getElementById('yield-rate-type').addEventListener('change', (e) => {
      document.getElementById('yield-custom-wrap').hidden = e.target.value !== 'custom';
    });
    document.getElementById('yield-run').addEventListener('click', () => {
      const amount = Calculators.parseMoney(document.getElementById('yield-amount').value);
      const type = document.getElementById('yield-rate-type').value;
      const cdi = parseFloat(document.getElementById('yield-cdi').value) || 13.15;
      let annual = cdi;
      if (type === '100') annual = cdi;
      else if (type === '115') annual = cdi * 1.15;
      else if (type === '120') annual = cdi * 1.2;
      else if (type === 'poupanca') annual = cdi * 0.7;
      else annual = parseFloat(document.getElementById('yield-custom').value) || 0;
      const br = Calculators.yieldBreakdown(amount, annual);
      const irMonth = Calculators.estimateIR(br.monthly, 30);
      document.getElementById('yield-result').innerHTML = `
        <div class="result-box">
          <div class="result-label">Estimativa sobre ${Calculators.formatMoney(amount)} a ${annual.toFixed(2)}% a.a.</div>
          <div class="result-details" style="margin-top:12px">
            <div class="result-detail"><div class="result-detail-label">Por dia útil (aprox.)</div><div class="result-detail-value">${Calculators.formatMoney(br.daily)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Por mês (bruto)</div><div class="result-detail-value">${Calculators.formatMoney(br.monthly)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Por ano (bruto)</div><div class="result-detail-value">${Calculators.formatMoney(br.yearly)}</div></div>
          </div>
          <p class="form-hint mt-2">IR estimado (mês, alíquota curta): ${Calculators.formatMoney(irMonth)} · Líquido mensal ~ ${Calculators.formatMoney(br.monthly - irMonth)}</p>
          <p class="form-hint">Simulação educacional. Dias úteis ≈ 252/ano. Tributação real depende do produto e do prazo.</p>
        </div>`;
    });
  }

  function renderSimRetire(el, settings) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title mb-2">Quanto posso acumular no longo prazo?</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Idade atual</label><input type="number" class="form-input" id="ret-age" value="25" min="18" max="80"></div>
          <div class="form-group"><label class="form-label">Idade objetivo</label><input type="number" class="form-input" id="ret-target" value="60" min="25" max="100"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Patrimônio atual (R$)</label><input type="text" class="form-input input-money" id="ret-wealth" value="5.000,00"></div>
          <div class="form-group"><label class="form-label">Aporte mensal (R$)</label><input type="text" class="form-input input-money" id="ret-monthly" value="500,00"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Rentabilidade anual estimada (%)</label>
          <input type="number" class="form-input" id="ret-rate" value="${settings.cdiRate}" step="0.1">
          <div class="form-hint">Taxa de simulação. Renda variável historicamente pode ser maior — com mais risco.</div>
        </div>
        <button class="btn btn-primary" id="ret-run">Projetar</button>
        <div id="ret-result" class="mt-2"></div>
      </div>`;
    bindMoneyInputs(el);
    document.getElementById('ret-run').addEventListener('click', () => {
      const age = parseInt(document.getElementById('ret-age').value) || 25;
      const target = parseInt(document.getElementById('ret-target').value) || 60;
      const wealth = Calculators.parseMoney(document.getElementById('ret-wealth').value);
      const monthly = Calculators.parseMoney(document.getElementById('ret-monthly').value);
      const rate = parseFloat(document.getElementById('ret-rate').value) || 10;
      if (target <= age) { toast('Idade objetivo deve ser maior que a atual', 'error'); return; }
      const points = Calculators.retirementProjection(age, target, wealth, monthly, rate);
      const final = points[points.length - 1];
      document.getElementById('ret-result').innerHTML = `
        <div class="result-box">
          <div class="result-label">Patrimônio projetado aos ${target} anos</div>
          <div class="result-value">${Calculators.formatMoney(final.value)}</div>
        </div>
        <div class="chart-container mt-2" style="height:240px"><canvas id="chart-ret"></canvas></div>
        <div class="mt-2">${points.map(p => `<div class="flex justify-between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span>Aos ${p.age}</span><strong>${Calculators.formatMoney(p.value)}</strong></div>`).join('')}</div>
        <p class="form-hint mt-2">Projeção educacional com juros compostos e aportes constantes. Não é garantia de resultado.</p>`;
      Charts.retirementChart('chart-ret', points);
    });
  }

  function renderCalculadoras(el) {
    el.innerHTML = `
      <div class="tabs" id="calc-tabs">
        <button class="tab active" data-tab="goal">Quando atingirei a meta?</button>
        <button class="tab" data-tab="required">Quanto investir/mês?</button>
        <button class="tab" data-tab="compound">Juros compostos</button>
        <button class="tab" data-tab="emergency">Reserva de emergência</button>
      </div>
      <div id="calc-content"></div>`;
    const tabs = el.querySelectorAll('.tab');
    const content = document.getElementById('calc-content');
    function show(tab) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      if (tab === 'goal') renderCalcGoal(content);
      else if (tab === 'required') renderCalcRequired(content);
      else if (tab === 'compound') renderCalcCompound(content);
      else if (tab === 'emergency') renderCalcEmergency(content);
    }
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
    show('goal');
  }

  function renderCalcGoal(el) {
    const cdi = Storage.get().settings.cdiRate;
    el.innerHTML = `
      <div class="card">
        <div class="card-title mb-2">Quando vou atingir minha meta?</div>
        <div class="form-group"><label class="form-label">Quanto já tenho?</label><input type="text" class="form-input input-money" id="g-current" value="1.000,00"></div>
        <div class="form-group"><label class="form-label">Quanto quero alcançar?</label><input type="text" class="form-input input-money" id="g-goal" value="20.000,00"></div>
        <div class="form-group"><label class="form-label">Quanto consigo investir por mês?</label><input type="text" class="form-input input-money" id="g-monthly" value="500,00"></div>
        <div class="form-group"><label class="form-label">Rentabilidade anual estimada (%)</label><input type="number" class="form-input" id="g-rate" value="${cdi}" step="0.1"><div class="form-hint">Taxa de simulação</div></div>
        <button class="btn btn-primary" id="g-run">Calcular</button>
        <div id="g-result"></div>
      </div>`;
    bindMoneyInputs(el);
    document.getElementById('g-run').addEventListener('click', () => {
      const current = Calculators.parseMoney(document.getElementById('g-current').value);
      const goal = Calculators.parseMoney(document.getElementById('g-goal').value);
      const monthly = Calculators.parseMoney(document.getElementById('g-monthly').value);
      const rate = parseFloat(document.getElementById('g-rate').value) || 0;
      const months = Calculators.monthsToGoal(current, goal, monthly, rate);
      const fv = Calculators.futureValue(current, monthly, rate, isFinite(months) ? months : 0);
      const invested = current + monthly * (isFinite(months) ? months : 0);
      document.getElementById('g-result').innerHTML = `
        <div class="result-box">
          <div class="result-label">Você poderá alcançar sua meta aproximadamente em:</div>
          <div class="result-value">${Calculators.formatMonths(months)}</div>
          <div class="result-details">
            <div class="result-detail"><div class="result-detail-label">Total aportado</div><div class="result-detail-value">${Calculators.formatMoney(invested)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Rendimento acum.</div><div class="result-detail-value text-green">${Calculators.formatMoney(fv - invested)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Valor final</div><div class="result-detail-value">${Calculators.formatMoney(fv)}</div></div>
          </div>
        </div>
        ${isFinite(months) && months > 0 ? `<div class="chart-container mt-2" style="height:220px"><canvas id="chart-goal"></canvas></div>` : ''}`;
      if (isFinite(months) && months > 0) {
        const table = Calculators.compoundTable(current, monthly, rate, Math.min(months, 120));
        Charts.compoundChart('chart-goal', table);
      }
    });
  }

  function renderCalcRequired(el) {
    const cdi = Storage.get().settings.cdiRate;
    el.innerHTML = `
      <div class="card">
        <div class="card-title mb-2">Quanto preciso investir por mês?</div>
        <div class="form-group"><label class="form-label">Valor atual</label><input type="text" class="form-input input-money" id="r-current" value="1.000,00"></div>
        <div class="form-group"><label class="form-label">Meta</label><input type="text" class="form-input input-money" id="r-goal" value="20.000,00"></div>
        <div class="form-group"><label class="form-label">Prazo (meses)</label><input type="number" class="form-input" id="r-months" value="24"></div>
        <div class="form-group"><label class="form-label">Rentabilidade anual estimada (%)</label><input type="number" class="form-input" id="r-rate" value="${cdi}" step="0.1"></div>
        <button class="btn btn-primary" id="r-run">Calcular</button>
        <div id="r-result"></div>
      </div>`;
    bindMoneyInputs(el);
    document.getElementById('r-run').addEventListener('click', () => {
      const current = Calculators.parseMoney(document.getElementById('r-current').value);
      const goal = Calculators.parseMoney(document.getElementById('r-goal').value);
      const months = parseInt(document.getElementById('r-months').value) || 1;
      const rate = parseFloat(document.getElementById('r-rate').value) || 0;
      const pmt = Calculators.requiredMonthly(current, goal, months, rate);
      document.getElementById('r-result').innerHTML = `
        <div class="result-box">
          <div class="result-label">Você precisa investir aproximadamente:</div>
          <div class="result-value">${Calculators.formatMoney(pmt)}/mês</div>
          <p class="form-hint mt-1">Para atingir ${Calculators.formatMoney(goal)} em ${months} meses a ${rate}% a.a. (simulação)</p>
        </div>`;
    });
  }

  function renderCalcCompound(el) {
    const cdi = Storage.get().settings.cdiRate;
    el.innerHTML = `
      <div class="card">
        <div class="card-title mb-2">Calculadora de juros compostos</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Investimento inicial</label><input type="text" class="form-input input-money" id="c-principal" value="1.000,00"></div>
          <div class="form-group"><label class="form-label">Aporte mensal</label><input type="text" class="form-input input-money" id="c-monthly" value="300,00"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Taxa de juros (% a.a.)</label><input type="number" class="form-input" id="c-rate" value="${cdi}" step="0.1"></div>
          <div class="form-group"><label class="form-label">Período (meses)</label><input type="number" class="form-input" id="c-months" value="60"></div>
        </div>
        <button class="btn btn-primary" id="c-run">Calcular</button>
        <div id="c-result"></div>
      </div>`;
    bindMoneyInputs(el);
    document.getElementById('c-run').addEventListener('click', () => {
      const principal = Calculators.parseMoney(document.getElementById('c-principal').value);
      const monthly = Calculators.parseMoney(document.getElementById('c-monthly').value);
      const rate = parseFloat(document.getElementById('c-rate').value) || 0;
      const months = parseInt(document.getElementById('c-months').value) || 1;
      const fv = Calculators.futureValue(principal, monthly, rate, months);
      const invested = principal + monthly * months;
      const interest = fv - invested;
      document.getElementById('c-result').innerHTML = `
        <div class="result-box">
          <div class="result-details">
            <div class="result-detail"><div class="result-detail-label">Valor investido</div><div class="result-detail-value">${Calculators.formatMoney(invested)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Juros</div><div class="result-detail-value text-green">${Calculators.formatMoney(interest)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Valor final</div><div class="result-detail-value">${Calculators.formatMoney(fv)}</div></div>
          </div>
        </div>
        <div class="chart-container mt-2" style="height:240px"><canvas id="chart-compound"></canvas></div>`;
      const table = Calculators.compoundTable(principal, monthly, rate, Math.min(months, 120));
      Charts.compoundChart('chart-compound', table);
    });
  }

  function renderCalcEmergency(el) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title mb-2">Quanto deveria ter na minha reserva?</div>
        <div class="form-group"><label class="form-label">Gastos mensais (R$)</label><input type="text" class="form-input input-money" id="e-expenses" value="3.000,00"></div>
        <div class="form-group">
          <label class="form-label">Quantidade de meses</label>
          <div class="flex gap-1">${[3,6,9,12].map(m => `<button class="btn btn-secondary btn-sm e-months" data-m="${m}">${m} meses</button>`).join('')}</div>
          <input type="number" class="form-input mt-1" id="e-months" value="6" min="1" max="24">
        </div>
        <div class="form-group"><label class="form-label">Reserva atual (R$)</label><input type="text" class="form-input input-money" id="e-current" value="0,00"></div>
        <button class="btn btn-primary" id="e-run">Calcular</button>
        <div id="e-result"></div>
      </div>`;
    bindMoneyInputs(el);
    el.querySelectorAll('.e-months').forEach(btn => {
      btn.addEventListener('click', () => { document.getElementById('e-months').value = btn.dataset.m; });
    });
    document.getElementById('e-run').addEventListener('click', () => {
      const expenses = Calculators.parseMoney(document.getElementById('e-expenses').value);
      const months = parseInt(document.getElementById('e-months').value) || 6;
      const current = Calculators.parseMoney(document.getElementById('e-current').value);
      const recommended = Calculators.emergencyFund(expenses, months);
      const lack = Math.max(0, recommended - current);
      const pct = recommended > 0 ? Math.min(100, (current / recommended) * 100) : 0;
      document.getElementById('e-result').innerHTML = `
        <div class="result-box">
          <div class="result-label">Reserva recomendada</div>
          <div class="result-value">${Calculators.formatMoney(recommended)}</div>
          <div class="result-details">
            <div class="result-detail"><div class="result-detail-label">Reserva atual</div><div class="result-detail-value">${Calculators.formatMoney(current)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Falta</div><div class="result-detail-value text-red">${Calculators.formatMoney(lack)}</div></div>
            <div class="result-detail"><div class="result-detail-label">Progresso</div><div class="result-detail-value">${pct.toFixed(0)}%</div></div>
          </div>
          <div class="progress-bar mt-2"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>`;
    });
  }

  function renderInvestimentos(el) {
    el.innerHTML = `
      <div class="tabs">
        <button class="tab active" data-tab="produtos">Produtos</button>
        <button class="tab" data-tab="perfil">Perfil de investidor</button>
      </div>
      <div id="inv-content"></div>
      <div class="legal-footer">Conteúdo educacional. Não constitui recomendação de investimento. Avalie seu perfil e, se necessário, busque orientação profissional.</div>`;
    const tabs = el.querySelectorAll('.tab');
    const content = document.getElementById('inv-content');
    function show(tab) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      if (tab === 'produtos') {
        content.innerHTML = `
          <div class="mb-2">
            <span class="risk-badge risk-low">🟢 Começando</span>
            <span class="risk-badge risk-mid" style="margin-left:6px">🟡 Intermediário</span>
            <span class="risk-badge risk-high" style="margin-left:6px">🔴 Maior risco</span>
          </div>
          <div class="invest-grid">
            ${Investments.PRODUCTS.map(p => `
              <div class="invest-card" data-id="${p.id}">
                <div class="flex justify-between items-center mb-1">
                  <strong>${p.name}</strong>
                  <span class="risk-badge risk-${p.risk}">${p.riskLabel}</span>
                </div>
                <div class="text-muted" style="font-size:0.8rem">${p.type} · ${p.liquidity}</div>
                <p style="font-size:0.85rem;margin-top:8px;color:var(--text-secondary)">${p.what.slice(0, 100)}...</p>
              </div>`).join('')}
          </div>`;
        content.querySelectorAll('.invest-card').forEach(card => {
          card.addEventListener('click', () => openProductModal(card.dataset.id));
        });
      } else {
        renderQuiz(content);
      }
    }
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
    show('produtos');
  }

  function renderQuiz(el) {
    let step = 0;
    let scores = [];
    function renderStep() {
      if (step >= Investments.QUIZ.length) {
        const total = scores.reduce((a, b) => a + b, 0);
        const profile = Investments.profileFromScore(total);
        el.innerHTML = `
          <div class="card text-center">
            <div style="font-size:3rem;margin-bottom:12px">🧭</div>
            <h3>Seu perfil sugerido: ${profile.name}</h3>
            <p style="color:var(--text-secondary);margin:12px 0;max-width:400px;margin-left:auto;margin-right:auto">${profile.desc}</p>
            <p class="form-hint">Isto não é recomendação financeira profissional. Use como ponto de partida para reflexão.</p>
            <button class="btn btn-secondary mt-2" id="quiz-restart">Refazer quiz</button>
          </div>`;
        document.getElementById('quiz-restart').addEventListener('click', () => { step = 0; scores = []; renderStep(); });
        return;
      }
      const q = Investments.QUIZ[step];
      el.innerHTML = `
        <div class="card">
          <div class="card-subtitle">Pergunta ${step + 1} de ${Investments.QUIZ.length}</div>
          <div class="quiz-question">
            <h3 style="margin:12px 0">${q.q}</h3>
            <div class="quiz-options">
              ${q.options.map(o => `<button class="quiz-option" data-score="${o.score}">${o.text}</button>`).join('')}
            </div>
          </div>
        </div>`;
      el.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', () => {
          scores.push(parseInt(btn.dataset.score));
          step++;
          renderStep();
        });
      });
    }
    renderStep();
  }

  function openProductModal(id) {
    const p = Investments.PRODUCTS.find(x => x.id === id);
    if (!p) return;
    openModal(`
      <div class="modal-header">
        <h2>${p.name}</h2>
        <button class="btn-icon modal-close" aria-label="Fechar"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <span class="risk-badge risk-${p.risk}">${p.riskLabel}</span>
        <span class="text-muted" style="margin-left:8px;font-size:0.85rem">${p.type}</span>
        <h4 style="margin-top:16px;margin-bottom:6px">O que é?</h4>
        <p style="font-size:0.9rem;color:var(--text-secondary)">${p.what}</p>
        <h4 style="margin-top:14px;margin-bottom:6px">Como funciona?</h4>
        <p style="font-size:0.9rem;color:var(--text-secondary)">${p.how}</p>
        <h4 style="margin-top:14px;margin-bottom:6px">Qual o risco?</h4>
        <p style="font-size:0.9rem;color:var(--text-secondary)">${p.riskLabel} — ${p.type}</p>
        <h4 style="margin-top:14px;margin-bottom:6px">Qual a liquidez?</h4>
        <p style="font-size:0.9rem;color:var(--text-secondary)">${p.liquidity}</p>
        <h4 style="margin-top:14px;margin-bottom:6px">Para quem pode fazer sentido?</h4>
        <p style="font-size:0.9rem;color:var(--text-secondary)">${p.forWhom}</p>
        <h4 style="margin-top:14px;margin-bottom:6px">Exemplo prático</h4>
        <p style="font-size:0.9rem;color:var(--text-secondary)">${p.example}</p>
        <p class="form-hint mt-2">${p.defaultRateNote}</p>
      </div>`);
  }

  function renderHistorico(el) {
    const txs = Storage.get().transactions;
    let filter = 'all';
    function renderList() {
      const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter || (filter === 'aporte' && t.type === 'transferencia'));
      const listEl = document.getElementById('history-list');
      if (!listEl) return;
      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p class="text-muted">Nenhuma movimentação encontrada.</p></div>';
        return;
      }
      listEl.innerHTML = filtered.map(t => {
        const c = Caixinhas.getById(t.caixinhaId);
        const isNeg = t.type === 'resgate';
        const iconClass = t.type === 'aporte' || t.type === 'transferencia' ? 'aporte' : t.type === 'resgate' ? 'resgate' : 'rendimento';
        const sign = isNeg ? '-' : '+';
        return `
          <div class="history-item">
            <div class="history-icon ${iconClass}">
              <i data-lucide="${isNeg ? 'arrow-up-right' : t.type === 'rendimento' ? 'trending-up' : 'arrow-down-left'}" style="width:18px;height:18px"></i>
            </div>
            <div class="history-info">
              <div class="history-title">${escapeHtml(t.description || t.type)} ${c ? '· ' + escapeHtml(c.name) : ''}</div>
              <div class="history-date">${new Date(t.date).toLocaleDateString('pt-BR')} ${new Date(t.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
            </div>
            <div class="history-amount ${isNeg ? 'negative' : 'positive'}">${sign} ${Calculators.formatMoney(t.amount)}</div>
          </div>`;
      }).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    el.innerHTML = `
      <div class="tabs" id="hist-tabs">
        <button class="tab active" data-f="all">Todos</button>
        <button class="tab" data-f="aporte">Aportes</button>
        <button class="tab" data-f="resgate">Resgates</button>
        <button class="tab" data-f="rendimento">Rendimentos</button>
      </div>
      <div class="history-list" id="history-list"></div>`;
    el.querySelectorAll('#hist-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        filter = tab.dataset.f;
        el.querySelectorAll('#hist-tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
        renderList();
      });
    });
    renderList();
  }

  function renderEducacao(el) { Academy.render(el); }

  function renderConquistas(el) {
    const unlocked = Storage.get().achievements;
    const total = Caixinhas.totalBalance();
    const aporteCount = Storage.get().transactions.filter(t => t.type === 'aporte').length;
    el.innerHTML = `
      <h3 class="section-title mb-2">Conquistas</h3>
      <div class="achievements-grid mb-2">
        ${Investments.ACHIEVEMENTS_DEF.map(a => `
          <div class="achievement ${unlocked.includes(a.id) ? 'unlocked' : 'locked'}">
            <div class="achievement-icon">${a.icon}</div>
            <div class="achievement-name">${a.name}</div>
            <div class="achievement-desc">${a.desc}</div>
          </div>`).join('')}
      </div>
      <h3 class="section-title mb-2 mt-2">Desafios</h3>
      ${Investments.CHALLENGES_DEF.map(ch => {
        let progress = 0, current = 0;
        if (ch.type === 'count') { current = aporteCount; progress = Math.min(100, (current / ch.target) * 100); }
        else if (ch.type === 'months') {
          current = Math.min(12, Math.floor((Date.now() - new Date(Storage.get().user.createdAt || Date.now()).getTime()) / (30 * 24 * 3600 * 1000)));
          progress = Math.min(100, (current / ch.target) * 100);
        } else { current = total; progress = Math.min(100, (current / ch.target) * 100); }
        return `
          <div class="challenge-card">
            <div class="challenge-header">
              <div><strong>${ch.name}</strong><div class="card-subtitle">${ch.desc}</div></div>
              <span style="font-weight:600">${progress.toFixed(0)}%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
            <div class="progress-text mt-1">
              <span>${ch.type === 'count' ? current + ' aportes' : ch.type === 'months' ? current + ' meses' : Calculators.formatMoney(current)}</span>
              <span>Meta: ${ch.type === 'count' || ch.type === 'months' ? ch.target : Calculators.formatMoney(ch.target)}</span>
            </div>
          </div>`;
      }).join('')}`;
  }

  function renderConfiguracoes(el) {
    const data = Storage.get();
    const s = data.settings;
    el.innerHTML = `
      <div class="card mb-2">
        <div class="card-title mb-2">Perfil</div>
        <div class="form-group">
          <label class="form-label">Seu nome</label>
          <input type="text" class="form-input" id="cfg-name" value="${escapeHtml(data.user.name)}" placeholder="Como podemos te chamar?">
        </div>
        <button class="btn btn-primary btn-sm" id="cfg-save-name">Salvar nome</button>
      </div>
      <div class="card mb-2">
        <div class="card-title mb-2">Aparência</div>
        <div class="form-group">
          <label class="form-label">Tema</label>
          <select class="form-select" id="cfg-theme">
            <option value="auto" ${s.theme==='auto'||!s.theme?'selected':''}>Automático (sistema)</option>
            <option value="light" ${s.theme==='light'?'selected':''}>Claro</option>
            <option value="dark" ${s.theme==='dark'?'selected':''}>Escuro</option>
          </select>
          <div class="form-hint">No modo automático, o tema segue a preferência do seu dispositivo.</div>
        </div>
      </div>
      <div class="card mb-2">
        <div class="card-title mb-2">Parâmetros de simulação</div>
        <div class="form-group">
          <label class="form-label">CDI estimado (% a.a.)</label>
          <input type="number" class="form-input" id="cfg-cdi" value="${s.cdiRate}" step="0.01">
          <div class="form-hint">Usado como base nas simulações de % do CDI. Última atualização: ${new Date(s.lastParamUpdate).toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Taxa padrão (% CDI) para novas caixinhas</label>
          <input type="number" class="form-input" id="cfg-default-rate" value="${s.defaultRate}">
        </div>
        <div class="form-group">
          <label class="form-label"><input type="checkbox" id="cfg-taxes" ${s.considerTaxes?'checked':''}> Considerar impostos por padrão nas simulações</label>
        </div>
        <button class="btn btn-primary btn-sm" id="cfg-save-params">Salvar parâmetros</button>
      </div>
      <div class="card mb-2">
        <div class="card-title mb-2">Backup e dados</div>
        <p class="form-hint mb-2">Seus dados ficam apenas neste navegador. Exporte periodicamente para não perder.</p>
        <div class="flex gap-1" style="flex-wrap:wrap">
          <button class="btn btn-secondary" id="cfg-export"><i data-lucide="download" style="width:16px;height:16px"></i> Exportar meus dados</button>
          <label class="btn btn-secondary" style="cursor:pointer">
            <i data-lucide="upload" style="width:16px;height:16px"></i> Importar dados
            <input type="file" id="cfg-import" accept=".json" hidden>
          </label>
        </div>
        <button class="btn btn-danger btn-sm mt-2" id="cfg-clear">Apagar todos os dados</button>
      </div>
      <div class="legal-footer">
        Este projeto é uma ferramenta educacional e de simulação. Os resultados apresentados são estimativas e não constituem recomendação de investimento.<br>
        Os dados financeiros inseridos neste projeto são armazenados localmente no navegador e podem ser perdidos se o armazenamento local for limpo.
      </div>`;

    document.getElementById('cfg-save-name').addEventListener('click', () => {
      const name = document.getElementById('cfg-name').value.trim();
      Storage.update(d => { d.user.name = name; });
      updateUserUI();
      toast('Nome salvo!', 'success');
    });
    document.getElementById('cfg-theme').addEventListener('change', (e) => {
      Storage.update(d => { d.settings.theme = e.target.value; });
      applyTheme();
      toast('Tema atualizado', 'info');
    });
    document.getElementById('cfg-save-params').addEventListener('click', () => {
      Storage.update(d => {
        d.settings.cdiRate = parseFloat(document.getElementById('cfg-cdi').value) || 13.15;
        d.settings.defaultRate = parseFloat(document.getElementById('cfg-default-rate').value) || 100;
        d.settings.considerTaxes = document.getElementById('cfg-taxes').checked;
        d.settings.lastParamUpdate = new Date().toISOString();
      });
      toast('Parâmetros salvos', 'success');
    });
    document.getElementById('cfg-export').addEventListener('click', () => {
      Storage.exportData();
      toast('Backup exportado!', 'success');
    });
    document.getElementById('cfg-import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await Storage.importData(file);
        updateUserUI();
        applyTheme();
        navigate(currentPage);
        toast('Dados importados com sucesso!', 'success');
      } catch (err) {
        toast('Erro ao importar: arquivo inválido', 'error');
      }
    });
    document.getElementById('cfg-clear').addEventListener('click', () => {
      openModal(`
        <div class="modal-header"><h2>Apagar todos os dados?</h2><button class="btn-icon modal-close"><i data-lucide="x"></i></button></div>
        <div class="modal-body">
          <p>Esta ação é <strong>irreversível</strong>. Todos os caixinhas, transações e configurações serão apagados deste navegador.</p>
          <p class="mt-1">Digite <strong>APAGAR</strong> para confirmar:</p>
          <input type="text" class="form-input mt-1" id="confirm-delete" placeholder="APAGAR">
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Cancelar</button>
          <button class="btn btn-danger" id="confirm-delete-btn">Apagar definitivamente</button>
        </div>`);
      document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        if (document.getElementById('confirm-delete').value === 'APAGAR') {
          Storage.clear();
          closeModal();
          updateUserUI();
          applyTheme();
          navigate('dashboard');
          toast('Dados apagados', 'info');
        } else {
          toast('Digite APAGAR para confirmar', 'error');
        }
      });
    });
  }

  let modalReturn=null;
  function openModal(html) {
    if(document.getElementById('modal-container').hidden) modalReturn=document.activeElement;
    const container = document.getElementById('modal-container');
    container.innerHTML = `<div class="modal">${html}</div>`;
    container.hidden = false;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    container.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', closeModal));
    container.onclick = e => { if (e.target === container) closeModal(); };
    const dialog=container.querySelector('.modal'); dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',dialog.querySelector('h2')?.textContent||'Janela'); dialog.tabIndex=-1; dialog.focus();
  }

  function closeModal() {
    const container = document.getElementById('modal-container');
    if(container.hidden)return;
    container.hidden = true;
    container.innerHTML = '';
    modalReturn?.focus(); modalReturn=null;
  }

  function openCreateCaixinhaModal(editId = null) {
    const existing = editId ? Caixinhas.getById(editId) : null;
    const settings = Storage.get().settings;
    openModal(`
      <div class="modal-header">
        <h2>${existing ? 'Editar Caixinha' : 'Nova Caixinha'}</h2>
        <button class="btn-icon modal-close" aria-label="Fechar"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome</label>
          <input type="text" class="form-input" id="c-name" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="Ex: Meu PC">
        </div>
        <div class="form-group">
          <label class="form-label">Ícone</label>
          <div class="icon-picker" id="icon-picker">
            ${Caixinhas.ICONS.map(ic => `<button type="button" class="icon-option ${(!existing && ic==='💰') || (existing && existing.icon===ic) ? 'selected' : ''}" data-icon="${ic}">${ic}</button>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <div class="category-picker" id="cat-picker">
            ${Caixinhas.CATEGORIES.map(cat => `<button type="button" class="category-option ${(!existing && cat==='Personalizado') || (existing && existing.category===cat) ? 'selected' : ''}" data-cat="${cat}">${cat}</button>`).join('')}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Objetivo (R$)</label>
            <input type="text" class="form-input input-money" id="c-goal" value="${existing ? formatInputMoney(existing.goal) : '5.000,00'}">
          </div>
          <div class="form-group">
            <label class="form-label">Saldo inicial (R$)</label>
            <input type="text" class="form-input input-money" id="c-balance" value="${existing ? formatInputMoney(existing.balance) : '0,00'}" ${existing ? 'disabled' : ''}>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Aporte mensal (R$)</label>
            <input type="text" class="form-input input-money" id="c-monthly" value="${existing ? formatInputMoney(existing.monthlyContribution) : '300,00'}">
          </div>
          <div class="form-group">
            <label class="form-label">Taxa estimada (% CDI)</label>
            <input type="number" class="form-input" id="c-rate" value="${existing ? existing.interestRate : settings.defaultRate}">
            <div class="form-hint">Simulação — não é taxa garantida</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${existing ? `<button class="btn btn-danger btn-sm" id="c-delete">Excluir</button>` : ''}
        <button class="btn btn-secondary modal-close">Cancelar</button>
        <button class="btn btn-primary" id="c-save">${existing ? 'Salvar' : 'Criar'}</button>
      </div>`);

    let selectedIcon = existing?.icon || '💰';
    let selectedCat = existing?.category || 'Personalizado';
    document.querySelectorAll('.icon-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedIcon = btn.dataset.icon;
      });
    });
    document.querySelectorAll('.category-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedCat = btn.dataset.cat;
      });
    });
    bindMoneyInputs(document.getElementById('modal-container'));
    document.getElementById('c-save').addEventListener('click', () => {
      const name = document.getElementById('c-name').value.trim();
      if (!name) { toast('Informe um nome', 'error'); return; }
      const goal = Calculators.parseMoney(document.getElementById('c-goal').value);
      const monthly = Calculators.parseMoney(document.getElementById('c-monthly').value);
      const rate = parseFloat(document.getElementById('c-rate').value) || 100;
      if (existing) {
        Caixinhas.update(existing.id, { name, goal, monthlyContribution: monthly, interestRate: rate, category: selectedCat, icon: selectedIcon });
        toast('Caixinha atualizada!', 'success');
      } else {
        const balance = Calculators.parseMoney(document.getElementById('c-balance').value);
        Caixinhas.create({ name, goal, balance, monthlyContribution: monthly, interestRate: rate, category: selectedCat, icon: selectedIcon });
        toast('Caixinha criada!', 'success');
        Storage.addNotification({ icon: '🎯', message: `Caixinha "${name}" criada. Boa jornada!` });
      }
      closeModal();
      navigate(currentPage);
      updateNotifBadge();
    });
    document.getElementById('c-delete')?.addEventListener('click', () => {
      if (confirm('Excluir esta caixinha e seu histórico?')) {
        Caixinhas.remove(existing.id);
        closeModal();
        navigate(currentPage);
        toast('Caixinha excluída', 'info');
      }
    });
  }

  function openAddMoneyModal(caixinhaId = null) {
    const list = Caixinhas.getAll();
    if (list.length === 0) {
      toast('Crie uma caixinha primeiro', 'info');
      openCreateCaixinhaModal();
      return;
    }
    openModal(`
      <div class="modal-header">
        <h2>Adicionar dinheiro</h2>
        <button class="btn-icon modal-close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Caixinha</label>
          <select class="form-select" id="add-caixinha">
            ${list.map(c => `<option value="${escapeHtml(c.id)}" ${c.id===caixinhaId?'selected':''}>${escapeHtml(c.icon)} ${escapeHtml(c.name)} — ${Calculators.formatMoney(c.balance)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Valor (R$)</label>
          <input type="text" class="form-input input-money" id="add-amount" placeholder="0,00" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-select" id="add-type">
            <option value="aporte">Aporte</option>
            <option value="rendimento">Rendimento manual</option>
            <option value="transferencia">Transferência</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Data</label>
          <input type="date" class="form-input" id="add-date" value="${new Date().toISOString().slice(0,10)}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">Cancelar</button>
        <button class="btn btn-primary" id="add-confirm">Confirmar</button>
      </div>`);
    bindMoneyInputs(document.getElementById('modal-container'));
    document.getElementById('add-confirm').addEventListener('click', () => {
      const id = document.getElementById('add-caixinha').value;
      const amount = Calculators.parseMoney(document.getElementById('add-amount').value);
      const type = document.getElementById('add-type').value;
      const date = document.getElementById('add-date').value;
      if (amount <= 0) { toast('Informe um valor válido', 'error'); return; }
      Caixinhas.addMoney(id, amount, type, date ? new Date(date).toISOString() : null);
      closeModal();
      navigate(currentPage);
      toast(`${Calculators.formatMoney(amount)} adicionado!`, 'success');
      updateNotifBadge();
    });
  }

  function openWithdrawModal(caixinhaId) {
    const c = Caixinhas.getById(caixinhaId);
    if (!c) return;
    openModal(`
      <div class="modal-header">
        <h2>Retirar dinheiro</h2>
        <button class="btn-icon modal-close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <p class="mb-2">Caixinha: <strong>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</strong></p>
        <p class="mb-2">Saldo disponível: <strong>${Calculators.formatMoney(c.balance)}</strong></p>
        <div class="form-group">
          <label class="form-label">Valor a retirar (R$)</label>
          <input type="text" class="form-input input-money" id="wd-amount" placeholder="0,00">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close">Cancelar</button>
        <button class="btn btn-danger" id="wd-confirm">Retirar</button>
      </div>`);
    bindMoneyInputs(document.getElementById('modal-container'));
    document.getElementById('wd-confirm').addEventListener('click', () => {
      const amount = Calculators.parseMoney(document.getElementById('wd-amount').value);
      const result = Caixinhas.withdraw(caixinhaId, amount);
      if (!result.ok) { toast(result.error, 'error'); return; }
      closeModal();
      navigate(currentPage);
      toast('Resgate realizado', 'success');
    });
  }

  function openCaixinhaDetail(id) {
    const c = Caixinhas.getById(id);
    if (!c) return;
    const progress = Caixinhas.getProgress(c);
    const projected = Caixinhas.getProjectedDate(c);
    const yieldEst = Caixinhas.getEstimatedYield(c, 12);
    const txs = Storage.get().transactions.filter(t => t.caixinhaId === id).slice(0, 10);
    openModal(`
      <div class="modal-header">
        <h2>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</h2>
        <button class="btn-icon modal-close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <div class="caixinha-balance" style="font-size:1.75rem">${Calculators.formatMoney(c.balance)}</div>
        <div class="caixinha-goal mb-1">de ${Calculators.formatMoney(c.goal)} · ${progress.toFixed(0)}%</div>
        <div class="progress-bar mb-2"><div class="progress-fill ${progress>=100?'complete':''}" style="width:${progress}%"></div></div>
        <div class="result-details" style="grid-template-columns:1fr 1fr">
          <div class="result-detail"><div class="result-detail-label">Aporte mensal</div><div class="result-detail-value">${Calculators.formatMoney(c.monthlyContribution)}</div></div>
          <div class="result-detail"><div class="result-detail-label">Taxa sim. (% CDI)</div><div class="result-detail-value">${c.interestRate}%</div></div>
          <div class="result-detail"><div class="result-detail-label">Rend. est. 12m</div><div class="result-detail-value text-green">${Calculators.formatMoney(yieldEst)}</div></div>
          <div class="result-detail"><div class="result-detail-label">Previsão</div><div class="result-detail-value">${projected ? projected.toLocaleDateString('pt-BR') : '—'}</div></div>
        </div>
        <h4 style="margin:16px 0 8px">Últimas movimentações</h4>
        ${txs.length === 0 ? '<p class="text-muted">Nenhuma ainda.</p>' : txs.map(t => `
          <div class="flex justify-between" style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem">
            <span>${escapeHtml(t.type)} · ${new Date(t.date).toLocaleDateString('pt-BR')}</span>
            <span class="${t.type==='resgate'?'text-red':'text-green'}">${t.type==='resgate'?'-':'+'} ${Calculators.formatMoney(t.amount)}</span>
          </div>`).join('')}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" id="detail-edit">Editar</button>
        <button class="btn btn-primary btn-sm" id="detail-add">Adicionar</button>
        <button class="btn btn-secondary btn-sm modal-close">Fechar</button>
      </div>`);
    document.getElementById('detail-edit').addEventListener('click', () => { closeModal(); openCreateCaixinhaModal(id); });
    document.getElementById('detail-add').addEventListener('click', () => { closeModal(); openAddMoneyModal(id); });
  }

  function loadDemoData() {
    Storage.clear();
    Storage.update(d => {
      d.isDemo = true;
      d.user.name = 'Demo';
      d.user.createdAt = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    });
    Caixinhas.create({ name: 'Meu PC', goal: 5000, balance: 2350, monthlyContribution: 300, interestRate: 100, category: 'Tecnologia', icon: '💻' });
    Caixinhas.create({ name: 'Reserva de emergência', goal: 15000, balance: 8200, monthlyContribution: 500, interestRate: 100, category: 'Reserva de emergência', icon: '🛡️' });
    Caixinhas.create({ name: 'Viagem Europa', goal: 12000, balance: 3100, monthlyContribution: 400, interestRate: 105, category: 'Viagem', icon: '✈️' });
    const now = Date.now();
    for (let i = 60; i >= 0; i--) {
      const d = new Date(now - i * 24 * 3600 * 1000);
      const total = 8000 + (60 - i) * 80 + Math.random() * 50;
      Storage.update(data => {
        data.portfolioHistory.push({ date: d.toISOString().slice(0, 10), total: Calculators.round2(total) });
      });
    }
    Storage.updatePortfolioHistory();
    Storage.unlockAchievement('first_aporte');
    Storage.unlockAchievement('first_100');
    Storage.unlockAchievement('first_1000');
    Storage.addNotification({ icon: '👋', message: 'Dados de demonstração carregados. Explore à vontade!' });
    updateUserUI();
    navigate('dashboard');
    toast('Dados de demonstração ativados', 'info');
  }

  function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.remove(); }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatInputMoney(n) {
    return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function bindMoneyInputs(root) {
    (root || document).querySelectorAll('.input-money').forEach(input => {
      input.addEventListener('blur', () => {
        const v = Calculators.parseMoney(input.value);
        input.value = formatInputMoney(v);
      });
      // Live formatting while typing (digits only)
      input.addEventListener('input', () => {
        const digits = input.value.replace(/\D/g, '');
        if (!digits) {
          input.value = '';
          return;
        }
        const num = parseInt(digits, 10) / 100;
        input.value = formatInputMoney(num);
      });
    });
  }

  function bindGlobalEvents() {
    document.querySelectorAll('.nav-item[data-page], .bottom-nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.page));
    });
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      let overlay = document.querySelector('.sidebar-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', closeSidebar);
      }
      overlay.classList.toggle('visible', document.getElementById('sidebar').classList.contains('open'));
    });
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      cycleTheme();
    });
    document.getElementById('notif-btn')?.addEventListener('click', () => {
      const panel = document.getElementById('notif-panel');
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        const list = document.getElementById('notif-list');
        const notifs = Storage.get().notifications;
        list.innerHTML = notifs.length === 0
          ? '<div class="notif-item text-muted">Nenhuma notificação</div>'
          : notifs.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}">
              <span>${escapeHtml(n.icon || '🔔')}</span>
              <div>
                <div>${escapeHtml(n.message)}</div>
                <div class="text-muted" style="font-size:0.75rem">${new Date(n.date).toLocaleString('pt-BR')}</div>
              </div>
            </div>`).join('');
        Storage.update(d => { d.notifications.forEach(n => n.read = true); });
        updateNotifBadge();
      }
    });
    document.getElementById('close-notif')?.addEventListener('click', () => {
      document.getElementById('notif-panel').hidden = true;
    });
    // FAB mobile
    document.getElementById('fab-add')?.addEventListener('click', () => {
      const list = Caixinhas.getAll();
      if (list.length === 0) openCreateCaixinhaModal();
      else openAddMoneyModal();
    });
    // Close notif when clicking outside
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('notif-panel');
      const btn = document.getElementById('notif-btn');
      if (panel && !panel.hidden && !panel.contains(e.target) && !btn?.contains(e.target)) {
        panel.hidden = true;
      }
    });
    document.addEventListener('keydown', (e) => {
      if(e.key==='Tab' && !document.getElementById('modal-container').hidden){const items=[...document.querySelectorAll('#modal-container button:not(:disabled), #modal-container input:not(:disabled), #modal-container select:not(:disabled), #modal-container textarea:not(:disabled)')].filter(x=>x.getClientRects().length);if(items.length && ((e.shiftKey && (document.activeElement===items[0]||!items.includes(document.activeElement)))||(!e.shiftKey&&document.activeElement===items.at(-1)))){e.preventDefault();(e.shiftKey?items.at(-1):items[0]).focus();}}
      if (e.key === 'Escape') {
        closeSidebar();
        closeModal();
        const panel = document.getElementById('notif-panel');
        if (panel) panel.hidden = true;
      }
      // Shortcut: N = new caixinha when not typing
      if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !document.activeElement?.isContentEditable && document.getElementById('modal-container').hidden) openCreateCaixinhaModal();
      }
    });
  }

  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('visible');
  }

  document.addEventListener('DOMContentLoaded', init);
  return { navigate, toast };
})();
