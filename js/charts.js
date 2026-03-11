/* ══════════════════════════════════════════════
   StocksWise — Inline Card Charts
   Mock data today, real NASDAQ data in the future.
   ══════════════════════════════════════════════ */

/* ── Theme colors from CSS variables ── */
function getThemeColors() {
  const cs = getComputedStyle(document.documentElement);
  const g = (v) => cs.getPropertyValue(v).trim();
  return {
    text:       g("--text"),
    textMuted:  g("--text-muted"),
    textStrong: g("--text-strong"),
    border:     g("--border"),
    accent:     g("--accent"),
    accentLight:g("--accent-light"),
    green:      g("--green"),
    red:        g("--red"),
    surface:    g("--surface"),
    bg:         g("--bg"),
  };
}

/* ── Seeded random for reproducible mock data ── */
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Shared chart defaults ── */
function baseScales(colors) {
  return {
    x: {
      grid: { color: colors.border, drawBorder: false },
      ticks: { color: colors.textMuted, font: { size: 10 }, maxTicksLimit: 6 },
    },
    y: {
      grid: { color: colors.border, drawBorder: false },
      ticks: { color: colors.textMuted, font: { size: 10 } },
    },
  };
}

/* ══════════════════════════════════════════════
   CHART 1 — Price Movement (supply & demand)
   ══════════════════════════════════════════════ */
