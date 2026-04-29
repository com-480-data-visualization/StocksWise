/* ══════════════════════════════════════════════
   StocksWise - Expert Mode
   All expert module charts and interactions.
   Uses Plotly.js for advanced charts, Chart.js for simpler ones.
   ══════════════════════════════════════════════ */

/* ── Expert Mode Toggle (independent per page) ── */
(function initExpertMode() {
  const pageKey = window.location.pathname.includes("/pages/") ? "sw-mode-sim" : "sw-mode-main";
  const saved = localStorage.getItem(pageKey);
  if (saved === "expert") document.body.classList.add("expert");

  // Set initial label text
  const toggle = document.getElementById("expert-toggle");
  if (toggle) {
    const label = toggle.querySelector(".expert-toggle-label");
    if (label) label.textContent = saved === "expert" ? "Advanced" : "Beginner";
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#expert-toggle");
    if (!btn) return;
    document.body.classList.toggle("expert");
    const isExpert = document.body.classList.contains("expert");
    localStorage.setItem(pageKey, isExpert ? "expert" : "beginner");
    btn.querySelector(".expert-toggle-label").textContent = isExpert ? "Advanced" : "Beginner";
    document.dispatchEvent(new CustomEvent("sw-mode-change", { detail: { expert: isExpert } }));
    updateNavLabels(isExpert);
    if (isExpert) initExpertCharts();
  });

  // Update nav labels on load
  updateNavLabels(saved === "expert");
})();

function updateNavLabels(isExpert) {
  document.querySelectorAll("#nav-links a[data-beginner]").forEach(a => {
    a.textContent = isExpert ? a.dataset.expert : a.dataset.beginner;
  });
}

/* ── Ticker autocomplete: populates all <select> with class "ticker-select" ── */
(async function populateTickerSelects() {
  const meta = await StockData.loadMeta();
  if (!meta || meta.length === 0) return;
  document.querySelectorAll("select.ticker-select").forEach(select => {
    const current = select.value;
    // Keep any existing options as defaults, then append the rest
    const existing = new Set(Array.from(select.options).map(o => o.value));
    meta.forEach(t => {
      if (!existing.has(t.symbol)) {
        const opt = document.createElement("option");
        opt.value = t.symbol;
        opt.textContent = `${t.symbol} - ${t.name}`;
        select.appendChild(opt);
      }
    });
    if (current) select.value = current;
  });
})();

/* ── Plotly theme helper ── */
function plotlyLayout(overrides = {}) {
  const cs = getComputedStyle(document.documentElement);
  const g = (v) => cs.getPropertyValue(v).trim();
  const base = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter, sans-serif", color: g("--text-muted"), size: 11 },
    margin: { l: 50, r: 20, t: 10, b: 40 },
    // fixedrange locks the axis against user pan/zoom; programmatic relayout
    // (used by the timeline crisis buttons) still works.
    xaxis: { gridcolor: g("--border"), zerolinecolor: g("--border"), tickfont: { size: 10 }, fixedrange: true },
    yaxis: { gridcolor: g("--border"), zerolinecolor: g("--border"), tickfont: { size: 10 }, fixedrange: true },
    dragmode: false,
    hovermode: "x unified",
  };
  return deepMerge(base, overrides);
}

function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && target[key]) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

function plotlyConfig() {
  return { responsive: true, displayModeBar: false, scrollZoom: false };
}

function getAccentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
}
function getGreenColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--green").trim();
}
function getRedColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--red").trim();
}

let expertInitialized = false;

function initExpertCharts() {
  if (expertInitialized) return;
  expertInitialized = true;
  loadAllExpertCharts();
}

// Load every expert chart with its current default selections.
// Staggered so we don't kick off a dozen parallel fetches at once (and so
// the UI feels alive rather than freezing on a single "loading" flash).
function loadAllExpertCharts() {
  const queue = [
    loadTechnicalAnalysis,
    loadDiversificationChart,
    loadCorrelationHeatmap,
    loadSectorAllocation,
    loadEfficientFrontier,
    loadVolatilityDeep,
    computeSharpeDisplay,
    loadMaxDrawdownDeep,
    loadStrategiesComparison,
    loadNasdaqTimeline,
    loadVolatilityClustering,
  ];
  queue.forEach((fn, i) => {
    if (typeof fn !== "function") return;
    setTimeout(() => { try { fn(); } catch (e) { console.warn(e); } }, i * 80);
  });
}

