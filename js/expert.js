/*
 * StocksWise - Expert Mode
 * All expert module charts and interactions.
 * Uses Plotly.js for advanced charts, Chart.js for simpler ones.
 */

/* Expert Mode Toggle (shared across pages via a single localStorage key) */
(function initExpertMode() {
  const pageKey = "sw-mode";
  const saved = localStorage.getItem(pageKey);
  if (saved === "expert") document.body.classList.add("expert");

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

  updateNavLabels(saved === "expert");
})();

function updateNavLabels(isExpert) {
  document.querySelectorAll("#nav-links a[data-beginner]").forEach(a => {
    a.textContent = isExpert ? a.dataset.expert : a.dataset.beginner;
  });
}

/* Ticker autocomplete: populates all <select> with class "ticker-select" */
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

/* Plotly theme helper */
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
    hovermode: false,
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

/* MODULE 01 - Technical Analysis */

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

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#ta-ticker, #ta-period, #ta-sma20, #ta-sma50, #ta-sma200, #ta-ema20, #ta-sr").forEach(el => {
    el?.addEventListener("change", loadTechnicalAnalysis);
  });
});

/* MODULE 02 - Portfolio Construction */

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

  const selectedTickers = (__corrPicker ? __corrPicker.tickers() : []).slice();
  if (selectedTickers.length < 2) {
    container.innerHTML = '<div class="chart-loading">Add at least 2 tickers above</div>';
    return;
  }

  const datasets = await Promise.all(selectedTickers.map(t => StockData.loadTicker(t)));
  if (datasets.some(d => !d)) {
    container.innerHTML = '<div class="chart-loading">Failed to load some ticker data</div>';
    return;
  }

  const end = datasets[0][datasets[0].length - 1].date;
  const startD = new Date(end);
  startD.setFullYear(startD.getFullYear() - 2);
  const start = startD.toISOString().slice(0, 10);

  const filtered = datasets.map(d => StockData.filterByDate(d, start, end));
  const returnSets = filtered.map(d => StockData.dailyReturns(d));

  const minLen = Math.min(...returnSets.map(r => r.length));
  if (minLen < 5) {
    container.innerHTML = '<div class="chart-loading">Not enough overlapping data for these tickers.</div>';
    return;
  }
  const aligned = returnSets.map(r => r.slice(r.length - minLen));
  const matrix = StockData.computeCorrelationMatrix(aligned);
  // Average off-diagonal correlation per ticker - shown next to row labels as
  // a quick "diversification score" (lower = more diversifying).
  const avgCorr = matrix.map((row, i) => {
    const others = row.filter((_, j) => j !== i);
    return others.reduce((a, b) => a + b, 0) / others.length;
  });
  const yLabels = selectedTickers.map((t, i) => `${t} (${avgCorr[i].toFixed(2)})`);

  const cs = getComputedStyle(document.documentElement);
  const muted = cs.getPropertyValue("--text-muted").trim();
  const strong = cs.getPropertyValue("--text-strong").trim() || "#d1d4dc";

  container.innerHTML = "";
  Plotly.newPlot(container, [{
    z: matrix,
    x: selectedTickers,
    y: yLabels,
    type: "heatmap",
    colorscale: [[0, "#2962ff"], [0.5, "#1e222d"], [1, "#ef5350"]],
    zmin: -1, zmax: 1, zmid: 0,
    text: matrix.map(row => row.map(v => v.toFixed(2))),
    texttemplate: "%{text}",
    textfont: { size: 12, color: strong },
    colorbar: {
      title: { text: "ρ", font: { size: 11, color: muted } },
      tickfont: { color: muted, size: 10 },
      thickness: 10, len: 0.85,
      tickvals: [-1, 0, 1],
      ticktext: ["−1<br>inverse", "0<br>indep.", "+1<br>lockstep"],
    },
    hovertemplate: "<b>%{y} vs %{x}</b><br>r = %{z:.2f}<extra></extra>",
  }], plotlyLayout({
    height: 380,
    margin: { l: 110, r: 30, t: 12, b: 70 },
    xaxis: { tickangle: -45 },
    yaxis: { autorange: "reversed", automargin: true },
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

// Gaussian elimination with partial pivoting. Returns null if A is (near-)singular.
function linsolve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i, maxVal = Math.abs(M[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxVal) { maxRow = k; maxVal = Math.abs(M[k][i]); }
    }
    if (maxVal < 1e-12) return null;
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

// Closed-form efficient frontier (allowing short positions): hyperbola
//   σ²(μ) = (C μ² − 2A μ + B) / D
// with A = 1ᵀ Σ⁻¹ μ, B = μᵀ Σ⁻¹ μ, C = 1ᵀ Σ⁻¹ 1, D = BC − A².
// Tangency portfolio (max Sharpe) is w ∝ Σ⁻¹ (μ − rf·1).
// Inputs in decimal annualized form; outputs in the same units.
function computeAnalyticalFrontier(means, cov, rf) {
  const n = means.length;
  const ones = Array(n).fill(1);
  const excess = means.map(m => m - rf);

  const z = linsolve(cov, excess);
  if (!z) return null;
  const sumZ = z.reduce((a, b) => a + b, 0);
  if (!isFinite(sumZ) || Math.abs(sumZ) < 1e-12) return null;

  const wTan = z.map(zi => zi / sumZ);
  let muTan = 0;
  for (let i = 0; i < n; i++) muTan += wTan[i] * means[i];
  let varTan = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) varTan += wTan[i] * wTan[j] * cov[i][j];
  const sigTan = Math.sqrt(Math.max(0, varTan));

  const sigmaInvMu  = linsolve(cov, means);
  const sigmaInvOne = linsolve(cov, ones);
  let frontier = null;
  if (sigmaInvMu && sigmaInvOne) {
    const A = sigmaInvMu.reduce((s, v) => s + v, 0);
    const B = sigmaInvMu.reduce((s, v, i) => s + v * means[i], 0);
    const C = sigmaInvOne.reduce((s, v) => s + v, 0);
    const D = B * C - A * A;
    if (D > 1e-12 && C > 0) {
      const muMin = A / C;
      const muMax = Math.max(muTan, ...means) * 1.15;
      frontier = [];
      const steps = 120;
      for (let k = 0; k <= steps; k++) {
        const mu = muMin + (muMax - muMin) * (k / steps);
        const sigSq = (C * mu * mu - 2 * A * mu + B) / D;
        if (sigSq > 0) frontier.push({ mu, sig: Math.sqrt(sigSq) });
      }
    }
  }

  return { wTan, muTan, sigTan, frontier };
}

async function loadEfficientFrontier() {
  const container = document.getElementById("frontier-chart");
  if (!container) return;
  container.innerHTML = '<div class="chart-loading">Computing efficient frontier...</div>';

  const selectedTickers = (__frontierPicker ? __frontierPicker.tickers() : []).slice();
  if (selectedTickers.length < 2) {
    container.innerHTML = '<div class="chart-loading">Add at least 2 tickers above</div>';
    return;
  }

  const datasets = await Promise.all(selectedTickers.map(t => StockData.loadTicker(t)));
  const okIdx = datasets.map((d, i) => d ? i : -1).filter(i => i >= 0);
  if (okIdx.length < 2) {
    container.innerHTML = '<div class="chart-loading">Could not load price data for these tickers.</div>';
    return;
  }
  const okTickers = okIdx.map(i => selectedTickers[i]);
  const okData = okIdx.map(i => datasets[i]);

  const end = okData[0][okData[0].length - 1].date;
  const startD = new Date(end);
  startD.setFullYear(startD.getFullYear() - 3);
  const start = startD.toISOString().slice(0, 10);

  const filtered = okData.map(d => StockData.filterByDate(d, start, end));
  const returnSets = filtered.map(d => StockData.dailyReturns(d));
  const minLen = Math.min(...returnSets.map(r => r.length));
  if (minLen < 30) {
    container.innerHTML = '<div class="chart-loading">Not enough overlapping data over the last 3 years.</div>';
    return;
  }
  const aligned = returnSets.map(r => r.slice(r.length - minLen));

  const n = aligned.length;
  const means = aligned.map(r => r.reduce((a, b) => a + b, 0) / r.length * 252);
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

  const portfolios = [];
  for (let p = 0; p < 2000; p++) {
    const w = Array.from({ length: n }, () => Math.random());
    const wSum = w.reduce((a, b) => a + b);
    const weights = w.map(x => x / wSum);
    let ret = 0;
    for (let i = 0; i < n; i++) ret += weights[i] * means[i];
    let variance = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) variance += weights[i] * weights[j] * cov[i][j];
    portfolios.push({ ret: ret * 100, vol: Math.sqrt(variance) * 100, weights });
  }

  const eqW = Array(n).fill(1 / n);
  let eqRet = 0;
  for (let i = 0; i < n; i++) eqRet += eqW[i] * means[i];
  let eqVar = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) eqVar += eqW[i] * eqW[j] * cov[i][j];
  const eqVol = Math.sqrt(eqVar);

  const assetPoints = okTickers.map((t, i) => ({
    ticker: t, ret: means[i] * 100, vol: Math.sqrt(cov[i][i]) * 100,
  }));

  // Tangency = max-Sharpe = "Ideal Market Portfolio": w_tan ∝ Σ⁻¹ (μ − rf·1).
  // If the unconstrained solution requires shorting, fall back to the best-Sharpe
  // long-only sample so the diamond stays inside the feasible cloud.
  const RISK_FREE_PCT = 2;
  const rfDecimal = RISK_FREE_PCT / 100;
  const analytical = computeAnalyticalFrontier(means, cov, rfDecimal);
  const analyticalIsLongOnly = analytical && analytical.wTan.every(w => isFinite(w) && w >= -1e-6);
  let bestPort = null;
  if (analyticalIsLongOnly) {
    bestPort = {
      ret: analytical.muTan * 100,
      vol: analytical.sigTan * 100,
      weights: analytical.wTan,
    };
  } else {
    let bestSharpe = -Infinity;
    portfolios.forEach(p => {
      const s = p.vol > 0 ? (p.ret - RISK_FREE_PCT) / p.vol : 0;
      if (s > bestSharpe) { bestSharpe = s; bestPort = p; }
    });
  }

  const cs = getComputedStyle(document.documentElement);
  const accent = getAccentColor();
  const green = getGreenColor() || "#26a69a";
  const muted = cs.getPropertyValue("--text-muted").trim();
  const strong = cs.getPropertyValue("--text-strong").trim() || "#d1d4dc";

  // Axis bounds exclude the analytical tangency: it can land far outside the
  // long-only feasible region and crush the cloud into one corner.
  const allVols = portfolios.map(p => p.vol).concat(assetPoints.map(a => a.vol), [eqVol * 100]);
  const allRets = portfolios.map(p => p.ret).concat(assetPoints.map(a => a.ret), [eqRet * 100]);
  // Include the tangency only if it's not a wild outlier (within 25% of cloud bounds).
  const cloudVolMin = Math.min(...allVols);
  const cloudVolMax = Math.max(...allVols);
  const cloudRetMin = Math.min(...allRets);
  const cloudRetMax = Math.max(...allRets);
  const tangencyInView = bestPort
    && bestPort.vol <= cloudVolMax * 1.25
    && bestPort.ret <= cloudRetMax * 1.25;
  if (tangencyInView) { allVols.push(bestPort.vol); allRets.push(bestPort.ret); }
  // Tight bounds: start near the cloud (not at 0,0) so data fills the plot.
  // Always include the risk-free line (y = RISK_FREE_PCT) so the dash stays visible.
  const cloudWidth = cloudVolMax - cloudVolMin;
  const cloudHeight = cloudRetMax - cloudRetMin;
  const xMin = Math.max(0, cloudVolMin - cloudWidth * 0.25);
  const xMax = Math.max(...allVols) + cloudWidth * 0.08;
  const yMin = Math.min(RISK_FREE_PCT - 1, cloudRetMin - cloudHeight * 0.25);
  const yMax = Math.max(...allRets) + cloudHeight * 0.12;

  const traces = [
    {
      x: portfolios.map(p => p.vol), y: portfolios.map(p => p.ret),
      mode: "markers", type: "scatter", name: "Random portfolios",
      marker: {
        size: 4, opacity: 0.4,
        color: portfolios.map(p => p.ret / Math.max(p.vol, 0.001)),
        colorscale: [[0, getRedColor()], [0.5, "#ff9800"], [1, green]],
      },
      hovertemplate: "Vol: %{x:.1f}%<br>Return: %{y:.1f}%<extra></extra>",
      showlegend: false,
    },
    {
      x: assetPoints.map(a => a.vol), y: assetPoints.map(a => a.ret),
      mode: "markers+text", type: "scatter", name: "Individual assets",
      text: assetPoints.map(a => a.ticker),
      textposition: "top right",
      textfont: { color: muted, size: 10 },
      marker: { size: 9, color: "rgba(216,220,232,0.85)", line: { color: strong, width: 1 } },
      hovertemplate: "<b>%{text}</b><br>Vol: %{x:.1f}%<br>Return: %{y:.1f}%<extra></extra>",
      showlegend: false,
    },
    {
      x: [eqVol * 100], y: [eqRet * 100], mode: "markers", type: "scatter",
      name: "Equal-weight portfolio",
      marker: { size: 16, color: accent, symbol: "star", line: { color: "#fff", width: 1 } },
      hovertemplate: "<b>Equal-weight portfolio</b><br>Vol: %{x:.1f}%<br>Return: %{y:.1f}%<extra></extra>",
      showlegend: false,
    },
  ];
  const annots = [];
  const shapes = [
    { type: "line", x0: xMin, x1: xMax, y0: RISK_FREE_PCT, y1: RISK_FREE_PCT,
      line: { color: muted, width: 1, dash: "dash" } },
  ];
  annots.push({
    x: xMin, y: RISK_FREE_PCT, text: " Risk-free " + RISK_FREE_PCT + "%",
    showarrow: false, xanchor: "left", yanchor: "bottom",
    font: { color: muted, size: 10 },
  });
  annots.push({
    x: eqVol * 100, y: eqRet * 100, ax: -28, ay: -22,
    text: "Equal-weight", showarrow: true, arrowcolor: accent,
    arrowwidth: 1, arrowhead: 2, arrowsize: 0.8,
    xanchor: "right", yanchor: "bottom",
    font: { color: accent, size: 11 },
  });
  if (bestPort) {
    let frontierMinVol = null;
    if (analytical && analytical.frontier && analytical.frontier.length > 1) {
      const pts = analytical.frontier
        .map(p => ({ x: p.sig * 100, y: p.mu * 100 }))
        .filter(p => p.x <= xMax * 1.02 && p.y >= yMin && p.y <= yMax);
      if (pts.length > 1) {
        frontierMinVol = pts[0].x;
        traces.push({
          x: pts.map(p => p.x), y: pts.map(p => p.y),
          mode: "lines", type: "scatter", name: "Efficient frontier",
          line: { color: green, width: 2 },
          hovertemplate: "Efficient frontier<br>Vol: %{x:.1f}%<br>Return: %{y:.1f}%<extra></extra>",
          showlegend: false,
        });
      }
    }
    // Only draw the CML, diamond, and label when the tangency lies within the
    // cloud-derived axis bounds; otherwise it's an out-of-range short-heavy point.
    if (tangencyInView) {
      const cloudMinVol = Math.min(...portfolios.map(p => p.vol));
      const cmlStartX = frontierMinVol != null ? frontierMinVol : cloudMinVol * 0.85;
      const slope = (bestPort.ret - RISK_FREE_PCT) / bestPort.vol;
      const cmlStartY = RISK_FREE_PCT + slope * cmlStartX;
      traces.push({
        x: [cmlStartX, bestPort.vol], y: [cmlStartY, bestPort.ret],
        mode: "lines", type: "scatter", name: "Capital Market Line",
        line: { color: green, width: 1.5, dash: "dot" },
        hovertemplate: "Capital Market Line<extra></extra>",
        showlegend: false,
      });
      traces.push({
        x: [bestPort.vol], y: [bestPort.ret], mode: "markers", type: "scatter",
        name: "Ideal Market Portfolio",
        marker: { size: 14, color: green, symbol: "diamond", line: { color: "#fff", width: 1 } },
        hovertemplate: "<b>Ideal Market Portfolio</b><br>Vol: %{x:.1f}%<br>Return: %{y:.1f}%<extra></extra>",
        showlegend: false,
      });
      annots.push({
        x: bestPort.vol, y: bestPort.ret, ax: 38, ay: -34,
        text: "Ideal Market<br>Portfolio",
        showarrow: true, arrowcolor: green, arrowwidth: 1, arrowhead: 2, arrowsize: 0.8,
        xanchor: "left", yanchor: "bottom", align: "left",
        font: { color: green, size: 10 },
        bgcolor: "rgba(15,18,28,0.85)", borderpad: 3,
      });
    }
  }
  annots.push({
    x: xMax * 0.97, y: yMin + (yMax - yMin) * 0.10,
    xanchor: "right",
    text: "Inferior portfolios &<br>individual assets",
    showarrow: false,
    font: { color: muted, size: 10 },
    align: "right",
  });

  container.innerHTML = "";
  Plotly.newPlot(container, traces, plotlyLayout({
    height: 420,
    margin: { l: 70, r: 30, t: 16, b: 60 },
    xaxis: { title: "Expected Risk (annualized volatility, %) →", range: [xMin, xMax] },
    yaxis: { title: "Expected Return (%) ↑", range: [yMin, yMax] },
    showlegend: false,
    shapes, annotations: annots,
  }), plotlyConfig());
}

