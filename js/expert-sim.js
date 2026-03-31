/* ══════════════════════════════════════════════
   StocksWise — Expert Simulation Tools
   Strategy Backtester, Portfolio Builder, Crisis Stress Test
   ══════════════════════════════════════════════ */

/* ── Helper: Plotly layout/config reused from expert.js ── */
function simPlotlyLayout(overrides = {}) {
  const cs = getComputedStyle(document.documentElement);
  const g = (v) => cs.getPropertyValue(v).trim();
  const base = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter, sans-serif", color: g("--text-muted"), size: 11 },
    margin: { l: 55, r: 20, t: 10, b: 40 },
    xaxis: { gridcolor: g("--border"), zerolinecolor: g("--border") },
    yaxis: { gridcolor: g("--border"), zerolinecolor: g("--border") },
    dragmode: "zoom",
    hovermode: "x unified",
  };
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === "object" && !Array.isArray(overrides[key]) && base[key]) {
      base[key] = { ...base[key], ...overrides[key] };
    } else {
      base[key] = overrides[key];
    }
  }
  return base;
}

function simPlotlyConfig() {
  return { responsive: true, displayModeBar: false, scrollZoom: true };
}

const SIM_TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "TSLA", "GOOG", "META", "NFLX", "AMD", "QQQ"];

/* ══════════════════════════════════════════════
   TOOL 1 — Strategy Backtester
   ══════════════════════════════════════════════ */
