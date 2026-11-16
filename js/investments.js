/**
 * Seavora — Educational investment content & profile quiz
 * All content is educational, not financial advice.
 */

const Investments = (() => {
  const PRODUCTS = [
    {
      id: 'poupanca',
      name: 'Poupança',
      risk: 'low',
      riskLabel: 'Baixo',
      type: 'Renda Fixa',
      liquidity: 'Diária (após aniversário)',
      what: 'Conta de depósito popular com rendimento definido por regra oficial (TR + taxa).',
      how: 'O rendimento é creditado mensalmente na data de aniversário do depósito. Liquidez diária após o aniversário.',
      forWhom: 'Quem busca simplicidade e acesso imediato, com tolerância baixa a risco.',
      example: 'Você deposita R$ 1.000. No aniversário do mês, recebe o rendimento proporcional à regra vigente.',
      defaultRateNote: 'Rendimento atrelado à Selic/TR — use taxa de simulação editável.'
    },
    {
      id: 'cdb',
      name: 'CDB',
      risk: 'low',
      riskLabel: 'Baixo a Moderado',
      type: 'Renda Fixa',
      liquidity: 'Varia (DI ou no vencimento)',
      what: 'Certificado de Depósito Bancário — título emitido por bancos. Pode render % do CDI.',
      how: 'Você empresta dinheiro ao banco e recebe juros. Pode ser prefixado, pós-fixado (% CDI) ou híbrido.',
      forWhom: 'Quem quer renda fixa com potencial de render mais que a poupança, aceitando travar o capital por um prazo.',
      example: 'CDB 100% CDI: se o CDI anual for 13%, a taxa efetiva acompanha aproximadamente esse patamar (simulação).',
      defaultRateNote: 'Taxas variam por emissor e prazo. Simule com % do CDI.'
    },
    {
      id: 'rdb',
      name: 'RDB / Caixinha',
      risk: 'low',
      riskLabel: 'Baixo',
      type: 'Renda Fixa',
      liquidity: 'Conforme produto',
      what: 'Recibo de Depósito Bancário ou produto similar de “caixinha” oferecido por instituições.',
      how: 'Funciona de forma parecida a um CDB: você aplica e recebe remuneração, muitas vezes atrelada ao CDI.',
      forWhom: 'Organização de metas com rendimento de renda fixa e regras claras de liquidez.',
      example: 'Caixinha com 100% CDI estimada — use apenas como parâmetro de simulação.',
      defaultRateNote: 'Condições reais dependem da instituição e do momento.'
    },
    {
      id: 'tesouro-selic',
      name: 'Tesouro Selic',
      risk: 'low',
      riskLabel: 'Baixo',
      type: 'Renda Fixa (Tesouro Direto)',
      liquidity: 'D+1 (dias úteis)',
      what: 'Título público federal atrelado à taxa Selic. Considerado um dos mais seguros do país.',
      how: 'O preço acompanha a Selic. Ideal para reserva e liquidez com baixo risco de crédito.',
      forWhom: 'Reserva de emergência e quem prioriza segurança e liquidez.',
      example: 'Aplicação de R$ 1.000 que acompanha a variação da Selic ao longo do tempo (simulação).',
      defaultRateNote: 'Use a Selic/CDI estimada como proxy em simulações educacionais.'
    },
    {
      id: 'tesouro-ipca',
      name: 'Tesouro IPCA+',
      risk: 'mid',
      riskLabel: 'Moderado',
      type: 'Renda Fixa (Tesouro Direto)',
      liquidity: 'Mercado secundário (marcação a mercado)',
      what: 'Título que paga uma taxa fixa + variação da inflação (IPCA).',
      how: 'Protege o poder de compra no longo prazo. O preço no mercado pode oscilar (marcação a mercado).',
      forWhom: 'Objetivos de longo prazo (aposentadoria, casa) com horizonte definido.',
      example: 'IPCA + 5% a.a. — o valor real cresce acima da inflação se mantido até o vencimento.',
      defaultRateNote: 'Simulações devem deixar claro que são estimativas.'
    },
    {
      id: 'lci-lca',
      name: 'LCI / LCA',
      risk: 'low',
      riskLabel: 'Baixo',
      type: 'Renda Fixa',
      liquidity: 'No vencimento (geralmente)',
      what: 'Letras de Crédito Imobiliário e do Agronegócio. Isentas de IR para pessoa física (regra geral).',
      how: 'Emitidas por bancos para financiar setores específicos. Remuneração pode ser % CDI ou prefixada.',
      forWhom: 'Quem busca isenção de IR em renda fixa e aceita menor liquidez.',
      example: 'LCI 90% CDI isenta de IR — o líquido pode superar um CDB 100% CDI tributado, dependendo do prazo.',
      defaultRateNote: 'Isenção e condições dependem da legislação vigente.'
    },
    {
      id: 'fundos',
      name: 'Fundos de Investimento',
      risk: 'mid',
      riskLabel: 'Variável',
      type: 'Coletivo',
      liquidity: 'Conforme regulamento (D+0 a D+30+)',
      what: 'Condomínio de investidores gerido por profissionais. Existem fundos de RF, multimercado, ações etc.',
      how: 'Você compra cotas. A rentabilidade depende da estratégia e do mercado. Há taxa de administração e, às vezes, performance.',
      forWhom: 'Quem prefere delegar a gestão e aceita custos e regras de liquidez do fundo.',
      example: 'Fundo DI que busca acompanhar o CDI, descontadas as taxas.',
      defaultRateNote: 'Rentabilidade passada não garante futura. Simule com taxa líquida estimada.'
    },
    {
      id: 'etf',
      name: 'ETFs',
      risk: 'high',
      riskLabel: 'Moderado a Alto',
      type: 'Renda Variável',
      liquidity: 'Bolsa (horário de pregão)',
      what: 'Fundos negociados em bolsa que replicam índices (Ibovespa, S&P 500, renda fixa etc.).',
      how: 'Compra e venda como ações. Diversificação em um único ativo. Sujeito a oscilação de preço.',
      forWhom: 'Quem quer exposição a um índice com custo relativamente baixo e aceita volatilidade.',
      example: 'ETF de índice de ações: o valor sobe e desce com o mercado.',
      defaultRateNote: 'Não use taxa fixa — é renda variável. Simulações de “taxa esperada” são hipotéticas.'
    },
    {
      id: 'acoes',
      name: 'Ações',
      risk: 'high',
      riskLabel: 'Alto',
      type: 'Renda Variável',
      liquidity: 'Bolsa (horário de pregão)',
      what: 'Frações do capital de empresas listadas. Você se torna sócio e pode receber dividendos.',
      how: 'Preço definido pelo mercado. Lucro ou prejuízo na venda. Dividendos e JCP conforme política da empresa.',
      forWhom: 'Horizonte longo, tolerância a oscilações e interesse em acompanhar negócios.',
      example: 'Compra de ações de uma empresa: o patrimônio varia diariamente com o preço da ação.',
      defaultRateNote: 'Não há taxa garantida. Qualquer projeção é especulativa e educacional.'
    },
    {
      id: 'fiis',
      name: 'FIIs (Fundos Imobiliários)',
      risk: 'high',
      riskLabel: 'Moderado a Alto',
      type: 'Renda Variável',
      liquidity: 'Bolsa',
      what: 'Fundos que investem em imóveis ou títulos do setor imobiliário. Distribuem rendimentos periódicos.',
      how: 'Cotas negociadas em bolsa. Rendimentos isentos de IR para PF em muitos casos (regras específicas).',
      forWhom: 'Quem busca renda periódica e exposição ao setor imobiliário via mercado de capitais.',
      example: 'FII de tijolo (shoppings, lajes) ou de papel (CRIs). Preço da cota oscila.',
      defaultRateNote: 'Dividend yield passado não garante futuro. Preço da cota é volátil.'
    }
  ];

  const EDU_ARTICLES = [
    {
      id: 'cdi',
      title: 'O que é CDI?',
      icon: '📊',
      summary: 'Certificado de Depósito Interbancário — taxa de referência do mercado.',
      content: `O CDI (Certificado de Depósito Interbancário) é uma taxa de juros praticada nos empréstimos entre bancos de um dia para o outro. Ela acompanha de perto a taxa Selic.

Muitos produtos de renda fixa (CDB, LCI, fundos DI) usam o CDI como referência: “100% do CDI” significa que a remuneração busca acompanhar essa taxa.

<strong>Importante:</strong> Em simulações, a taxa de CDI utilizada é apenas um parâmetro editável. A taxa real varia com o tempo e as condições de mercado.`
    },
    {
      id: 'selic',
      title: 'O que é Selic?',
      icon: '🏛️',
      summary: 'A taxa básica de juros da economia brasileira.',
      content: `A Selic é a taxa básica de juros definida pelo Banco Central. Ela influencia o custo do crédito, o rendimento da renda fixa e a atividade econômica.

O Tesouro Selic, por exemplo, acompanha essa taxa. Quando a Selic sobe, o custo de oportunidade de aplicações de baixo risco também sobe.

<strong>Nas simulações do Seavora:</strong> você pode ajustar a taxa usada como proxy da Selic/CDI nas projeções educacionais.`
    },
    {
      id: 'juros-compostos',
      title: 'O que são juros compostos?',
      icon: '📈',
      summary: 'Juros sobre juros — o efeito bola de neve do tempo.',
      content: `Nos juros compostos, o rendimento de um período passa a render nos períodos seguintes. É o contrário dos juros simples, em que só o capital inicial rende.

Fórmula básica do montante: M = C × (1 + i)^n

Onde C é o capital, i a taxa e n o número de períodos.

Com aportes mensais, o efeito se potencializa. Por isso o tempo e a consistência importam tanto no longo prazo.

<strong>Seavora</strong> usa juros compostos reais em todas as calculadoras e projeções.`
    },
    {
      id: 'liquidez',
      title: 'O que é liquidez?',
      icon: '💧',
      summary: 'Facilidade de transformar o investimento em dinheiro disponível.',
      content: `Liquidez alta = você resgata rápido e com pouco ou nenhum custo/deságio.
Liquidez baixa = o capital fica preso até o vencimento ou há custo para sair antes.

Exemplos:
• Conta e alguns CDBs DI: liquidez diária
• LCI/LCA e CDBs com carência: liquidez no vencimento
• Ações e ETFs: liquidez em pregão, mas o preço oscila

Reserve sempre uma parte do patrimônio em ativos líquidos para imprevistos.`
    },
    {
      id: 'inflacao',
      title: 'O que é inflação?',
      icon: '📉',
      summary: 'Aumento geral dos preços — reduz o poder de compra.',
      content: `A inflação mede a perda do poder de compra da moeda. No Brasil, o IPCA é o índice oficial mais usado.

Se seu dinheiro rende 10% ao ano e a inflação é 5%, o ganho real é aproximadamente 4,8% (aproximação).

Por isso é importante olhar a rentabilidade real (acima da inflação), especialmente em objetivos de longo prazo. Títulos como Tesouro IPCA+ ajudam a proteger o poder de compra.`
    },
    {
      id: 'fgc',
      title: 'O que é FGC?',
      icon: '🛡️',
      summary: 'Fundo Garantidor de Créditos — proteção em caso de quebra da instituição.',
      content: `O FGC garante depósitos e aplicações em instituições participantes até o limite de R$ 250 mil por CPF e por instituição (regras vigentes — consulte sempre fontes oficiais).

Cobertos tipicamente: conta corrente, poupança, CDB, LCI, LCA, RDB, entre outros.

Não cobre: fundos de investimento, Tesouro Direto, ações, ETFs, criptomoedas etc.

<strong>Atenção:</strong> a garantia tem limites e condições. Diversificar instituições pode ser prudente se o valor for elevado.`
    },
    {
      id: 'diversificacao',
      title: 'O que é diversificação?',
      icon: '🧩',
      summary: 'Não colocar todos os ovos na mesma cesta.',
      content: `Diversificar significa distribuir o patrimônio entre diferentes tipos de ativos, emissores, prazos e riscos.

Objetivo: reduzir o impacto de um único evento negativo sobre o todo.

Exemplos de eixos de diversificação:
• Classes: renda fixa × variável
• Emissores: vários bancos / títulos públicos
• Prazos: curto, médio e longo
• Geografia: Brasil e exterior (quando aplicável)

Diversificar não elimina risco, mas pode suavizar a volatilidade do patrimônio.`
    },
    {
      id: 'renda-fixa',
      title: 'O que é renda fixa?',
      icon: '📌',
      summary: 'Investimentos com regras de remuneração definidas no momento da aplicação.',
      content: `Na renda fixa, você sabe (ou tem uma regra clara) de como será a remuneração: prefixada, pós-fixada (% CDI/Selic) ou híbrida (IPCA + taxa).

Exemplos: Tesouro Direto, CDB, LCI/LCA, debêntures, CRIs/CRAs.

Riscos principais: crédito (do emissor), liquidez e, em alguns casos, marcação a mercado (oscilação de preço se vender antes do vencimento).

É a base de muitas carteiras conservadoras e de reservas de emergência.`
    },
    {
      id: 'renda-variavel',
      title: 'O que é renda variável?',
      icon: '📊',
      summary: 'Ativos cujo retorno não é conhecido de antemão e oscila com o mercado.',
      content: `Ações, FIIs, ETFs de ações, opções e outros ativos de bolsa são renda variável.

Não há taxa garantida. O preço sobe e desce conforme oferta, demanda, resultados das empresas e o cenário macro.

Potencial de retorno no longo prazo historicamente maior, acompanhado de volatilidade e possibilidade de perda de capital.

Adequado apenas para quem tem horizonte longo e tolerância a oscilações — e após a reserva de emergência estar formada.`
    },
    {
      id: 'marcacao',
      title: 'O que é marcação a mercado?',
      icon: '🏷️',
      summary: 'Atualização do preço do título conforme as condições atuais do mercado.',
      content: `Títulos de renda fixa negociados no mercado secundário têm preço que varia com as taxas de juros.

Se as taxas sobem, o preço de um título prefixado antigo tende a cair (e vice-versa). Isso é a marcação a mercado.

Se você carregar o título até o vencimento, recebe as condições contratadas (no caso de títulos públicos e muitos privados). A oscilação importa principalmente se precisar vender antes.

Por isso liquidez e horizonte devem combinar com o tipo de título escolhido.`
    }
  ];

  const QUIZ = [
    {
      q: 'Qual é o seu principal objetivo ao investir?',
      options: [
        { text: 'Proteger o dinheiro e ter liquidez', score: 1 },
        { text: 'Crescer de forma moderada com algum risco', score: 2 },
        { text: 'Maximizar o retorno no longo prazo', score: 3 },
        { text: 'Buscar retornos altos mesmo com grande volatilidade', score: 4 }
      ]
    },
    {
      q: 'Em quanto tempo você pretende usar a maior parte desse dinheiro?',
      options: [
        { text: 'Menos de 1 ano', score: 1 },
        { text: '1 a 3 anos', score: 2 },
        { text: '3 a 7 anos', score: 3 },
        { text: 'Mais de 7 anos', score: 4 }
      ]
    },
    {
      q: 'Se sua carteira caísse 20% em um mês, você...',
      options: [
        { text: 'Venderia tudo para não perder mais', score: 1 },
        { text: 'Ficaria preocupado, mas manteria', score: 2 },
        { text: 'Aproveitaria para aportar mais', score: 3 },
        { text: 'Mal notaria — foco no longo prazo', score: 4 }
      ]
    },
    {
      q: 'Como você avalia seu conhecimento sobre investimentos?',
      options: [
        { text: 'Iniciante — ainda estou aprendendo', score: 1 },
        { text: 'Básico — conheço os principais produtos', score: 2 },
        { text: 'Intermediário — já invisto há algum tempo', score: 3 },
        { text: 'Avançado — acompanho mercados e estratégias', score: 4 }
      ]
    },
    {
      q: 'Quanto do seu patrimônio precisa estar disponível rapidamente?',
      options: [
        { text: 'A maior parte — preciso de liquidez alta', score: 1 },
        { text: 'Uma reserva de 3–6 meses e o resto pode ficar aplicado', score: 2 },
        { text: 'Pouca necessidade de liquidez imediata', score: 3 },
        { text: 'Quase nenhuma — horizonte muito longo', score: 4 }
      ]
    }
  ];

  function profileFromScore(score) {
    if (score <= 7) return {
      name: 'Conservador',
      desc: 'Prioriza segurança e liquidez. Renda fixa de baixo risco costuma fazer mais sentido como base. Qualquer exposição a renda variável deve ser pequena e consciente.',
      color: 'low'
    };
    if (score <= 12) return {
      name: 'Moderado',
      desc: 'Aceita alguma oscilação em busca de retorno um pouco maior. Combinação de renda fixa com uma parcela moderada de risco pode ser considerada — sempre alinhada aos objetivos.',
      color: 'mid'
    };
    if (score <= 16) return {
      name: 'Arrojado',
      desc: 'Horizonte mais longo e tolerância a volatilidade. Pode destinar parcela relevante a renda variável, mantendo uma base de segurança.',
      color: 'mid'
    };
    return {
      name: 'Agressivo',
      desc: 'Foco em maximizar retorno no longo prazo, aceitando grandes oscilações. Ainda assim, reserva de emergência e diversificação continuam importantes.',
      color: 'high'
    };
  }

  const ACHIEVEMENTS_DEF = [
    { id: 'first_aporte', icon: '🏆', name: 'Primeiro aporte', desc: 'Fez seu primeiro aporte' },
    { id: 'first_100', icon: '💯', name: 'Primeiros R$ 100', desc: 'Acumulou R$ 100' },
    { id: 'first_1000', icon: '🥇', name: 'Primeiros R$ 1.000', desc: 'Acumulou R$ 1.000' },
    { id: 'first_10000', icon: '💎', name: 'R$ 10.000', desc: 'Acumulou R$ 10.000' },
    { id: 'first_goal', icon: '🎯', name: 'Primeira meta', desc: 'Concluiu uma meta' },
    { id: '3_months', icon: '🔥', name: '3 meses investindo', desc: 'Manteve o hábito por 3 meses' }
  ];

  const CHALLENGES_DEF = [
    { id: 'c1000', name: 'Desafio dos R$ 1.000', target: 1000, desc: 'Acumule R$ 1.000 no total' },
    { id: 'c5000', name: 'Desafio dos R$ 5.000', target: 5000, desc: 'Acumule R$ 5.000 no total' },
    { id: 'c52', name: 'Desafio dos 52 depósitos', target: 52, type: 'count', desc: 'Faça 52 aportes (um por semana em um ano)' },
    { id: 'c12m', name: 'Desafio de 12 meses', target: 12, type: 'months', desc: 'Invista por 12 meses consecutivos' }
  ];

  return {
    PRODUCTS,
    EDU_ARTICLES,
    QUIZ,
    profileFromScore,
    ACHIEVEMENTS_DEF,
    CHALLENGES_DEF
  };
})();
