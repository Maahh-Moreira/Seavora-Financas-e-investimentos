/**
 * Seavora — Caixinhas (goals boxes) management
 */

const Caixinhas = (() => {
  const CATEGORIES = [
    'Reserva de emergência',
    'Viagem',
    'Estudos',
    'Tecnologia',
    'Casa',
    'Carro',
    'Lazer',
    'Investimentos',
    'Personalizado'
  ];

  const ICONS = ['💰', '✈️', '📚', '💻', '🏠', '🚗', '🎮', '📈', '🎯', '🏖️', '💍', '🎓', '📱', '🛡️', '🎁'];

  function create(data) {
    const caixinha = {
      id: Storage.generateId(),
      name: data.name || 'Nova Caixinha',
      goal: data.goal || 0,
      balance: data.balance || 0,
      monthlyContribution: data.monthlyContribution || 0,
      interestRate: data.interestRate != null ? data.interestRate : 100, // % CDI
      category: data.category || 'Personalizado',
      icon: data.icon || '💰',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    Storage.update(d => {
      d.caixinhas.push(caixinha);
    });

    if (caixinha.balance > 0) {
      Storage.addTransaction({
        caixinhaId: caixinha.id,
        type: 'aporte',
        amount: caixinha.balance,
        description: 'Saldo inicial'
      });
    }

    Storage.updatePortfolioHistory();
    checkAchievements();
    return caixinha;
  }

  function update(id, updates) {
    Storage.update(d => {
      const c = d.caixinhas.find(x => x.id === id);
      if (c) {
        Object.assign(c, updates, { updatedAt: new Date().toISOString() });
      }
    });
    Storage.updatePortfolioHistory();
  }

  function remove(id) {
    Storage.update(d => {
      d.caixinhas = d.caixinhas.filter(c => c.id !== id);
      d.transactions = d.transactions.filter(t => t.caixinhaId !== id);
    });
    Storage.updatePortfolioHistory();
  }

  function addMoney(id, amount, type = 'aporte', date = null) {
    amount = Math.abs(amount);
    if (amount <= 0) return false;

    const data = Storage.get();
    const c = data.caixinhas.find(x => x.id === id);
    if (!c) return false;

    c.balance = Calculators.round2(c.balance + amount);
    c.updatedAt = new Date().toISOString();
    Storage.save(data);

    Storage.addTransaction({
      caixinhaId: id,
      type,
      amount,
      date: date || new Date().toISOString(),
      description: type === 'rendimento' ? 'Rendimento manual' : (type === 'transferencia' ? 'Transferência' : 'Aporte')
    });

    Storage.updatePortfolioHistory();
    checkAchievements();
    checkGoalReached(c);
    return true;
  }

  function withdraw(id, amount) {
    amount = Math.abs(amount);
    if (amount <= 0) return { ok: false, error: 'Valor inválido' };

    const data = Storage.get();
    const c = data.caixinhas.find(x => x.id === id);
    if (!c) return { ok: false, error: 'Caixinha não encontrada' };
    if (amount > c.balance) return { ok: false, error: 'Saldo insuficiente' };

    c.balance = Calculators.round2(c.balance - amount);
    c.updatedAt = new Date().toISOString();
    Storage.save(data);

    Storage.addTransaction({
      caixinhaId: id,
      type: 'resgate',
      amount,
      description: 'Resgate'
    });

    Storage.updatePortfolioHistory();
    return { ok: true };
  }

  function getProgress(c) {
    if (!c.goal || c.goal <= 0) return 0;
    return Math.min(100, (c.balance / c.goal) * 100);
  }

  function getProjectedDate(c) {
    const settings = Storage.get().settings;
    const annualRate = (c.interestRate / 100) * (settings.cdiRate || 13.15);
    const months = Calculators.monthsToGoal(
      c.balance,
      c.goal,
      c.monthlyContribution || 0,
      annualRate
    );
    if (!isFinite(months) || months === Infinity) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function getEstimatedYield(c, months = 12) {
    const settings = Storage.get().settings;
    const annualRate = (c.interestRate / 100) * (settings.cdiRate || 13.15);
    const fv = Calculators.futureValue(c.balance, c.monthlyContribution || 0, annualRate, months);
    const invested = c.balance + (c.monthlyContribution || 0) * months;
    return Calculators.round2(fv - invested);
  }

  function checkGoalReached(c) {
    if (c.goal > 0 && c.balance >= c.goal) {
      Storage.addNotification({
        type: 'success',
        icon: '🎉',
        message: `Parabéns! Você atingiu a meta da caixinha "${c.name}"!`
      });
      Storage.unlockAchievement('first_goal');
      if (typeof window !== 'undefined' && typeof window.__finflowConfetti === 'function') {
        window.__finflowConfetti();
      }
      return true;
    }
    return false;
  }

  function checkAchievements() {
    const data = Storage.get();
    const total = data.caixinhas.reduce((s, c) => s + (c.balance || 0), 0);
    const hasAporte = data.transactions.some(t => t.type === 'aporte');

    if (hasAporte) Storage.unlockAchievement('first_aporte');
    if (total >= 100) Storage.unlockAchievement('first_100');
    if (total >= 1000) Storage.unlockAchievement('first_1000');
    if (total >= 10000) Storage.unlockAchievement('first_10000');

    // 3 months investing
    if (data.user.createdAt) {
      const created = new Date(data.user.createdAt);
      const months = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (months >= 3 && data.transactions.filter(t => t.type === 'aporte').length >= 3) {
        Storage.unlockAchievement('3_months');
      }
    }
  }

  function getAll() {
    return Storage.get().caixinhas;
  }

  function getById(id) {
    return Storage.get().caixinhas.find(c => c.id === id);
  }

  function totalBalance() {
    return Storage.get().caixinhas.reduce((s, c) => s + (c.balance || 0), 0);
  }

  function totalInvested() {
    // Sum of all aportes - resgates (simplified)
    const txs = Storage.get().transactions;
    let invested = 0;
    txs.forEach(t => {
      if (t.type === 'aporte' || t.type === 'transferencia') invested += t.amount;
      if (t.type === 'resgate') invested -= t.amount;
    });
    return Math.max(0, invested);
  }

  function totalYields() {
    return Storage.get().transactions
      .filter(t => t.type === 'rendimento')
      .reduce((s, t) => s + t.amount, 0);
  }

  function monthlyAportes() {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return Storage.get().transactions
      .filter(t => {
        if (t.type !== 'aporte' && t.type !== 'transferencia') return false;
        const d = new Date(t.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((s, t) => s + t.amount, 0);
  }

  function completedGoals() {
    return Storage.get().caixinhas.filter(c => c.goal > 0 && c.balance >= c.goal).length;
  }

  return {
    CATEGORIES,
    ICONS,
    create,
    update,
    remove,
    addMoney,
    withdraw,
    getProgress,
    getProjectedDate,
    getEstimatedYield,
    getAll,
    getById,
    totalBalance,
    totalInvested,
    totalYields,
    monthlyAportes,
    completedGoals,
    checkAchievements
  };
})();