/* MODULE 03 - Risk Metrics Deep */

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

/* MODULE 04 - Market History & Psychology */

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
  if (!data || !data.length) {
    container.innerHTML = '<div class="chart-loading">Could not load NASDAQ history.</div>';
    return;
  }

  const dates = data.map(d => d.date);
  const prices = data.map(d => d.close);
  const dataStart = dates[0];
  const dataEnd = dates[dates.length - 1];

  // Stash data on the container so timeline buttons can compute a proper
  // y-range for the zoomed period (autorange pathology otherwise).
  container.__qqqData = data;
  container.__qqqRange = [dataStart, dataEnd];

  document.querySelectorAll(".timeline-event-btn[data-event]").forEach((btn) => {
    const idx = parseInt(btn.dataset.event);
    const ev = MARKET_EVENTS[idx];
    btn.style.display = (ev && ev.date >= dataStart && ev.date <= dataEnd) ? "" : "none";
  });

  // Linear y-axis: the QQQ range across the whole series is only ~5×, easily
  // readable on linear. A log axis here renders confusing minor-tick labels
  // (just the leading digit, so "2" can mean $2, $20 or $200).
  const positivePrices = prices.filter(p => p > 0);
  const pMin = Math.min(...positivePrices);
  const pMax = Math.max(...positivePrices);
  const fullYRange = [pMin * 0.9, pMax * 1.1];

  const visibleEvents = MARKET_EVENTS.filter(e => e.date >= dataStart && e.date <= dataEnd);
  // Anchor each annotation to the PEAK price in the event's period so arrows
  // stay above the price line (the exact event date lands COVID at its trough).
  const peakPriceInPeriod = (event) => {
    const [s, e] = event.period;
    const slice = data.filter(d => d.date >= s && d.date <= e);
    if (!slice.length) {
      const i = dates.indexOf(event.date);
      return i >= 0 ? prices[i] : prices[0];
    }
    return Math.max(...slice.map(d => d.high || d.close));
  };

  // Shift labels near the right/top edge inward so they don't clip.
  const dayMs = 86400000;
  const totalDays = (new Date(dataEnd) - new Date(dataStart)) / dayMs;
  const annotations = visibleEvents.map((event) => {
    const eventDays = (new Date(event.date) - new Date(dataStart)) / dayMs;
    const positionFrac = totalDays > 0 ? eventDays / totalDays : 0.5;
    const nearRight = positionFrac > 0.85;
    const nearLeft = positionFrac < 0.05;
    const eventY = peakPriceInPeriod(event);
    const nearTop = (eventY - pMin) / (pMax - pMin) > 0.75;
    return {
      x: event.date, y: eventY,
      text: event.label, showarrow: true,
      arrowhead: 2, arrowsize: 1, arrowwidth: 1.5,
      arrowcolor: getRedColor(),
      ax: nearRight ? -55 : (nearLeft ? 55 : 0),
      ay: nearTop ? -18 : -40,
      xanchor: nearRight ? "right" : (nearLeft ? "left" : "center"),
      font: { size: 11, color: getAccentColor() },
      bgcolor: "rgba(30,34,45,0.9)", borderpad: 4,
      bordercolor: getAccentColor(), borderwidth: 1,
    };
  });
  container.__qqqFullYRange = fullYRange;
  container.__qqqFullXRange = [dataStart, dataEnd];
  container.__qqqFullAnnotations = annotations;

  container.innerHTML = "";
  Plotly.newPlot(container, [{
    x: dates, y: prices, type: "scatter", mode: "lines",
    name: "QQQ (NASDAQ-100)", line: { color: getAccentColor(), width: 1.5 },
  }], plotlyLayout({
    height: 400,
    xaxis: { range: [dataStart, dataEnd] },
    yaxis: { title: "Price ($)", tickprefix: "$", range: fullYRange },
    annotations,
  }), plotlyConfig());

  container.on("plotly_click", (eventData) => {
    if (!infoCard) return;
    const clickDate = eventData.points[0].x;
    const event = MARKET_EVENTS.find(e => {
      const d = new Date(clickDate);
      const s = new Date(e.period[0]);
      const en = new Date(e.period[1]);
      return d >= s && d <= en;
    });
    if (event) showTimelineEvent(MARKET_EVENTS.indexOf(event));
  });

  const resetBtn = document.getElementById("timeline-reset-btn");
  if (resetBtn) resetBtn.classList.add("active");
  if (infoCard) infoCard.style.display = "none";
}