/* ══════════════════════════════════════════════
   MODULE 01 - Technical Analysis
   ══════════════════════════════════════════════ */

async function loadTechnicalAnalysis() {
  const ticker = document.getElementById("ta-ticker")?.value || "AAPL";
  const period = document.getElementById("ta-period")?.value || "1y";
  const container = document.getElementById("ta-chart");
  const rsiContainer = document.getElementById("ta-rsi-chart");
  if (!container) return;

  container.innerHTML = '<div class="chart-loading">Loading data...</div>';
  if (rsiContainer) rsiContainer.innerHTML = "";

  const data = await StockData.loadTicker(ticker);
  if (!data) {
    container.innerHTML = '<div class="chart-loading">Could not load data for ' + ticker + '</div>';
    return;
  }

  // Filter by period
  const now = data[data.length - 1].date;
  const endDate = now;
  let startDate;
  const lastDate = new Date(now);
  switch (period) {
    case "6m": startDate = new Date(lastDate.setMonth(lastDate.getMonth() - 6)).toISOString().slice(0, 10); break;
    case "1y": startDate = new Date(lastDate.setFullYear(lastDate.getFullYear() - 1)).toISOString().slice(0, 10); break;
    case "3y": startDate = new Date(lastDate.setFullYear(lastDate.getFullYear() - 3)).toISOString().slice(0, 10); break;
    case "5y": startDate = new Date(lastDate.setFullYear(lastDate.getFullYear() - 5)).toISOString().slice(0, 10); break;
    default: startDate = data[0].date;
  }

  const filtered = StockData.filterByDate(data, startDate, endDate);
  if (filtered.length < 2) {
    container.innerHTML = '<div class="chart-loading">Not enough data for this period</div>';
    return;
  }

  // Candlestick data
  const dates = filtered.map(d => d.date);
  const open = filtered.map(d => d.open);
  const high = filtered.map(d => d.high);
  const low = filtered.map(d => d.low);
  const close = filtered.map(d => d.close);

  const traces = [{
    x: dates, open, high, low, close,
    type: "candlestick",
    increasing: { line: { color: getGreenColor() }, fillcolor: getGreenColor() },
    decreasing: { line: { color: getRedColor() }, fillcolor: getRedColor() },
    name: ticker,
  }];

  // Moving averages
  const showSMA20 = document.getElementById("ta-sma20")?.checked;
  const showSMA50 = document.getElementById("ta-sma50")?.checked;
  const showSMA200 = document.getElementById("ta-sma200")?.checked;
  const showEMA20 = document.getElementById("ta-ema20")?.checked;

  if (showSMA20) {
    const sma = StockData.computeSMA(filtered, 20);
    traces.push({ x: dates, y: sma, type: "scatter", mode: "lines", name: "SMA 20", line: { color: "#ff9800", width: 1.5 } });
  }
  if (showSMA50) {
    const sma = StockData.computeSMA(filtered, 50);
    traces.push({ x: dates, y: sma, type: "scatter", mode: "lines", name: "SMA 50", line: { color: "#e91e63", width: 1.5 } });
  }
  if (showSMA200) {
    const sma = StockData.computeSMA(filtered, 200);
    traces.push({ x: dates, y: sma, type: "scatter", mode: "lines", name: "SMA 200", line: { color: "#9c27b0", width: 1.5 } });
  }
  if (showEMA20) {
    const ema = StockData.computeEMA(filtered, 20);
    traces.push({ x: dates, y: ema, type: "scatter", mode: "lines", name: "EMA 20", line: { color: "#00bcd4", width: 1.5, dash: "dot" } });
  }

  // Support & Resistance
  const showSR = document.getElementById("ta-sr")?.checked;
  if (showSR) {
    const sr = StockData.detectSupportResistance(filtered, 15);
    const shapes = [];
    sr.supports.forEach(s => {
      shapes.push({
        type: "line", x0: dates[0], x1: dates[dates.length - 1],
        y0: s.price, y1: s.price,
        line: { color: getGreenColor(), width: 1.5, dash: "dash" },
      });
    });
    sr.resistances.forEach(r => {
      shapes.push({
        type: "line", x0: dates[0], x1: dates[dates.length - 1],
        y0: r.price, y1: r.price,
        line: { color: getRedColor(), width: 1.5, dash: "dash" },
      });
    });
    container.innerHTML = "";
    Plotly.newPlot(container, traces, plotlyLayout({
      xaxis: { rangeslider: { visible: false } },
      yaxis: { title: "Price ($)" },
      shapes,
      height: 400,
    }), plotlyConfig());
  } else {
    container.innerHTML = "";
    Plotly.newPlot(container, traces, plotlyLayout({
      xaxis: { rangeslider: { visible: false } },
      yaxis: { title: "Price ($)" },
      height: 400,
    }), plotlyConfig());
  }

  // RSI chart
  if (rsiContainer) {
    const rsi = StockData.computeRSI(filtered, 14);
    rsiContainer.innerHTML = "";
    Plotly.newPlot(rsiContainer, [{
      x: dates, y: rsi, type: "scatter", mode: "lines",
      name: "RSI (14)", line: { color: getAccentColor(), width: 1.5 },
    }], plotlyLayout({
      height: 160,
      margin: { l: 50, r: 20, t: 5, b: 30 },
      yaxis: { title: "RSI", range: [0, 100], dtick: 20 },
      shapes: [
        { type: "rect", x0: dates[0], x1: dates[dates.length - 1], y0: 70, y1: 100, fillcolor: "rgba(239,83,80,0.1)", line: { width: 0 } },
        { type: "rect", x0: dates[0], x1: dates[dates.length - 1], y0: 0, y1: 30, fillcolor: "rgba(38,166,154,0.1)", line: { width: 0 } },
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 70, y1: 70, line: { color: getRedColor(), width: 1, dash: "dash" } },
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 30, y1: 30, line: { color: getGreenColor(), width: 1, dash: "dash" } },
      ],
    }), plotlyConfig());
  }
}

