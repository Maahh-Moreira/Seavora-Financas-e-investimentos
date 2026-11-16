/**
 * Seavora — Chart helpers (Chart.js)
 */

const Charts = (() => {
  const instances = {};

  const colors = {
    primary: '#08756f',
    primaryLight: 'rgba(8, 117, 111, 0.15)',
    green: '#10b981',
    greenLight: 'rgba(16, 185, 129, 0.15)',
    purple: '#168c83',
    gray: '#9ca3af',
    red: '#ef4444'
  };

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function gridColor() {
    return isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  }

  function textColor() {
    return isDark() ? '#9ca3af' : '#6b7280';
  }

  /**
   * Portfolio evolution line chart
   */
  function portfolioChart(canvasId, history, period = '1m') {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (typeof Chart === 'undefined' || !canvas) return;

    const now = new Date();
    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '6m') days = 180;
    else if (period === '1y') days = 365;
    else if (period === '5y') days = 1825;

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);

    let filtered = (history || []).filter(h => new Date(h.date) >= cutoff);
    if (filtered.length === 0) {
      // Show current total as single point
      const data = Storage.get();
      const total = data.caixinhas.reduce((s, c) => s + (c.balance || 0), 0);
      filtered = [{ date: now.toISOString().slice(0, 10), total }];
    }

    // Fill gaps for smoother chart if sparse
    const labels = filtered.map(h => {
      const d = new Date(h.date + 'T12:00:00');
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    });
    const values = filtered.map(h => h.total);

    if(typeof Chart==='undefined'){canvas.setAttribute('aria-label','Gráfico indisponível sem a biblioteca de gráficos. Consulte os valores apresentados.'); const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle=textColor();ctx.font='12px sans-serif';ctx.fillText('Gráfico indisponível offline',8,24);}return;}
    instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Patrimônio',
          data: values,
          borderColor: colors.primary,
          backgroundColor: colors.primaryLight,
          fill: true,
          tension: 0.35,
          pointRadius: values.length > 30 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => Calculators.formatMoney(ctx.raw)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor(), maxTicksLimit: 6, font: { size: 11 } }
          },
          y: {
            grid: { color: gridColor() },
            ticks: {
              color: textColor(),
              font: { size: 11 },
              callback: (v) => {
                if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
                return 'R$ ' + v;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Compound: invested vs interest stacked area
   */
  function compoundChart(canvasId, table) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (typeof Chart === 'undefined' || !canvas || !table || !table.length) return;

    const labels = table.map(r => r.month + 'm');
    const invested = table.map(r => r.totalContrib);
    const interest = table.map(r => r.totalInterest);

    if(typeof Chart==='undefined'){canvas.setAttribute('aria-label','Gráfico indisponível sem a biblioteca de gráficos. Consulte os valores apresentados.'); const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle=textColor();ctx.font='12px sans-serif';ctx.fillText('Gráfico indisponível offline',8,24);}return;}
    instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total investido',
            data: invested,
            borderColor: colors.primary,
            backgroundColor: colors.primaryLight,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
          },
          {
            label: 'Juros acumulados',
            data: interest,
            borderColor: colors.green,
            backgroundColor: colors.greenLight,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor(), boxWidth: 12, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ': ' + Calculators.formatMoney(ctx.raw)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor(), maxTicksLimit: 8, font: { size: 11 } }
          },
          y: {
            grid: { color: gridColor() },
            ticks: {
              color: textColor(),
              font: { size: 11 },
              callback: (v) => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
            }
          }
        }
      }
    });
  }

  /**
   * Doughnut distribution by category
   */
  function distributionChart(canvasId, caixinhas) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (typeof Chart === 'undefined' || !canvas) return;

    const byCat = {};
    caixinhas.forEach(c => {
      const cat = c.category || 'Personalizado';
      byCat[cat] = (byCat[cat] || 0) + (c.balance || 0);
    });

    const labels = Object.keys(byCat);
    const values = Object.values(byCat);
    const palette = [
      '#08756f', '#168c83', '#5acbb5', '#83ddcb',
      '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899'
    ];

    if (labels.length === 0) {
      labels.push('Sem dados');
      values.push(1);
    }

    if(typeof Chart==='undefined'){canvas.setAttribute('aria-label','Gráfico indisponível sem a biblioteca de gráficos. Consulte os valores apresentados.'); const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle=textColor();ctx.font='12px sans-serif';ctx.fillText('Gráfico indisponível offline',8,24);}return;}
    instances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor(), boxWidth: 12, font: { size: 11 }, padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                return `${ctx.label}: ${Calculators.formatMoney(ctx.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Comparison bar chart
   */
  function comparisonChart(canvasId, results) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (typeof Chart === 'undefined' || !canvas || !results) return;

    if(typeof Chart==='undefined'){canvas.setAttribute('aria-label','Gráfico indisponível sem a biblioteca de gráficos. Consulte os valores apresentados.'); const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle=textColor();ctx.font='12px sans-serif';ctx.fillText('Gráfico indisponível offline',8,24);}return;}
    instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: results.map(r => r.name),
        datasets: [
          {
            label: 'Valor líquido estimado',
            data: results.map(r => r.net),
            backgroundColor: colors.primary,
            borderRadius: 6,
            barThickness: 32
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => Calculators.formatMoney(ctx.raw)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor(), font: { size: 11 } }
          },
          y: {
            grid: { color: gridColor() },
            ticks: {
              color: textColor(),
              font: { size: 11 },
              callback: (v) => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
            }
          }
        }
      }
    });
  }

  /**
   * Retirement growth chart
   */
  function retirementChart(canvasId, points) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (typeof Chart === 'undefined' || !canvas || !points) return;

    if(typeof Chart==='undefined'){canvas.setAttribute('aria-label','Gráfico indisponível sem a biblioteca de gráficos. Consulte os valores apresentados.'); const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle=textColor();ctx.font='12px sans-serif';ctx.fillText('Gráfico indisponível offline',8,24);}return;}
    instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map(p => p.age + ' anos'),
        datasets: [{
          label: 'Patrimônio projetado',
          data: points.map(p => p.value),
          borderColor: colors.primary,
          backgroundColor: colors.primaryLight,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: colors.primary,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => Calculators.formatMoney(ctx.raw)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor(), font: { size: 11 } }
          },
          y: {
            grid: { color: gridColor() },
            ticks: {
              color: textColor(),
              font: { size: 11 },
              callback: (v) => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
            }
          }
        }
      }
    });
  }

  return {
    portfolioChart,
    compoundChart,
    distributionChart,
    comparisonChart,
    retirementChart,
    destroy,
    destroyAll: () => Object.keys(instances).forEach(destroy)
  };
})();