async function runBacktest() {
  const ticker = document.getElementById("bt-ticker").value;
  const startDate = document.getElementById("bt-start").value;
  const endDate = document.getElementById("bt-end").value;
  const capital = parseFloat(document.getElementById("bt-capital").value) || 1000;
  const entryRule = document.querySelector("input[name='bt-entry']:checked")?.value;
  const exitRule = document.querySelector("input[name='bt-exit']:checked")?.value;
  const exitDays = parseInt(document.getElementById("bt-exit-days")?.value) || 20;

  const chartEl = document.getElementById("bt-chart");
  const statsEl = document.getElementById("bt-stats");
  if (!chartEl) return;
  chartEl.innerHTML = '<div class="chart-loading">Running backtest...</div>';
  if (statsEl) statsEl.innerHTML = "";

  const data = await StockData.loadTicker(ticker);
  if (!data) { chartEl.innerHTML = '<div class="chart-loading">Could not load data</div>'; return; }

  const filtered = StockData.filterByDate(data, startDate, endDate);
  if (filtered.length < 60) { chartEl.innerHTML = '<div class="chart-loading">Not enough data for this period</div>'; return; }

  // Compute indicators
  const rsi = StockData.computeRSI(filtered, 14);
  const sma50 = StockData.computeSMA(filtered, 50);
  const macd = StockData.computeMACD(filtered);

  // Simulate trades
  const trades = [];
  let position = null; // { entryIdx, entryPrice }
  let cash = capital;
  let shares = 0;
  const portfolioValues = [];

  for (let i = 50; i < filtered.length; i++) {
    const price = filtered[i].close;

    // Entry signals
    if (!position) {
      let shouldBuy = false;
      if (entryRule === "rsi30" && rsi[i] !== null && rsi[i - 1] !== null && rsi[i - 1] >= 30 && rsi[i] < 30) shouldBuy = true;
      if (entryRule === "sma50" && sma50[i] !== null && sma50[i - 1] !== null && filtered[i - 1].close < sma50[i - 1] && price >= sma50[i]) shouldBuy = true;
      if (entryRule === "macd" && macd.macdLine[i] !== null && macd.signal[i] !== null && macd.macdLine[i - 1] < macd.signal[i - 1] && macd.macdLine[i] >= macd.signal[i]) shouldBuy = true;

      if (shouldBuy) {
        shares = cash / price;
        position = { entryIdx: i, entryPrice: price };
        trades.push({ type: "buy", date: filtered[i].date, price, idx: i });
        cash = 0;
      }
    }
    // Exit signals
    else {
      let shouldSell = false;
      if (exitRule === "rsi70" && rsi[i] !== null && rsi[i] > 70) shouldSell = true;
      if (exitRule === "sma50down" && sma50[i] !== null && price < sma50[i]) shouldSell = true;
      if (exitRule === "days" && (i - position.entryIdx) >= exitDays) shouldSell = true;

      if (shouldSell) {
        cash = shares * price;
        trades.push({ type: "sell", date: filtered[i].date, price, idx: i, profit: price > position.entryPrice });
        shares = 0;
        position = null;
      }
    }

    const value = position ? shares * price : cash;
    portfolioValues.push({ date: filtered[i].date, value, idx: i });
  }

  // Close any open position at the end
  if (position) {
    cash = shares * filtered[filtered.length - 1].close;
    shares = 0;
  }

  const finalValue = cash;
  const buyHoldValue = (filtered[filtered.length - 1].close / filtered[50].close) * capital;

  // Compute stats
  const totalReturn = ((finalValue - capital) / capital) * 100;
  const buyHoldReturn = ((buyHoldValue - capital) / capital) * 100;
  const numTrades = trades.filter(t => t.type === "sell").length;
  const winTrades = trades.filter(t => t.type === "sell" && t.profit).length;
  const winRate = numTrades > 0 ? (winTrades / numTrades * 100) : 0;

  // Sharpe from portfolio values
  const pvReturns = [];
  for (let i = 1; i < portfolioValues.length; i++) {
    pvReturns.push(portfolioValues[i].value / portfolioValues[i - 1].value - 1);
  }
  const avgR = pvReturns.reduce((a, b) => a + b, 0) / pvReturns.length;
  const stdR = Math.sqrt(pvReturns.reduce((a, b) => a + (b - avgR) ** 2, 0) / (pvReturns.length - 1));
  const sharpe = stdR > 0 ? (avgR * 252 - 0.02) / (stdR * Math.sqrt(252)) : 0;

  // Max drawdown of strategy
  let peak = -Infinity, maxDD = 0;
  portfolioValues.forEach(pv => {
    if (pv.value > peak) peak = pv.value;
    const dd = (peak - pv.value) / peak;
    if (dd > maxDD) maxDD = dd;
  });

  // Chart
  const dates = portfolioValues.map(p => p.date);
  const cs = getComputedStyle(document.documentElement);
  const green = cs.getPropertyValue("--green").trim();
  const red = cs.getPropertyValue("--red").trim();
  const accent = cs.getPropertyValue("--accent").trim();

  const buyDates = trades.filter(t => t.type === "buy").map(t => t.date);
  const buyPrices = trades.filter(t => t.type === "buy").map(t => {
    const pv = portfolioValues.find(p => p.date === t.date);
    return pv ? pv.value : capital;
  });
  const sellDates = trades.filter(t => t.type === "sell").map(t => t.date);
  const sellPrices = trades.filter(t => t.type === "sell").map(t => {
    const pv = portfolioValues.find(p => p.date === t.date);
    return pv ? pv.value : capital;
  });

  const buyHoldSeries = portfolioValues.map(p => {
    const idx = filtered.findIndex(f => f.date === p.date);
    return (filtered[idx].close / filtered[50].close) * capital;
  });

  chartEl.innerHTML = "";
  Plotly.newPlot(chartEl, [
    {
      x: dates, y: portfolioValues.map(p => p.value), type: "scatter", mode: "lines",
      name: "Strategy", line: { color: accent, width: 2 },
    },
    {
      x: dates, y: buyHoldSeries, type: "scatter", mode: "lines",
      name: "Buy & Hold", line: { color: "#787b86", width: 1.5, dash: "dash" },
    },
    {
      x: buyDates, y: buyPrices, type: "scatter", mode: "markers",
      name: "Buy", marker: { color: green, size: 10, symbol: "triangle-up" },
    },
    {
      x: sellDates, y: sellPrices, type: "scatter", mode: "markers",
      name: "Sell", marker: { color: red, size: 10, symbol: "triangle-down" },
    },
  ], simPlotlyLayout({
    height: 380,
    yaxis: { title: "Portfolio Value (€)" },
    legend: { x: 0.02, y: 0.98, bgcolor: "rgba(0,0,0,0)" },
  }), simPlotlyConfig());

  // Stats
  if (statsEl) {
    const fmt = (v, prefix = "") => {
      const cls = v >= 0 ? "positive" : "negative";
      return `<div class="value ${cls}">${prefix}${v >= 0 ? "+" : ""}${v.toFixed(1)}${prefix ? "" : "%"}</div>`;
    };
    statsEl.innerHTML = `
      <div class="backtest-stat"><div class="label">Total Return</div>${fmt(totalReturn)}</div>
      <div class="backtest-stat"><div class="label">vs Buy & Hold</div>${fmt(totalReturn - buyHoldReturn)}</div>
      <div class="backtest-stat"><div class="label">Trades</div><div class="value">${numTrades}</div></div>
      <div class="backtest-stat"><div class="label">Win Rate</div><div class="value ${winRate >= 50 ? "positive" : "negative"}">${winRate.toFixed(0)}%</div></div>
      <div class="backtest-stat"><div class="label">Sharpe Ratio</div><div class="value">${sharpe.toFixed(2)}</div></div>
      <div class="backtest-stat"><div class="label">Max Drawdown</div><div class="value negative">-${(maxDD * 100).toFixed(1)}%</div></div>
    `;
  }
}