// Bind TA controls - any change reloads the chart (no manual button).
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#ta-ticker, #ta-period, #ta-sma20, #ta-sma50, #ta-sma200, #ta-ema20, #ta-sr").forEach(el => {
    el?.addEventListener("change", loadTechnicalAnalysis);
  });

  // Candle anatomy → chart fuse. Drives a CSS --fuse variable (0..1) from
  // the chart's distance to the viewport top, so the demo candles shrink
  // and sink into the chart area as the user scrolls toward it.
  const anatomy = document.querySelector(".candle-anatomy");
  const chart = document.getElementById("ta-chart");
  if (anatomy && chart) {
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const updateFuse = () => {
      const rect = chart.getBoundingClientRect();
      const viewH = window.innerHeight || 720;
      // Fuse begins when the chart top is ~75% down the viewport and
      // completes by the time it reaches ~25% down.
      const start = viewH * 0.75;
      const end   = viewH * 0.25;
      const progress = clamp01((start - rect.top) / (start - end));
      anatomy.style.setProperty("--fuse", progress.toFixed(3));
    };
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateFuse(); ticking = false; });
    }, { passive: true });
    window.addEventListener("resize", updateFuse);
    document.addEventListener("sw-mode-change", updateFuse);
    updateFuse();
  }
});

/* ══════════════════════════════════════════════
   MODULE 02 - Portfolio Construction
   ══════════════════════════════════════════════ */

async function loadDiversificationChart() {
  const container1 = document.getElementById("divers-single");
  const container2 = document.getElementById("divers-portfolio");
  if (!container1 || !container2) return;

  container1.innerHTML = '<div class="chart-loading">Loading...</div>';
  container2.innerHTML = '<div class="chart-loading">Loading...</div>';

  const tsla = await StockData.loadTicker("TSLA");
  const tickers = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOG"];
  const datasets = await Promise.all(tickers.map(t => StockData.loadTicker(t)));

  if (!tsla || datasets.some(d => !d)) return;

  const start = "2019-01-01";
  const end = "2024-12-31";
  const tslaFiltered = StockData.filterByDate(tsla, start, end);

  // Single stock: TSLA
  const tslaStart = tslaFiltered[0].close;
  container1.innerHTML = "";
  Plotly.newPlot(container1, [{
    x: tslaFiltered.map(d => d.date),
    y: tslaFiltered.map(d => (d.close / tslaStart) * 1000),
    type: "scatter", mode: "lines", name: "100% TSLA",
    line: { color: getRedColor(), width: 2 },
    fill: "tozeroy", fillcolor: "rgba(239,83,80,0.08)",
  }], plotlyLayout({
    height: 220, yaxis: { title: "Portfolio Value ($)" },
    margin: { l: 55, r: 10, t: 10, b: 30 },
  }), plotlyConfig());

  // Portfolio: equal-weight 5 stocks
  const filteredAll = datasets.map(d => StockData.filterByDate(d, start, end));
  const portfolio = StockData.computePortfolioValue(filteredAll, [0.2, 0.2, 0.2, 0.2, 0.2], 1000);
  container2.innerHTML = "";
  Plotly.newPlot(container2, [{
    x: portfolio.map(d => d.date),
    y: portfolio.map(d => d.value),
    type: "scatter", mode: "lines", name: "5-Stock Portfolio",
    line: { color: getGreenColor(), width: 2 },
    fill: "tozeroy", fillcolor: "rgba(38,166,154,0.08)",
  }], plotlyLayout({
    height: 220, yaxis: { title: "Portfolio Value ($)" },
    margin: { l: 55, r: 10, t: 10, b: 30 },
  }), plotlyConfig());
}