function initPriceMovementChart() {
  const canvas = document.getElementById("chart-price-movement");
  if (!canvas) return null;
  const colors = getThemeColors();
  const rand = seededRandom(42);

  // Generate mock price data with a visible dip then rise
  const days = 60;
  const prices = [100];
  for (let i = 1; i < days; i++) {
    let trend = 0;
    if (i > 10 && i < 25) trend = -0.4;     // sellers dominate
    else if (i > 28 && i < 45) trend = 0.5;  // buyers dominate
    else trend = 0.05;
    prices.push(prices[i - 1] * (1 + (rand() - 0.48 + trend / 100) * 0.025));
  }

  // Find annotation points
  let minIdx = 10, maxIdx = 10;
  for (let i = 10; i < 30; i++) { if (prices[i] < prices[minIdx]) minIdx = i; }
  for (let i = 5; i < 20; i++)  { if (prices[i] > prices[maxIdx]) maxIdx = i; }

  const labels = Array.from({ length: days }, (_, i) => "Day " + (i + 1));

  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: colors.accent,
        backgroundColor: colors.accent + "18",
        fill: "origin",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            sellerZone: {
              type: "point",
              xValue: labels[maxIdx],
              yValue: prices[maxIdx],
              radius: 5,
              backgroundColor: colors.red,
              borderColor: colors.red,
              label: {
                display: true,
                content: "Sellers dominate",
                position: "start",
                backgroundColor: colors.red + "cc",
                color: "#fff",
                font: { size: 11, weight: "bold" },
                padding: 6,
                borderRadius: 4,
                yAdjust: -16,
              },
            },
            buyerZone: {
              type: "point",
              xValue: labels[minIdx],
              yValue: prices[minIdx],
              radius: 5,
              backgroundColor: colors.green,
              borderColor: colors.green,
              label: {
                display: true,
                content: "Buyers step in",
                position: "start",
                backgroundColor: colors.green + "cc",
                color: "#fff",
                font: { size: 11, weight: "bold" },
                padding: 6,
                borderRadius: 4,
                yAdjust: 20,
              },
            },
          },
        },
      },
      scales: {
        ...baseScales(colors),
        y: {
          ...baseScales(colors).y,
          ticks: {
            ...baseScales(colors).y.ticks,
            callback: (v) => "$" + v.toFixed(0),
          },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════
   CHART 2 — ETF vs Individual Stock
   ══════════════════════════════════════════════ */
function initETFvsStockChart() {
  const canvas = document.getElementById("chart-etf-vs-stock");
  if (!canvas) return null;
  const colors = getThemeColors();
  const rand = seededRandom(101);

  const days = 252;
  const etf = [100], stock = [100];
  for (let i = 1; i < days; i++) {
    etf.push(etf[i - 1] * (1 + (rand() - 0.48) * 0.012));
    stock.push(stock[i - 1] * (1 + (rand() - 0.47) * 0.035));
  }

  const labels = Array.from({ length: days }, (_, i) => {
    const m = Math.floor(i / 21);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return i % 21 === 0 ? months[m % 12] : "";
  });

  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "QQQ (ETF)",
          data: etf,
          borderColor: colors.green,
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: "NVDA (Stock)",
          data: stock,
          borderColor: colors.accent,
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "end",
          labels: { color: colors.textMuted, boxWidth: 12, padding: 12, font: { size: 11 } },
        },
        annotation: false,
      },
      scales: {
        ...baseScales(colors),
        y: {
          ...baseScales(colors).y,
          title: { display: true, text: "Growth ($100 start)", color: colors.textMuted, font: { size: 10 } },
          ticks: {
            ...baseScales(colors).y.ticks,
            callback: (v) => "$" + v.toFixed(0),
          },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════
   CHART 3 — Rolling Volatility Comparison
   ══════════════════════════════════════════════ */
function initVolatilityChart() {
  const canvas = document.getElementById("chart-volatility");
  if (!canvas) return null;
  const colors = getThemeColors();
  const rand = seededRandom(77);

  const days = 252;
  const window = 20;

  // Generate daily returns
  const etfReturns = [], stockReturns = [];
  for (let i = 0; i < days; i++) {
    etfReturns.push((rand() - 0.5) * 0.015);
    stockReturns.push((rand() - 0.5) * 0.045);
  }

  // Compute rolling std
  function rollingVol(returns, w) {
    const result = [];
    for (let i = 0; i < returns.length; i++) {
      if (i < w - 1) { result.push(null); continue; }
      const slice = returns.slice(i - w + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b) / w;
      const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / w;
      result.push(Math.sqrt(variance) * Math.sqrt(252) * 100);
    }
    return result;
  }

  const etfVol = rollingVol(etfReturns, window);
  const stockVol = rollingVol(stockReturns, window);

  const labels = Array.from({ length: days }, (_, i) => {
    const m = Math.floor(i / 21);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return i % 21 === 0 ? months[m % 12] : "";
  });

  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "QQQ (ETF)",
          data: etfVol,
          borderColor: colors.green,
          backgroundColor: colors.green + "20",
          fill: "origin",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: "NVDA (Stock)",
          data: stockVol,
          borderColor: colors.red,
          backgroundColor: colors.red + "18",
          fill: "origin",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "end",
          labels: { color: colors.textMuted, boxWidth: 12, padding: 12, font: { size: 11 } },
        },
        annotation: false,
      },
      scales: {
        ...baseScales(colors),
        y: {
          ...baseScales(colors).y,
          title: { display: true, text: "Annualized Volatility (%)", color: colors.textMuted, font: { size: 10 } },
          ticks: {
            ...baseScales(colors).y.ticks,
            callback: (v) => v.toFixed(0) + "%",
          },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════
   CHART 4 — Max Drawdown
   ══════════════════════════════════════════════ */
function initDrawdownChart() {
  const canvas = document.getElementById("chart-drawdown");
  if (!canvas) return null;
  const colors = getThemeColors();
  const rand = seededRandom(55);

  const days = 252;
  const prices = [150];
  for (let i = 1; i < days; i++) {
    let trend = 0.0003;
    if (i > 80 && i < 130) trend = -0.004;  // simulate a crash
    if (i > 130 && i < 200) trend = 0.002;   // recovery
    prices.push(prices[i - 1] * (1 + trend + (rand() - 0.5) * 0.025));
  }

  // Compute drawdown
  let peak = prices[0];
  const drawdown = prices.map((p) => {
    if (p > peak) peak = p;
    return ((p - peak) / peak) * 100;
  });

  const maxDD = Math.min(...drawdown);
  const maxDDIdx = drawdown.indexOf(maxDD);

  const labels = Array.from({ length: days }, (_, i) => {
    const m = Math.floor(i / 21);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return i % 21 === 0 ? months[m % 12] : "";
  });

  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Drawdown",
        data: drawdown,
        borderColor: colors.red,
        backgroundColor: colors.red + "20",
        fill: "origin",
        borderWidth: 1.8,
        pointRadius: 0,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            maxDDLine: {
              type: "line",
              yMin: maxDD,
              yMax: maxDD,
              borderColor: colors.red,
              borderWidth: 1.5,
              borderDash: [6, 4],
              label: {
                display: true,
                content: "Max Drawdown: " + maxDD.toFixed(1) + "%",
                position: "start",
                backgroundColor: colors.red + "cc",
                color: "#fff",
                font: { size: 11, weight: "bold" },
                padding: 6,
                borderRadius: 4,
              },
            },
          },
        },
      },
      scales: {
        ...baseScales(colors),
        y: {
          ...baseScales(colors).y,
          ticks: {
            ...baseScales(colors).y.ticks,
            callback: (v) => v.toFixed(0) + "%",
          },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════
   INIT & THEME REACTIVITY
   ══════════════════════════════════════════════ */
let chartInstances = [];

function initAllCharts() {
  chartInstances.forEach((c) => c && c.destroy());
  chartInstances = [
    initPriceMovementChart(),
    initETFvsStockChart(),
    initVolatilityChart(),
    initDrawdownChart(),
  ];
}

function updateChartThemes() {
  const colors = getThemeColors();
  chartInstances.forEach((chart) => {
    if (!chart) return;
    const sx = chart.options.scales.x;
    const sy = chart.options.scales.y;
    if (sx) { sx.grid.color = colors.border; sx.ticks.color = colors.textMuted; }
    if (sy) {
      sy.grid.color = colors.border;
      sy.ticks.color = colors.textMuted;
      if (sy.title) sy.title.color = colors.textMuted;
    }
    if (chart.options.plugins.legend && chart.options.plugins.legend.labels) {
      chart.options.plugins.legend.labels.color = colors.textMuted;
    }
    chart.update("none");
  });
}

document.addEventListener("DOMContentLoaded", initAllCharts);
document.addEventListener("sw-theme-change", updateChartThemes);