/* ══════════════════════════════════════════════
   TOOL 2 — Portfolio Builder
   ══════════════════════════════════════════════ */

let pbTickers = [];

function pbAddTicker() {
  const select = document.getElementById("pb-add-ticker");
  const ticker = select.value;
  if (pbTickers.includes(ticker) || pbTickers.length >= 6) return;
  pbTickers.push(ticker);
  renderPBSliders();
}

function pbRemoveTicker(ticker) {
  pbTickers = pbTickers.filter(t => t !== ticker);
  renderPBSliders();
}

function renderPBSliders() {
  const container = document.getElementById("pb-sliders");
  if (!container) return;
  if (pbTickers.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Add tickers above to build your portfolio.</p>';
    return;
  }

  const equalWeight = Math.floor(100 / pbTickers.length);
  container.innerHTML = pbTickers.map((t, i) => `
    <div class="weight-slider-row">
      <span class="ticker-label">${t}</span>
      <input type="range" min="0" max="100" value="${equalWeight}" class="pb-weight" data-ticker="${t}" oninput="updatePBWeights()">
      <span class="weight-value" id="pb-w-${t}">${equalWeight}%</span>
      <button onclick="pbRemoveTicker('${t}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;padding:0 0.3rem;">×</button>
    </div>
  `).join("");
  updatePBWeights();
}

function updatePBWeights() {
  const sliders = document.querySelectorAll(".pb-weight");
  let total = 0;
  sliders.forEach(s => {
    const val = parseInt(s.value);
    total += val;
    const label = document.getElementById("pb-w-" + s.dataset.ticker);
    if (label) label.textContent = val + "%";
  });
  const totalEl = document.getElementById("pb-total");
  if (totalEl) {
    totalEl.textContent = `Total: ${total}%`;
    totalEl.className = "weight-total " + (total === 100 ? "valid" : "invalid");
  }
}