async function loadCorrelationHeatmap() {
  const container = document.getElementById("corr-heatmap");
  if (!container) return;
  container.innerHTML = '<div class="chart-loading">Loading correlation data...</div>';

  const checkboxes = document.querySelectorAll(".corr-ticker:checked");
  const selectedTickers = Array.from(checkboxes).map(cb => cb.value);
  if (selectedTickers.length < 2) {
    container.innerHTML = '<div class="chart-loading">Select at least 2 tickers</div>';
    return;
  }

  const datasets = await Promise.all(selectedTickers.map(t => StockData.loadTicker(t)));
  if (datasets.some(d => !d)) {
    container.innerHTML = '<div class="chart-loading">Failed to load some ticker data</div>';
    return;
  }

  // Use last 2 years of data
  const end = datasets[0][datasets[0].length - 1].date;
  const startD = new Date(end);
  startD.setFullYear(startD.getFullYear() - 2);
  const start = startD.toISOString().slice(0, 10);

  const filtered = datasets.map(d => StockData.filterByDate(d, start, end));
  const returnSets = filtered.map(d => StockData.dailyReturns(d));

  // Align lengths
  const minLen = Math.min(...returnSets.map(r => r.length));
  const aligned = returnSets.map(r => r.slice(r.length - minLen));

  const matrix = StockData.computeCorrelationMatrix(aligned);

  container.innerHTML = "";
  Plotly.newPlot(container, [{
    z: matrix,
    x: selectedTickers,
    y: selectedTickers,
    type: "heatmap",
    colorscale: [[0, "#2962ff"], [0.5, "#1e222d"], [1, "#ef5350"]],
    zmin: -1, zmax: 1,
    text: matrix.map(row => row.map(v => v.toFixed(2))),
    texttemplate: "%{text}",
    textfont: { size: 12, color: "#d1d4dc" },
    hovertemplate: "%{x} vs %{y}: %{z:.2f}<extra></extra>",
  }], plotlyLayout({
    height: 350,
    margin: { l: 60, r: 20, t: 10, b: 60 },
    xaxis: { tickangle: -45 },
  }), plotlyConfig());
}

function loadSectorAllocation() {
  const container = document.getElementById("sector-pie");
  if (!container) return;

  const sectors = ["Technology", "Healthcare", "Finance", "Energy", "Consumer"];
  const values = [40, 18, 15, 12, 15];
  const colors = ["#2962ff", "#26a69a", "#ff9800", "#ef5350", "#9c27b0"];

  container.innerHTML = "";
  Plotly.newPlot(container, [{
    values, labels: sectors,
    type: "pie",
    hole: 0.45,
    marker: { colors },
    textinfo: "label+percent",
    textfont: { size: 12 },
    hovertemplate: "%{label}: %{value}%<extra></extra>",
  }], plotlyLayout({
    height: 300,
    margin: { l: 20, r: 20, t: 10, b: 10 },
    showlegend: false,
  }), plotlyConfig());
}

