/**
 * Seavora — Financial Calculators
 * Real compound interest, goal projections, tax estimates (educational).
 */

const Calculators = (() => {
  /**
   * Monthly rate from annual percentage
   * @param {number} annualPct - e.g. 13.15 for 13.15%
   */
  function monthlyRate(annualPct) {
    return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  }

  /**
   * Future value with periodic contributions (end of period)
   * FV = P * (1+r)^n + PMT * ((1+r)^n - 1) / r
   */
  function futureValue(principal, monthlyContribution, annualRatePct, months) {
    if (months <= 0) return principal;
    const r = monthlyRate(annualRatePct);
    if (Math.abs(r) < 1e-10) {
      return principal + monthlyContribution * months;
    }
    const factor = Math.pow(1 + r, months);
    const fvPrincipal = principal * factor;
    const fvContrib = monthlyContribution * (factor - 1) / r;
    return fvPrincipal + fvContrib;
  }

  /**
   * Months needed to reach goal
   * Solve for n in FV formula (approximate + binary search for safety)
   */
  function monthsToGoal(current, goal, monthlyContribution, annualRatePct) {
    if (current >= goal) return 0;
    if (monthlyContribution <= 0 && annualRatePct <= 0) return Infinity;

    const r = monthlyRate(annualRatePct);
    // Binary search
    let low = 0;
    let high = 600; // 50 years max
    for (let i = 0; i < 60; i++) {
      const mid = Math.floor((low + high) / 2);
      const fv = futureValue(current, monthlyContribution, annualRatePct, mid);
      if (fv >= goal) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    return futureValue(current, monthlyContribution, annualRatePct, high) >= goal ? high : Infinity;
  }

  /**
   * Required monthly contribution to reach goal in N months
   * PMT = (goal - P*(1+r)^n) * r / ((1+r)^n - 1)
   */
  function requiredMonthly(current, goal, months, annualRatePct) {
    if (months <= 0) return goal - current;
    const r = monthlyRate(annualRatePct);
    const factor = Math.pow(1 + r, months);
    if (Math.abs(r) < 1e-10) {
      return (goal - current) / months;
    }
    const pmt = (goal - current * factor) * r / (factor - 1);
    return Math.max(0, pmt);
  }

  /**
   * Compound interest table (month by month)
   */
  function compoundTable(principal, monthlyContribution, annualRatePct, months) {
    const r = monthlyRate(annualRatePct);
    const rows = [];
    let balance = principal;
    let totalContrib = principal;
    let totalInterest = 0;

    for (let m = 1; m <= months; m++) {
      const interest = balance * r;
      balance += interest + monthlyContribution;
      totalContrib += monthlyContribution;
      totalInterest += interest;
      rows.push({
        month: m,
        balance: round2(balance),
        interest: round2(interest),
        totalContrib: round2(totalContrib),
        totalInterest: round2(totalInterest)
      });
    }
    return rows;
  }

  /**
   * Simple IR progressive table for fixed income (educational estimate)
   * Aliquotas: 22.5% (0-180d), 20% (181-360), 17.5% (361-720), 15% (>720)
   */
  function estimateIR(grossYield, daysHeld) {
    let rate = 0.225;
    if (daysHeld > 720) rate = 0.15;
    else if (daysHeld > 360) rate = 0.175;
    else if (daysHeld > 180) rate = 0.20;
    return grossYield * rate;
  }

  /**
   * Yield per period from annual rate
   */
  function yieldBreakdown(amount, annualRatePct) {
    const daily = Math.pow(1 + annualRatePct / 100, 1 / 252) - 1; // business days approx
    const monthly = monthlyRate(annualRatePct);
    const yearly = annualRatePct / 100;
    return {
      daily: amount * daily,
      monthly: amount * monthly,
      yearly: amount * yearly
    };
  }

  /**
   * Emergency fund recommendation
   */
  function emergencyFund(monthlyExpenses, months = 6) {
    return monthlyExpenses * months;
  }

  /**
   * Retirement projection at milestones
   */
  function retirementProjection(currentAge, targetAge, currentWealth, monthlyContribution, annualRatePct) {
    const points = [];
    for (let age = currentAge; age <= targetAge; age += 5) {
      if (age === currentAge) {
        points.push({ age, value: currentWealth });
      } else {
        const months = (age - currentAge) * 12;
        points.push({
          age,
          value: futureValue(currentWealth, monthlyContribution, annualRatePct, months)
        });
      }
    }
    // Always include target
    if (points[points.length - 1].age !== targetAge) {
      const months = (targetAge - currentAge) * 12;
      points.push({
        age: targetAge,
        value: futureValue(currentWealth, monthlyContribution, annualRatePct, months)
      });
    }
    return points;
  }

  /**
   * Compare multiple investment scenarios
   */
  function compareInvestments(principal, monthly, months, scenarios) {
    // scenarios: [{ name, annualRate, taxRate? }]
    return scenarios.map(s => {
      const gross = futureValue(principal, monthly, s.annualRate, months);
      const invested = principal + monthly * months;
      const grossYield = gross - invested;
      let tax = 0;
      if (s.taxRate != null) {
        tax = grossYield * (s.taxRate / 100);
      } else if (s.applyIR) {
        tax = estimateIR(grossYield, months * 30);
      }
      return {
        name: s.name,
        invested: round2(invested),
        gross: round2(gross),
        yield: round2(grossYield),
        tax: round2(tax),
        net: round2(gross - tax),
        risk: s.risk || '—',
        liquidity: s.liquidity || '—'
      };
    });
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  }

  function parseMoney(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    // Remove R$, spaces, dots (thousands), replace comma with dot
    const cleaned = String(str)
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  function formatMonths(months) {
    if (!isFinite(months) || months === Infinity) return 'Indefinido (aporte insuficiente)';
    if (months === 0) return 'Já atingida!';
    const years = Math.floor(months / 12);
    const m = months % 12;
    if (years === 0) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
    if (m === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    return `${years} ${years === 1 ? 'ano' : 'anos'} e ${m} ${m === 1 ? 'mês' : 'meses'}`;
  }

  return {
    monthlyRate,
    futureValue,
    monthsToGoal,
    requiredMonthly,
    compoundTable,
    estimateIR,
    yieldBreakdown,
    emergencyFund,
    retirementProjection,
    compareInvestments,
    round2,
    formatMoney,
    parseMoney,
    formatMonths
  };
})();