function resetTimelineView() {
  const container = document.getElementById("nasdaq-timeline");
  const infoCard = document.getElementById("timeline-info");
  if (container && container.data && container.__qqqFullXRange && container.__qqqFullYRange) {
    try {
      Plotly.relayout(container, {
        "xaxis.range": container.__qqqFullXRange,
        "yaxis.range": container.__qqqFullYRange,
        annotations: container.__qqqFullAnnotations || [],
      });
    } catch (_) {}
  }
  if (infoCard) {
    infoCard.style.display = "none";
    infoCard.innerHTML = "";
  }
  document.querySelectorAll(".timeline-event-btn").forEach((b) => b.classList.remove("active"));
  const resetBtn = document.getElementById("timeline-reset-btn");
  if (resetBtn) resetBtn.classList.add("active");
}

function showTimelineEvent(idx, { zoom = true } = {}) {
  const event = MARKET_EVENTS[idx];
  if (!event) return;
  const container = document.getElementById("nasdaq-timeline");
  const infoCard = document.getElementById("timeline-info");
  const buttons = document.querySelectorAll(".timeline-event-btn");

  if (zoom && container && container.data) {
    const allData = container.__qqqData || [];
    // Clamp the requested period to the data's actual extent to avoid trailing
    // empty stretches when the event period extends past the dataset.
    const dataRange = container.__qqqRange || [];
    const reqStart = event.period[0];
    const reqEnd = event.period[1];
    const xStart = dataRange[0] && reqStart < dataRange[0] ? dataRange[0] : reqStart;
    const xEnd = dataRange[1] && reqEnd > dataRange[1] ? dataRange[1] : reqEnd;
    const slice = allData.filter(d => d.date >= xStart && d.date <= xEnd);
    // Hide multi-event annotations when zoomed: they were positioned for the
    // full-timeline scale. The info card below already names the event.
    const update = { "xaxis.range": [xStart, xEnd], annotations: [] };
    if (slice.length) {
      // Compute y range manually: Plotly's autorange uses the whole series,
      // not the visible slice, so the line would otherwise look flat on zoom.
      let lo = Infinity, hi = -Infinity;
      slice.forEach(d => { if (d.low < lo) lo = d.low; if (d.high > hi) hi = d.high; });
      if (lo > 0 && hi > 0) {
        const pad = (hi - lo) * 0.08 || hi * 0.05;
        update["yaxis.range"] = [lo - pad, hi + pad];
      }
    }
    try { Plotly.relayout(container, update); } catch (_) {}
  }
  if (infoCard) {
    infoCard.innerHTML = `<h4>${event.label} <span class="timeline-info-date">${event.date}</span></h4><p>${event.desc}</p>`;
    infoCard.style.display = "block";
  }
  buttons.forEach((b) => b.classList.toggle("active", parseInt(b.dataset.event) === idx));
  const resetBtn = document.getElementById("timeline-reset-btn");
  if (resetBtn) resetBtn.classList.remove("active");
}