async function loadEfficientFrontier() {
  const container = document.getElementById("frontier-chart");
  if (!container) return;
  container.innerHTML = '<div class="chart-loading">Computing efficient frontier...</div>';

  const checkboxes = document.querySelectorAll(".frontier-ticker:checked");
  const selectedTickers = Array.from(checkboxes).map(cb => cb.value);
  if (selectedTickers.length < 2) {
    container.innerHTML = '<div class="chart-loading">Select at least 2 tickers</div>';
    return;
  }

  const datasets = await Promise.all(selectedTickers.map(t => StockData.loadTicker(t)));
  if (datasets.some(d => !d)) return;

  const end = datasets[0][datasets[0].length - 1].date;
  const startD = new Date(end);
  startD.setFullYear(startD.getFullYear() - 3);
  const start = startD.toISOString().slice(0, 10);

  const filtered = datasets.map(d => StockData.filterByDate(d, start, end));
  const returnSets = filtered.map(d => StockData.dailyReturns(d));
  const minLen = Math.min(...returnSets.map(r => r.length));
  const aligned = returnSets.map(r => r.slice(r.length - minLen));

  // Mean returns and covariance
  const means = aligned.map(r => r.reduce((a, b) => a + b) / r.length * 252);
  const n = aligned.length;
  const cov = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < minLen; k++) {
        sum += (aligned[i][k] - means[i] / 252) * (aligned[j][k] - means[j] / 252);
      }
      cov[i][j] = sum / (minLen - 1) * 252;
    }
  }

  // Generate random portfolios
  const portfolios = [];
  for (let p = 0; p < 3000; p++) {
    const w = Array.from({ length: n }, () => Math.random());
    const wSum = w.reduce((a, b) => a + b);
    const weights = w.map(x => x / wSum);

    let ret = 0;
    for (let i = 0; i < n; i++) ret += weights[i] * means[i];

    let variance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += weights[i] * weights[j] * cov[i][j];
      }
    }
    const vol = Math.sqrt(variance);
    portfolios.push({ ret: ret * 100, vol: vol * 100, weights });
  }

  // Equal-weight portfolio
  const eqW = Array(n).fill(1 / n);
  let eqRet = 0;
  for (let i = 0; i < n; i++) eqRet += eqW[i] * means[i];
  let eqVar = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) eqVar += eqW[i] * eqW[j] * cov[i][j];
  const eqVol = Math.sqrt(eqVar);

  // Find min-variance portfolio (approximate)
  let minVarPort = portfolios[0];
  portfolios.forEach(p => { if (p.vol < minVarPort.vol) minVarPort = p; });

  container.innerHTML = "";
  Plotly.newPlot(container, [
    {
      x: portfolios.map(p => p.vol), y: portfolios.map(p => p.ret),
      mode: "markers", type: "scatter", name: "Random Portfolios",
      marker: {
        size: 4, opacity: 0.4,
        color: portfolios.map(p => p.ret / p.vol),
        colorscale: [[0, getRedColor()], [0.5, "#ff9800"], [1, getGreenColor()]],
        colorbar: { title: "Sharpe", thickness: 12 },
      },
    },
    {
      x: [eqVol * 100], y: [eqRet * 100], mode: "markers+text", type: "scatter",
      name: "Equal Weight", text: ["Your Portfolio"],
      textposition: "top center", textfont: { color: getAccentColor(), size: 12 },
      marker: { size: 14, color: getAccentColor(), symbol: "star" },
    },
  ], plotlyLayout({
    height: 380,
    xaxis: { title: "Annualized Volatility (%)" },
    yaxis: { title: "Annualized Return (%)" },
    legend: { x: 0.02, y: 0.98, bgcolor: "rgba(0,0,0,0)" },
  }), plotlyConfig());
}

/* ══════════════════════════════════════════════
   MODULE 03 - Risk Metrics Deep
   ══════════════════════════════════════════════ */

