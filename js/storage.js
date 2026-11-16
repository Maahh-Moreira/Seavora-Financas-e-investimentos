/**
 * Seavora — Local Storage Manager
 * Persists all user data in localStorage with versioning and backup support.
 */

const Storage = (() => {
  const KEY = 'finflow_data_v1';
  const VERSION = 1;

  const defaultData = () => ({
    version: VERSION,
    user: {
      name: '',
      createdAt: new Date().toISOString()
    },
    caixinhas: [],
    transactions: [],
    goals: [], // goals are linked to caixinhas mostly, but standalone possible
    settings: {
      theme: 'auto',
      currency: 'BRL',
      defaultRate: 100, // % CDI
      cdiRate: 13.15, // annual CDI estimate for simulations (%)
      considerTaxes: false,
      lastParamUpdate: new Date().toISOString()
    },
    notifications: [],
    achievements: [],
    challenges: [],
    portfolioHistory: [], // { date, total }
    isDemo: false
  });

  let cache = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        cache = defaultData();
        return cache;
      }
      const parsed = JSON.parse(raw);
      // Migrate if needed
      if (!parsed.version || parsed.version < VERSION) {
        parsed.version = VERSION;
      }
      // Ensure all keys exist
      const def = defaultData();
      cache = {
        ...def,
        ...parsed,
        user: { ...def.user, ...parsed.user },
        settings: { ...def.settings, ...parsed.settings }
      };
      return cache;
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
      cache = defaultData();
      return cache;
    }
  }

  function save(data) {
    try {
      cache = data || cache;
      localStorage.setItem(KEY, JSON.stringify(cache));
      return true;
    } catch (e) {
      console.error('Erro ao salvar dados:', e);
      if (e.name === 'QuotaExceededError') {
        alert('Armazenamento local cheio. Exporte seus dados e limpe o histórico antigo.');
      }
      return false;
    }
  }

  function get() {
    if (!cache) load();
    return cache;
  }

  function update(updater) {
    const data = get();
    if (typeof updater === 'function') {
      updater(data);
    } else {
      Object.assign(data, updater);
    }
    save(data);
    return data;
  }

  function clear() {
    localStorage.removeItem(KEY);
    cache = defaultData();
    return cache;
  }

  function exportData() {
    const data = get();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!imported || !Array.isArray(imported.caixinhas) || !Array.isArray(imported.transactions) || !imported.user || imported.caixinhas.some(c => !c || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(c.id) || typeof c.name !== 'string' || !Number.isFinite(c.balance) || c.balance < 0) || imported.transactions.some(t => !t || !Number.isFinite(t.amount) || t.amount < 0)) {
            reject(new Error('Arquivo inválido'));
            return;
          }
          const previous=cache;
          if(imported.money && (!Array.isArray(imported.money.entries)||!Array.isArray(imported.money.assets)||!imported.money.budgets||imported.money.entries.some(x=>!x||typeof x.date!=="string"||!Number.isSafeInteger(x.amount)||x.amount<=0)||imported.money.assets.some(x=>!x||!Number.isSafeInteger(x.cost)||!Number.isSafeInteger(x.value))))throw new Error("Dados de gestão inválidos.");
          imported.version = VERSION;
          cache = { ...defaultData(), ...imported, settings: { ...defaultData().settings, ...imported.settings } };
          if(!save(cache)){ cache=previous; throw new Error("Não foi possível gravar o backup."); }
          resolve(cache);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file);
    });
  }

  // Helpers
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function addTransaction(tx) {
    const data = get();
    const transaction = {
      id: generateId(),
      date: new Date().toISOString(),
      ...tx
    };
    data.transactions.unshift(transaction);
    save(data);
    return transaction;
  }

  function updatePortfolioHistory() {
    const data = get();
    const total = data.caixinhas.reduce((s, c) => s + (c.balance || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const existing = data.portfolioHistory.find(h => h.date === today);
    if (existing) {
      existing.total = total;
    } else {
      data.portfolioHistory.push({ date: today, total });
    }
    // Keep ~2 years
    if (data.portfolioHistory.length > 730) {
      data.portfolioHistory = data.portfolioHistory.slice(-730);
    }
    save(data);
  }

  function unlockAchievement(id) {
    const data = get();
    if (!data.achievements.includes(id)) {
      data.achievements.push(id);
      save(data);
      return true;
    }
    return false;
  }

  function addNotification(notif) {
    const data = get();
    data.notifications.unshift({
      id: generateId(),
      read: false,
      date: new Date().toISOString(),
      ...notif
    });
    if (data.notifications.length > 50) {
      data.notifications = data.notifications.slice(0, 50);
    }
    save(data);
  }

  return {
    load,
    save,
    get,
    update,
    clear,
    exportData,
    importData,
    generateId,
    addTransaction,
    updatePortfolioHistory,
    unlockAchievement,
    addNotification,
    KEY
  };
})();