async function runPortfolioBuilder() {
  const chartEl = document.getElementById("pb-chart");
  const corrEl = document.getElementById("pb-corr");
  const frontierEl = document.getElementById("pb-frontier");
  const statsEl = document.getElementById("pb-stats");
  if (!chartEl) return;

  const sliders = document.querySelectorAll(".pb-weight");
  const weights = [];
  sliders.forEach(s => weights.push(parseInt(s.value) / 100));
  const totalW = weights.reduce((a, b) => a + b, 0);

  if (pbTickers.length < 2 || Math.abs(totalW - 1) > 0.02) {
    chartEl.innerHTML = '<div class="chart-loading">Add at least 2 tickers and ensure weights sum to 100%</div>';
    return;
  }

  const startDate = document.getElementById("pb-start").value;
  const endDate = document.getElementById("pb-end").value;
  const capital = parseFloat(document.getElementById("pb-capital").value) || 10000;

  chartEl.innerHTML = '<div class="chart-loading">Building portfolio...</div>';
  if (corrEl) corrEl.innerHTML = '<div class="chart-loading">Computing...</div>';
  if (frontierEl) frontierEl.innerHTML = '<div class="chart-loading">Computing...</div>';

  const datasets = await Promise.all(pbTickers.map(t => StockData.loadTicker(t)));
  if (datasets.some(d => !d)) {
    chartEl.innerHTML = '<div class="chart-loading">Failed to load some ticker data</div>';
    return;
  }

  const filtered = datasets.map(d => StockData.filterByDate(d, startDate, endDate));
  const portfolio = StockData.computePortfolioValue(filtered, weights, capital);
  if (portfolio.length < 2) {
    chartEl.innerHTML = '<div class="chart-loading">Not enough overlapping data</div>';
    return;
  }

  // Benchmark: QQQ
  const qqq = await StockData.loadTicker("QQQ");
  let benchmarkTrace = null;
  if (qqq) {
    const qqFiltered = StockData.filterByDate(qqq, startDate, endDate);
    if (qqFiltered.length > 1) {
      const qqStart = qqFiltered[0].close;
      benchmarkTrace = {
        x: qqFiltered.map(d => d.date),
        y: qqFiltered.map(d => (d.close / qqStart) * capital),
        type: "scatter", mode: "lines",
        name: "QQQ Benchmark", line: { color: "#787b86", width: 1.5, dash: "dash" },
      };
    }
  }

  const cs = getComputedStyle(document.documentElement);
  const accent = cs.getPropertyValue("--accent").trim();

  // Portfolio chart
  const traces = [{
    x: portfolio.map(d => d.date), y: portfolio.map(d => d.value),
    type: "scatter", mode: "lines", name: "Your Portfolio",
    line: { color: accent, width: 2 },
    fill: "tozeroy", fillcolor: "rgba(41,98,255,0.06)",
  }];
  if (benchmarkTrace) traces.push(benchmarkTrace);

  chartEl.innerHTML = "";
  Plotly.newPlot(chartEl, traces, simPlotlyLayout({
    height: 350, yaxis: { title: "Portfolio Value (€)" },
    legend: { x: 0.02, y: 0.98, bgcolor: "rgba(0,0,0,0)" },
  }), simPlotlyConfig());

  // Correlation heatmap
  if (corrEl && pbTickers.length >= 2) {
    const returnSets = filtered.map(d => StockData.dailyReturns(d));
    const minLen = Math.min(...returnSets.map(r => r.length));
    const aligned = returnSets.map(r => r.slice(r.length - minLen));
    const matrix = StockData.computeCorrelationMatrix(aligned);

    corrEl.innerHTML = "";
    Plotly.newPlot(corrEl, [{
      z: matrix, x: pbTickers, y: pbTickers, type: "heatmap",
      colorscale: [[0, "#2962ff"], [0.5, "#1e222d"], [1, "#ef5350"]],
      zmin: -1, zmax: 1,
      text: matrix.map(row => row.map(v => v.toFixed(2))),
      texttemplate: "%{text}",
      textfont: { size: 11, color: "#d1d4dc" },
    }], simPlotlyLayout({
      height: 280, margin: { l: 55, r: 20, t: 10, b: 55 },
      xaxis: { tickangle: -45 },
    }), simPlotlyConfig());
  }

  // Efficient frontier
  if (frontierEl && pbTickers.length >= 2) {
    const returnSets = filtered.map(d => StockData.dailyReturns(d));
    const minLen = Math.min(...returnSets.map(r => r.length));
    const aligned = returnSets.map(r => r.slice(r.length - minLen));
    const n = aligned.length;
    const means = aligned.map(r => r.reduce((a, b) => a + b) / r.length * 252);
    const cov = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < minLen; k++) sum += (aligned[i][k] - means[i] / 252) * (aligned[j][k] - means[j] / 252);
        cov[i][j] = sum / (minLen - 1) * 252;
      }
    }

    const portfolios = [];
    for (let p = 0; p < 2000; p++) {
      const w = Array.from({ length: n }, () => Math.random());
      const ws = w.reduce((a, b) => a + b);
      const wn = w.map(x => x / ws);
      let ret = 0;
      for (let i = 0; i < n; i++) ret += wn[i] * means[i];
      let vari = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) vari += wn[i] * wn[j] * cov[i][j];
      portfolios.push({ ret: ret * 100, vol: Math.sqrt(vari) * 100, weights: wn });
    }

    // User's portfolio
    let userRet = 0;
    for (let i = 0; i < n; i++) userRet += weights[i] * means[i];
    let userVar = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) userVar += weights[i] * weights[j] * cov[i][j];
    const userVol = Math.sqrt(userVar);

    // Find optimal (max Sharpe)
    let bestSharpe = -Infinity, bestPort = null;
    portfolios.forEach(p => {
      const s = p.vol > 0 ? (p.ret - 2) / p.vol : 0;
      if (s > bestSharpe) { bestSharpe = s; bestPort = p; }
    });

    const fTraces = [
      {
        x: portfolios.map(p => p.vol), y: portfolios.map(p => p.ret),
        mode: "markers", type: "scatter", name: "Random Portfolios",
        marker: { size: 3, opacity: 0.35, color: portfolios.map(p => p.ret / p.vol), colorscale: [[0, "#ef5350"], [0.5, "#ff9800"], [1, "#26a69a"]] },
      },
      {
        x: [userVol * 100], y: [userRet * 100], mode: "markers+text", type: "scatter",
        name: "Your Portfolio", text: ["You"],
        textposition: "top center", textfont: { color: accent, size: 12 },
        marker: { size: 14, color: accent, symbol: "star" },
      },
    ];

    if (bestPort) {
      fTraces.push({
        x: [bestPort.vol], y: [bestPort.ret], mode: "markers+text", type: "scatter",
        name: "Optimal", text: ["Optimal"],
        textposition: "bottom center", textfont: { color: "#26a69a", size: 11 },
        marker: { size: 12, color: "#26a69a", symbol: "diamond" },
      });
      // Show optimal weights
      const optEl = document.getElementById("pb-optimal");
      if (optEl && bestPort) {
        optEl.innerHTML = "<strong>Optimal weights:</strong> " + pbTickers.map((t, i) => `${t}: ${(bestPort.weights[i] * 100).toFixed(0)}%`).join(", ");
        optEl.style.display = "block";
      }
    }

    frontierEl.innerHTML = "";
    Plotly.newPlot(frontierEl, fTraces, simPlotlyLayout({
      height: 320,
      xaxis: { title: "Volatility (%)" },
      yaxis: { title: "Return (%)" },
      legend: { x: 0.02, y: 0.98, bgcolor: "rgba(0,0,0,0)" },
    }), simPlotlyConfig());
  }

  // Stats
  if (statsEl) {
    const startVal = portfolio[0].value;
    const endVal = portfolio[portfolio.length - 1].value;
    const years = StockData.daysBetween(portfolio[0].date, portfolio[portfolio.length - 1].date) / 365.25;
    const annReturn = (Math.pow(endVal / startVal, 1 / years) - 1) * 100;

    const pvReturns = [];
    for (let i = 1; i < portfolio.length; i++) pvReturns.push(portfolio[i].value / portfolio[i - 1].value - 1);
    const avgR = pvReturns.reduce((a, b) => a + b, 0) / pvReturns.length;
    const stdR = Math.sqrt(pvReturns.reduce((a, b) => a + (b - avgR) ** 2, 0) / (pvReturns.length - 1));
    const annVol = stdR * Math.sqrt(252) * 100;
    const sharpe = stdR > 0 ? (avgR * 252 - 0.02) / (stdR * Math.sqrt(252)) : 0;

    let peak = -Infinity, maxDD = 0;
    portfolio.forEach(p => { if (p.value > peak) peak = p.value; const dd = (peak - p.value) / peak; if (dd > maxDD) maxDD = dd; });

    // Best/worst year
    const yearMap = {};
    portfolio.forEach(p => { const yr = p.date.slice(0, 4); if (!yearMap[yr]) yearMap[yr] = { first: p.value, last: p.value }; yearMap[yr].last = p.value; });
    let bestYear = "", worstYear = "", bestRet = -Infinity, worstRet = Infinity;
    for (const [yr, v] of Object.entries(yearMap)) {
      const ret = (v.last / v.first - 1) * 100;
      if (ret > bestRet) { bestRet = ret; bestYear = yr; }
      if (ret < worstRet) { worstRet = ret; worstYear = yr; }
    }

    statsEl.innerHTML = `
      <div class="backtest-stat"><div class="label">Ann. Return</div><div class="value ${annReturn >= 0 ? "positive" : "negative"}">${annReturn >= 0 ? "+" : ""}${annReturn.toFixed(1)}%</div></div>
      <div class="backtest-stat"><div class="label">Ann. Volatility</div><div class="value">${annVol.toFixed(1)}%</div></div>
      <div class="backtest-stat"><div class="label">Sharpe Ratio</div><div class="value">${sharpe.toFixed(2)}</div></div>
      <div class="backtest-stat"><div class="label">Max Drawdown</div><div class="value negative">-${(maxDD * 100).toFixed(1)}%</div></div>
      <div class="backtest-stat"><div class="label">Best Year</div><div class="value positive">${bestYear} +${bestRet.toFixed(0)}%</div></div>
      <div class="backtest-stat"><div class="label">Worst Year</div><div class="value negative">${worstYear} ${worstRet.toFixed(0)}%</div></div>
    `;
  }
}