async function loadVolatilityDeep() {
  const container = document.getElementById("vol-deep-chart");
  const priceContainer = document.getElementById("vol-price-chart");
  if (!container) return;

  const ticker = document.getElementById("vol-ticker")?.value || "NVDA";
  const period = document.getElementById("vol-period")?.value || "5y";

  container.innerHTML = '<div class="chart-loading">Loading...</div>';
  if (priceContainer) priceContainer.innerHTML = '<div class="chart-loading">Loading...</div>';

  const data = await StockData.loadTicker(ticker);
  if (!data) return;

  const now = data[data.length - 1].date;
  const endDate = now;
  let startDate;
  const lastDate = new Date(now);
  switch (period) {
    case "1y": startDate = new Date(lastDate.setFullYear(lastDate.getFullYear() - 1)).toISOString().slice(0, 10); break;
    case "3y": startDate = new Date(lastDate.setFullYear(lastDate.getFullYear() - 3)).toISOString().slice(0, 10); break;
    case "5y": startDate = new Date(lastDate.setFullYear(lastDate.getFullYear() - 5)).toISOString().slice(0, 10); break;
    default: startDate = data[0].date;
  }

  const filtered = StockData.filterByDate(data, startDate, endDate);
  const vol = StockData.computeRollingVolatility(filtered, 30);
  const dates = filtered.map(d => d.date);

  // Price chart
  if (priceContainer) {
    priceContainer.innerHTML = "";
    Plotly.newPlot(priceContainer, [{
      x: dates, y: filtered.map(d => d.close), type: "scatter", mode: "lines",
      name: ticker, line: { color: getAccentColor(), width: 1.5 },
    }], plotlyLayout({
      height: 200, margin: { l: 55, r: 10, t: 10, b: 5 },
      yaxis: { title: "Price ($)" }, xaxis: { showticklabels: false },
    }), plotlyConfig());
  }

  // Volatility chart
  container.innerHTML = "";
  Plotly.newPlot(container, [{
    x: dates, y: vol, type: "scatter", mode: "lines",
    name: "30d Rolling Vol", line: { color: "#ff9800", width: 1.5 },
    fill: "tozeroy", fillcolor: "rgba(255,152,0,0.08)",
  }], plotlyLayout({
    height: 200, margin: { l: 55, r: 10, t: 5, b: 30 },
    yaxis: { title: "Volatility (%)" },
  }), plotlyConfig());
}

async function computeSharpeDisplay() {
  const ticker = document.getElementById("sharpe-ticker")?.value || "AAPL";
  const period = document.getElementById("sharpe-period")?.value || "3y";
  const display = document.getElementById("sharpe-value");
  const interp = document.getElementById("sharpe-interp");
  if (!display) return;

  display.textContent = "...";

  const data = await StockData.loadTicker(ticker);
  if (!data) { display.textContent = "N/A"; return; }

  const now = data[data.length - 1].date;
  const lastDate = new Date(now);
  let startDate;
  switch (period) {
    case "1y": startDate = new Date(lastDate.setFullYear(lastDate.getFullYear() - 1)).toISOString().slice(0, 10); break;
    case "3y": startDate = new Date(lastDate.setFullYear(lastDate.getFullYear() - 3)).toISOString().slice(0, 10); break;
    case "5y": startDate = new Date(lastDate.setFullYear(lastDate.getFullYear() - 5)).toISOString().slice(0, 10); break;
    default: startDate = data[0].date;
  }

  const filtered = StockData.filterByDate(data, startDate, now);
  const sharpe = StockData.computeSharpeRatio(filtered);
  display.textContent = sharpe.toFixed(2);

  if (interp) {
    if (sharpe < 0) { interp.textContent = "Negative - losing money"; interp.className = "sharpe-interp negative"; }
    else if (sharpe < 1) { interp.textContent = "Below 1 - poor risk-adjusted return"; interp.className = "sharpe-interp warning"; }
    else if (sharpe < 2) { interp.textContent = "1–2 - good risk-adjusted return"; interp.className = "sharpe-interp positive"; }
    else { interp.textContent = "Above 2 - excellent risk-adjusted return"; interp.className = "sharpe-interp excellent"; }
  }
}

async function loadMaxDrawdownDeep() {
  const container = document.getElementById("dd-deep-chart");
  if (!container) return;
  container.innerHTML = '<div class="chart-loading">Loading...</div>';

  const ticker = document.getElementById("dd-ticker")?.value || "TSLA";
  const data = await StockData.loadTicker(ticker);
  if (!data) return;

  const start = "2019-01-01";
  const filtered = StockData.filterByDate(data, start);
  const { maxDD, peakDate, troughDate, drawdownSeries } = StockData.computeMaxDrawdown(filtered);
  const dates = filtered.map(d => d.date);

  container.innerHTML = "";
  Plotly.newPlot(container, [
    {
      x: dates, y: filtered.map(d => d.close), type: "scatter", mode: "lines",
      name: "Price", line: { color: getAccentColor(), width: 1.5 },
    },
  ], plotlyLayout({
    height: 300,
    yaxis: { title: "Price ($)" },
    shapes: [{
      type: "rect", x0: peakDate, x1: troughDate,
      y0: 0, y1: 1, yref: "paper",
      fillcolor: "rgba(239,83,80,0.15)", line: { width: 0 },
    }],
    annotations: [{
      x: troughDate, y: 0.9, yref: "paper",
      text: `Max Drawdown: -${maxDD.toFixed(1)}%<br>${peakDate} to ${troughDate}`,
      showarrow: false,
      font: { color: getRedColor(), size: 12 },
      bgcolor: "rgba(30,34,45,0.9)",
      bordercolor: getRedColor(),
      borderwidth: 1,
      borderpad: 6,
    }],
  }), plotlyConfig());
}