function setupTimelineButtons() {
  document.querySelectorAll(".timeline-event-btn[data-event]").forEach((btn) => {
    btn.addEventListener("click", () => showTimelineEvent(parseInt(btn.dataset.event)));
  });
  const resetBtn = document.getElementById("timeline-reset-btn");
  if (resetBtn) resetBtn.addEventListener("click", resetTimelineView);
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

/* Inline ticker picker: search the full meta universe and pick chips.
   Used by the correlation and efficient-frontier cards. */
function initTickerPicker(root, { initial = [], max = 8, onChange } = {}) {
  if (!root) return null;
  let tickers = [...initial];
  const input = root.querySelector(".ticker-picker-input");
  const results = root.querySelector(".ticker-picker-results");
  const chips = root.querySelector(".ticker-picker-chips");

  function renderChips() {
    chips.innerHTML = tickers.map(t => {
      const name = (StockData.companyName && StockData.companyName(t)) || "";
      return `<span class="ticker-chip" data-ticker="${t}"${name ? ` title="${name.replace(/"/g, "&quot;")}"` : ""}>${t}<button data-rm="${t}" aria-label="Remove ${t}">×</button></span>`;
    }).join("");
    chips.querySelectorAll("button[data-rm]").forEach(b => {
      b.addEventListener("click", () => {
        tickers = tickers.filter(t => t !== b.dataset.rm);
        renderChips();
        if (onChange) onChange(tickers);
      });
    });
    // Re-annotate in case the meta cache wasn't ready yet.
    StockData.annotateTickerTitles?.(chips);
  }

  let searchTimer = null;
  async function runSearch() {
    const q = (input.value || "").trim().toUpperCase();
    if (!q) { results.hidden = true; results.innerHTML = ""; return; }
    const meta = await StockData.loadMeta();
    if (!meta || !meta.length) { results.hidden = true; return; }
    const matches = meta
      .filter(m => m.symbol && m.symbol.toUpperCase().startsWith(q))
      .slice(0, 12);
    if (!matches.length) {
      results.innerHTML = `<div class="ticker-picker-result disabled">No matches for "${q}"</div>`;
      results.hidden = false;
      return;
    }
    results.innerHTML = matches.map(m => {
      const taken = tickers.includes(m.symbol);
      const full = tickers.length >= max && !taken;
      const cls = taken || full ? "ticker-picker-result disabled" : "ticker-picker-result";
      const dis = taken || full ? " disabled" : "";
      return `<button class="${cls}" data-add="${m.symbol}"${dis}>${m.symbol}${m.name ? " — " + m.name : ""}</button>`;
    }).join("");
    results.hidden = false;
    results.querySelectorAll("button[data-add]:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.add;
        if (tickers.includes(t) || tickers.length >= max) return;
        tickers.push(t);
        input.value = "";
        results.hidden = true;
        results.innerHTML = "";
        renderChips();
        if (onChange) onChange(tickers);
      });
    });
  }

  input.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 120);
  });
  // Click outside dismisses the suggestions popover.
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) { results.hidden = true; }
  });

  renderChips();
  return {
    tickers: () => [...tickers],
    set: (next) => { tickers = [...next]; renderChips(); if (onChange) onChange(tickers); },
  };
}