/* ══════════════════════════════════════════════
   TOOL 3 — Crisis Stress Test
   ══════════════════════════════════════════════ */

const CRISES = [
  { name: "Dot-com Bubble", start: "2000-03-01", end: "2002-10-01", before: "1999-09-01", after: "2003-04-01" },
  { name: "2008 Financial Crisis", start: "2007-10-01", end: "2009-03-01", before: "2007-04-01", after: "2009-09-01" },
  { name: "COVID Crash", start: "2020-02-01", end: "2020-04-01", before: "2019-08-01", after: "2020-10-01" },
  { name: "2022 Rate Hike Selloff", start: "2022-01-01", end: "2022-12-31", before: "2021-07-01", after: "2023-06-30" },
];

let selectedCrisis = null;
let stTickers = [];

function stAddTicker() {
  const select = document.getElementById("st-add-ticker");
  const ticker = select.value;
  if (stTickers.includes(ticker) || stTickers.length >= 6) return;
  stTickers.push(ticker);
  renderSTSliders();
}

function stRemoveTicker(ticker) {
  stTickers = stTickers.filter(t => t !== ticker);
  renderSTSliders();
}

function renderSTSliders() {
  const container = document.getElementById("st-sliders");
  if (!container) return;
  if (stTickers.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Add tickers above.</p>';
    return;
  }
  const eq = Math.floor(100 / stTickers.length);
  container.innerHTML = stTickers.map(t => `
    <div class="weight-slider-row">
      <span class="ticker-label">${t}</span>
      <input type="range" min="0" max="100" value="${eq}" class="st-weight" data-ticker="${t}" oninput="updateSTWeights()">
      <span class="weight-value" id="st-w-${t}">${eq}%</span>
      <button onclick="stRemoveTicker('${t}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;padding:0 0.3rem;">×</button>
    </div>
  `).join("");
  updateSTWeights();
}