async function loadStrategiesComparison() {
  const container = document.getElementById("strategies-chart");
  if (!container) return;
  container.innerHTML = '<div class="chart-loading">Loading comparison data...</div>';

  // Value: INTC, Growth: AMZN, Momentum: NVDA
  const tickers = [
    { symbol: "INTC", label: "INTC (Value)", color: "#ff9800" },
    { symbol: "AMZN", label: "AMZN (Growth)", color: getAccentColor() },
    { symbol: "NVDA", label: "NVDA (Momentum)", color: getGreenColor() },
  ];

  const datasets = await Promise.all(tickers.map(t => StockData.loadTicker(t.symbol)));
  const start = "2015-01-01";
  const traces = [];

  for (let i = 0; i < tickers.length; i++) {
    if (!datasets[i]) continue;
    const filtered = StockData.filterByDate(datasets[i], start);
    const startPrice = filtered[0].close;
    traces.push({
      x: filtered.map(d => d.date),
      y: filtered.map(d => (d.close / startPrice) * 100),
      type: "scatter", mode: "lines",
      name: tickers[i].label,
      line: { color: tickers[i].color, width: 2 },
    });
  }

  container.innerHTML = "";
  Plotly.newPlot(container, traces, plotlyLayout({
    height: 350,
    yaxis: { title: "Growth of $100" },
    legend: { x: 0.02, y: 0.98, bgcolor: "rgba(0,0,0,0)" },
  }), plotlyConfig());
}

/* ══════════════════════════════════════════════
   MODULE 04 - Market History & Psychology
   ══════════════════════════════════════════════ */

const MARKET_EVENTS = [
  { date: "1987-10-19", label: "Black Monday", period: ["1987-08-01", "1988-03-01"], desc: "On October 19, 1987, the NASDAQ fell over 11% in a single day. Program trading and panic selling cascaded across global markets. The crash was triggered by rising interest rates and overvaluation concerns." },
  { date: "2000-03-10", label: "Dot-com Peak", period: ["1999-06-01", "2002-12-01"], desc: "The NASDAQ peaked at 5,048 on March 10, 2000. Over the next 2.5 years, it lost 78% of its value as hundreds of internet companies with no profits went bankrupt." },
  { date: "2008-09-15", label: "Financial Crisis", period: ["2007-10-01", "2009-06-01"], desc: "Lehman Brothers collapsed, triggering a global financial meltdown. The NASDAQ fell over 55% from its 2007 peak. Banks froze lending, and the housing market collapsed." },
  { date: "2020-03-16", label: "COVID Crash", period: ["2020-02-01", "2020-06-01"], desc: "COVID-19 pandemic triggered the fastest bear market in history. The NASDAQ dropped 30% in three weeks. Unprecedented fiscal stimulus led to a V-shaped recovery." },
  { date: "2022-01-03", label: "Rate Hike Selloff", period: ["2022-01-01", "2023-01-01"], desc: "The Federal Reserve began aggressively raising interest rates to fight inflation. Growth stocks were hit hardest as future earnings became less valuable. NASDAQ fell 33%." },
];

