/**
 * Seavora — Goals page helpers (builds on Caixinhas)
 */

const Goals = (() => {
  function getGoalsView() {
    return Caixinhas.getAll().map(c => {
      const progress = Caixinhas.getProgress(c);
      const projected = Caixinhas.getProjectedDate(c);
      const settings = Storage.get().settings;
      const annualRate = (c.interestRate / 100) * (settings.cdiRate || 13.15);
      const monthsLeft = Calculators.monthsToGoal(
        c.balance,
        c.goal,
        c.monthlyContribution || 0,
        annualRate
      );
      return {
        ...c,
        progress,
        projected,
        monthsLeft,
        completed: progress >= 100
      };
    });
  }

  return { getGoalsView };
})();