function updateSTWeights() {
  const sliders = document.querySelectorAll(".st-weight");
  let total = 0;
  sliders.forEach(s => {
    total += parseInt(s.value);
    const lbl = document.getElementById("st-w-" + s.dataset.ticker);
    if (lbl) lbl.textContent = s.value + "%";
  });
  const el = document.getElementById("st-total");
  if (el) { el.textContent = `Total: ${total}%`; el.className = "weight-total " + (total === 100 ? "valid" : "invalid"); }
}

function selectCrisis(idx) {
  selectedCrisis = idx;
  document.querySelectorAll(".crisis-option").forEach((el, i) => {
    el.classList.toggle("selected", i === idx);
  });
}

async function runStressTest() {
  const chartEl = document.getElementById("st-chart");
  const statsEl = document.getElementById("st-stats");
  if (!chartEl) return;

  if (selectedCrisis === null) { chartEl.innerHTML = '<div class="chart-loading">Select a crisis first</div>'; return; }
  if (stTickers.length < 1) { chartEl.innerHTML = '<div class="chart-loading">Add at least 1 ticker</div>'; return; }

  const crisis = CRISES[selectedCrisis];
  const sliders = document.querySelectorAll(".st-weight");
  const weights = [];
  sliders.forEach(s => weights.push(parseInt(s.value) / 100));
  const totalW = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(totalW - 1) > 0.05) { chartEl.innerHTML = '<div class="chart-loading">Weights must sum to 100%</div>'; return; }

  chartEl.innerHTML = '<div class="chart-loading">Running stress test...</div>';

  const datasets = await Promise.all(stTickers.map(t => StockData.loadTicker(t)));
  if (datasets.some(d => !d)) { chartEl.innerHTML = '<div class="chart-loading">Failed to load data</div>'; return; }

  // Full period: before + during + after
  const filtered = datasets.map(d => StockData.filterByDate(d, crisis.before, crisis.after));
  const portfolio = StockData.computePortfolioValue(filtered, weights, 10000);

  // QQQ benchmark
  const qqq = await StockData.loadTicker("QQQ");
  let qqqSeries = [];
  if (qqq) {
    const qqFiltered = StockData.filterByDate(qqq, crisis.before, crisis.after);
    if (qqFiltered.length > 1) {
      const qqStart = qqFiltered[0].close;
      qqqSeries = qqFiltered.map(d => ({ date: d.date, value: (d.close / qqStart) * 10000 }));
    }
  }

  if (portfolio.length < 2) { chartEl.innerHTML = '<div class="chart-loading">Not enough data for this period</div>'; return; }

  const cs = getComputedStyle(document.documentElement);
  const accent = cs.getPropertyValue("--accent").trim();
  const red = cs.getPropertyValue("--red").trim();

  const traces = [
    {
      x: portfolio.map(d => d.date), y: portfolio.map(d => d.value),
      type: "scatter", mode: "lines", name: "Your Portfolio",
      line: { color: accent, width: 2 },
    },
  ];
  if (qqqSeries.length > 0) {
    traces.push({
      x: qqqSeries.map(d => d.date), y: qqqSeries.map(d => d.value),
      type: "scatter", mode: "lines", name: "100% QQQ",
      line: { color: "#787b86", width: 1.5, dash: "dash" },
    });
  }

  chartEl.innerHTML = "";
  Plotly.newPlot(chartEl, traces, simPlotlyLayout({
    height: 380,
    yaxis: { title: "Portfolio Value (€)" },
    shapes: [{
      type: "rect", x0: crisis.start, x1: crisis.end,
      y0: 0, y1: 1, yref: "paper",
      fillcolor: "rgba(239,83,80,0.1)", line: { width: 0 },
    }],
    annotations: [{
      x: crisis.start, y: 1, yref: "paper", text: "Crisis Start",
      showarrow: false, font: { color: red, size: 10 }, yanchor: "bottom",
    }, {
      x: crisis.end, y: 1, yref: "paper", text: "Crisis End",
      showarrow: false, font: { color: red, size: 10 }, yanchor: "bottom",
    }],
    legend: { x: 0.02, y: 0.98, bgcolor: "rgba(0,0,0,0)" },
  }), simPlotlyConfig());

  // Stats
  if (statsEl) {
    // Portfolio drawdown during crisis
    const crisisPortfolio = portfolio.filter(d => d.date >= crisis.start && d.date <= crisis.end);
    let peak = -Infinity, maxDD = 0, worstDay = 0;
    crisisPortfolio.forEach((p, i) => {
      if (p.value > peak) peak = p.value;
      const dd = (peak - p.value) / peak;
      if (dd > maxDD) maxDD = dd;
      if (i > 0) {
        const dayChange = Math.abs(p.value / crisisPortfolio[i - 1].value - 1);
        if (dayChange > Math.abs(worstDay)) {
          worstDay = p.value / crisisPortfolio[i - 1].value - 1;
        }
      }
    });

    // QQQ drawdown
    let qqPeak = -Infinity, qqDD = 0;
    if (qqqSeries.length > 0) {
      qqqSeries.filter(d => d.date >= crisis.start && d.date <= crisis.end).forEach(p => {
        if (p.value > qqPeak) qqPeak = p.value;
        const dd = (qqPeak - p.value) / qqPeak;
        if (dd > qqDD) qqDD = dd;
      });
    }

    // Recovery: find first date after crisis where value >= pre-crisis peak
    const preCrisisVal = crisisPortfolio.length > 0 ? crisisPortfolio[0].value : 10000;
    const postCrisis = portfolio.filter(d => d.date > crisis.end);
    const recoveryPoint = postCrisis.find(d => d.value >= preCrisisVal);
    const recoveryDays = recoveryPoint ? Math.round(StockData.daysBetween(crisis.end, recoveryPoint.date)) : "N/A";

    statsEl.innerHTML = `
      <div class="backtest-stat"><div class="label">Your Max Drawdown</div><div class="value negative">-${(maxDD * 100).toFixed(1)}%</div></div>
      <div class="backtest-stat"><div class="label">QQQ Max Drawdown</div><div class="value negative">-${(qqDD * 100).toFixed(1)}%</div></div>
      <div class="backtest-stat"><div class="label">Days to Recover</div><div class="value">${recoveryDays}${typeof recoveryDays === "number" ? " days" : ""}</div></div>
      <div class="backtest-stat"><div class="label">Worst Single Day</div><div class="value negative">${(worstDay * 100).toFixed(1)}%</div></div>
    `;
  }
}

/* ══════════════════════════════════════════════
   TAB SWITCHING
   ══════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Tab switching
  document.querySelectorAll(".sim-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".sim-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".sim-tool-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const panel = document.getElementById(tab.dataset.panel);
      if (panel) panel.classList.add("active");
    });
  });

  // Backtest button
  document.getElementById("bt-run")?.addEventListener("click", runBacktest);

  // Portfolio builder
  document.getElementById("pb-add-btn")?.addEventListener("click", pbAddTicker);
  document.getElementById("pb-run")?.addEventListener("click", runPortfolioBuilder);

  // Stress test
  document.getElementById("st-add-btn")?.addEventListener("click", stAddTicker);
  document.getElementById("st-run")?.addEventListener("click", runStressTest);
  document.querySelectorAll(".crisis-option").forEach((el, i) => {
    el.addEventListener("click", () => selectCrisis(i));
  });

  // Default portfolio builder tickers
  if (document.getElementById("pb-sliders")) {
    pbTickers = ["AAPL", "MSFT", "NVDA"];
    renderPBSliders();
  }
  if (document.getElementById("st-sliders")) {
    stTickers = ["AAPL", "MSFT", "NVDA"];
    renderSTSliders();
  }
});