async function loadNasdaqTimeline() {
  const container = document.getElementById("nasdaq-timeline");
  const infoCard = document.getElementById("timeline-info");
  if (!container) return;
  container.innerHTML = '<div class="chart-loading">Loading NASDAQ history...</div>';

  const data = await StockData.loadTicker("QQQ");
  if (!data) {
    // Fallback: try ^IXIC or show message
    container.innerHTML = '<div class="chart-loading">Loading QQQ as NASDAQ proxy...</div>';
    return;
  }

  const dates = data.map(d => d.date);
  const prices = data.map(d => d.close);

  const annotations = MARKET_EVENTS.filter(e => e.date >= data[0].date).map(event => ({
    x: event.date, y: prices[dates.indexOf(event.date)] || prices[Math.max(0, dates.findIndex(d => d >= event.date))],
    text: event.label, showarrow: true,
    arrowhead: 2, arrowsize: 1, arrowwidth: 1.5,
    arrowcolor: getRedColor(), ax: 0, ay: -40,
    font: { size: 11, color: getAccentColor() },
    bgcolor: "rgba(30,34,45,0.9)", borderpad: 4,
    bordercolor: getAccentColor(), borderwidth: 1,
  }));

  container.innerHTML = "";
  Plotly.newPlot(container, [{
    x: dates, y: prices, type: "scatter", mode: "lines",
    name: "QQQ (NASDAQ-100)", line: { color: getAccentColor(), width: 1.5 },
    fill: "tozeroy", fillcolor: "rgba(41,98,255,0.06)",
  }], plotlyLayout({
    height: 400,
    yaxis: { title: "Price ($)", type: "log" },
    annotations,
  }), plotlyConfig());

  // Click handler for annotations
  container.on("plotly_click", (eventData) => {
    if (!infoCard) return;
    const clickDate = eventData.points[0].x;
    const event = MARKET_EVENTS.find(e => {
      const d = new Date(clickDate);
      const s = new Date(e.period[0]);
      const en = new Date(e.period[1]);
      return d >= s && d <= en;
    });
    if (event) {
      infoCard.innerHTML = `<h4>${event.label}</h4><p>${event.desc}</p>`;
      infoCard.style.display = "block";
      // Zoom to period
      Plotly.relayout(container, {
        "xaxis.range": event.period,
      });
    }
  });
}

function setupTimelineButtons() {
  document.querySelectorAll(".timeline-event-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.event);
      const event = MARKET_EVENTS[idx];
      if (!event) return;
      const container = document.getElementById("nasdaq-timeline");
      const infoCard = document.getElementById("timeline-info");
      if (container) {
        Plotly.relayout(container, { "xaxis.range": event.period });
      }
      if (infoCard) {
        infoCard.innerHTML = `<h4>${event.label}</h4><p>${event.desc}</p>`;
        infoCard.style.display = "block";
      }
    });
  });
}

async function loadVolatilityClustering() {
  const container = document.getElementById("vol-clustering-chart");
  if (!container) return;
  container.innerHTML = '<div class="chart-loading">Loading daily returns...</div>';

  const data = await StockData.loadTicker("NVDA");
  if (!data) return;

  const filtered = StockData.filterByDate(data, "2019-01-01");
  const returns = [];
  for (let i = 1; i < filtered.length; i++) {
    returns.push({
      date: filtered[i].date,
      ret: ((filtered[i].close - filtered[i - 1].close) / filtered[i - 1].close) * 100,
    });
  }

  const colors = returns.map(r => Math.abs(r.ret) > 3 ? getRedColor() : (r.ret >= 0 ? getGreenColor() : "rgba(239,83,80,0.5)"));

  container.innerHTML = "";
  Plotly.newPlot(container, [{
    x: returns.map(r => r.date),
    y: returns.map(r => r.ret),
    type: "bar", name: "Daily Return",
    marker: { color: colors },
  }], plotlyLayout({
    height: 280,
    yaxis: { title: "Daily Return (%)" },
    bargap: 0,
  }), plotlyConfig());
}

/* ── Init all expert module charts on demand ── */
document.addEventListener("DOMContentLoaded", () => {
  setupTimelineButtons();

  // Module 02 - checkboxes reload their chart automatically on toggle.
  document.querySelectorAll(".corr-ticker").forEach(cb => cb.addEventListener("change", loadCorrelationHeatmap));
  document.querySelectorAll(".frontier-ticker").forEach(cb => cb.addEventListener("change", loadEfficientFrontier));

  // Module 03 - selects reload their chart automatically on change.
  document.querySelectorAll("#vol-ticker, #vol-period").forEach(el => el.addEventListener("change", loadVolatilityDeep));
  document.querySelectorAll("#sharpe-ticker, #sharpe-period").forEach(el => el.addEventListener("change", computeSharpeDisplay));
  document.getElementById("dd-ticker")?.addEventListener("change", loadMaxDrawdownDeep);

  // Auto-load when entering advanced mode (or now, if we're already there).
  // Default selections populate charts immediately so nothing waits on a button click.
  if (document.body.classList.contains("expert")) {
    initExpertCharts();
  }
  document.addEventListener("sw-mode-change", (e) => {
    if (e.detail && e.detail.expert) initExpertCharts();
  });
});