let __corrPicker = null;
let __frontierPicker = null;

/* Init all expert module charts on demand */
document.addEventListener("DOMContentLoaded", () => {
  setupTimelineButtons();

  __corrPicker = initTickerPicker(document.getElementById("corr-picker"), {
    initial: ["AAPL", "MSFT", "NVDA", "GOOG"],
    max: 8,
    onChange: () => loadCorrelationHeatmap(),
  });
  __frontierPicker = initTickerPicker(document.getElementById("frontier-picker"), {
    initial: ["AAPL", "MSFT", "NVDA", "GOOG"],
    max: 8,
    onChange: () => loadEfficientFrontier(),
  });

  document.querySelectorAll("#vol-ticker, #vol-period").forEach(el => el.addEventListener("change", loadVolatilityDeep));
  document.querySelectorAll("#sharpe-ticker, #sharpe-period").forEach(el => el.addEventListener("change", computeSharpeDisplay));
  document.getElementById("dd-ticker")?.addEventListener("change", loadMaxDrawdownDeep);

  // Auto-load when entering advanced mode (or now, if we're already there).
  if (document.body.classList.contains("expert")) {
    initExpertCharts();
  }
  document.addEventListener("sw-mode-change", (e) => {
    if (e.detail && e.detail.expert) initExpertCharts();
  });
});
