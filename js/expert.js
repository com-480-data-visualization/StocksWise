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

  // Up to date the label of the toggle
  const toggle = document.getElementById("expert-toggle");
  // check if toggle exists
  if (toggle) {
    const label = toggle.querySelector(".expert-toggle-label");
    if (label) label.textContent = saved === "expert" ? "Advanced" : "Beginner";
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".expert-toggle-label");
    if (!btn) return;
    // Apple-style cross-fade between modes. We tag <body> with a class that
    // fades out content, swap the mode class on the next frame, then untag so
    // it fades back in. Total ~360ms — matches the .sw-mode-fade CSS rule.
    const FADE_OUT = 180;
    document.body.classList.add("sw-mode-fade");
    setTimeout(() => {
      try {
        document.body.classList.toggle("expert");
        const isExpert = document.body.classList.contains("expert");
        localStorage.setItem(pageKey, isExpert ? "expert" : "beginner");
        // btn IS the .expert-toggle-label span (matched via closest), so set
        // its textContent directly. The original code chained .querySelector
        // here which silently returned null and threw.
        btn.textContent = isExpert ? "Advanced" : "Beginner";
        document.dispatchEvent(new CustomEvent("sw-mode-change", { detail: { expert: isExpert } }));
        updateNavLabels(isExpert);
        if (isExpert) initExpertCharts();
      } finally {
        // Always clear the fade class — otherwise an error would leave the
        // page invisible.
        // eslint-disable-next-line no-unused-expressions
        document.body.offsetHeight; // force reflow before fading in
        document.body.classList.remove("sw-mode-fade");
      }
    }, FADE_OUT);
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

/* ── Apple-style smooth chart updates ──
   Use Plotly.react() instead of Plotly.newPlot() so Plotly diffs the existing
   chart and animates between states. The transition block uses an easing that
   matches Apple's "ease-out-expo" feel — slow start tapering off softly. */
const APPLE_EASE = "cubic-in-out"; // closest Plotly built-in to cubic-bezier(.22,1,.36,1)
const APPLE_DUR = 650;             // matches the website hero animations

function smoothPlot(container, traces, layout, config) {
  if (!container) return;
  // Inject a transition block so trace updates (ticker change, indicator toggle,
  // period switch) morph instead of flash.
  const animatedLayout = Object.assign({}, layout, {
    transition: { duration: APPLE_DUR, easing: APPLE_EASE, ordering: "traces first" },
  });
  // First render: newPlot. Subsequent: react (diff-based, smooth).
  if (container._fullLayout) {
    Plotly.react(container, traces, animatedLayout, config);
  } else {
    Plotly.newPlot(container, traces, animatedLayout, config);
  }
}

/* ── Smooth lerped scroll value ──
   `lerpedScroll(target, key)` returns a value that eases toward `target` on
   every animation frame instead of jumping. Each key gets its own state. */
const _lerpState = new Map();
function startLerpLoop() {
  if (startLerpLoop._running) return;
  startLerpLoop._running = true;
  const tick = () => {
    let active = false;
    _lerpState.forEach((s) => {
      const diff = s.target - s.current;
      if (Math.abs(diff) > 0.0005) {
        s.current += diff * 0.14; // smoothing factor (lower = smoother/slower)
        active = true;
      } else {
        s.current = s.target;
      }
      if (s.onUpdate) s.onUpdate(s.current);
    });
    if (active) requestAnimationFrame(tick);
    else startLerpLoop._running = false;
  };
  requestAnimationFrame(tick);
}
function lerpTo(key, target, onUpdate) {
  let s = _lerpState.get(key);
  if (!s) { s = { current: target, target, onUpdate }; _lerpState.set(key, s); }
  s.target = target;
  s.onUpdate = onUpdate;
  startLerpLoop();
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
    // smoothPlot keeps the existing chart and morphs it; clearing innerHTML
    // would force a full re-render and kill the transition.
    if (!container._fullLayout) container.innerHTML = "";
    smoothPlot(container, traces, plotlyLayout({
      xaxis: { rangeslider: { visible: false } },
      yaxis: { title: "Price ($)" },
      shapes,
      height: 400,
    }), plotlyConfig());
  } else {
    if (!container._fullLayout) container.innerHTML = "";
    smoothPlot(container, traces, plotlyLayout({
      xaxis: { rangeslider: { visible: false } },
      yaxis: { title: "Price ($)" },
      height: 400,
    }), plotlyConfig());
  }

  // RSI chart
  if (rsiContainer) {
    const rsi = StockData.computeRSI(filtered, 14);
    if (!rsiContainer._fullLayout) rsiContainer.innerHTML = "";
    smoothPlot(rsiContainer, [{
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
    // Apple-style ease curve applied to the raw scroll progress. Without this,
    // the candle scaling/sliding feels linear (= mechanical). With it the
    // motion accelerates softly then settles.
    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const computeTarget = () => {
      const rect = chart.getBoundingClientRect();
      const viewH = window.innerHeight || 720;
      const start = viewH * 0.75;
      const end   = viewH * 0.25;
      return clamp01((start - rect.top) / (start - end));
    };
    const applyFuse = (v) => {
      // Apply easing once at write-time. The lerp loop already smooths jumps;
      // the easing shapes the final curve.
      anatomy.style.setProperty("--fuse", easeOutExpo(v).toFixed(4));
    };
    const updateFuse = () => lerpTo("candle-fuse", computeTarget(), applyFuse);
    window.addEventListener("scroll", updateFuse, { passive: true });
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

/* ── Hierarchical clustering for the correlation heatmap ──
   Groups highly-correlated tickers together so the matrix reveals visible
   "blocks" of similar names along the diagonal instead of showing them in
   the order they were checked. Uses average-linkage agglomerative
   clustering on distance = 1 − corr. Returns the reordered indices. */
function hierarchicalOrder(corr) {
  const n = corr.length;
  if (n <= 2) return corr.map((_, i) => i);
  const dist = corr.map(row => row.map(v => 1 - v));
  const clusters = Array.from({ length: n }, (_, i) => [i]);
  const clusterDist = (a, b) => {
    let sum = 0;
    for (const i of a) for (const j of b) sum += dist[i][j];
    return sum / (a.length * b.length);
  };
  while (clusters.length > 1) {
    let bestI = 0, bestJ = 1, bestD = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = clusterDist(clusters[i], clusters[j]);
        if (d < bestD) { bestD = d; bestI = i; bestJ = j; }
      }
    }
    const merged = clusters[bestI].concat(clusters[bestJ]);
    clusters.splice(bestJ, 1);
    clusters.splice(bestI, 1);
    clusters.push(merged);
  }
  return clusters[0];
}

async function loadCorrelationHeatmap() {
  const container = document.getElementById("corr-heatmap");
  if (!container) return;
  container.innerHTML = '<div class="chart-loading">Loading correlation data...</div>';

  const checkboxes = document.querySelectorAll(".corr-ticker:checked");
  let selectedTickers = Array.from(checkboxes).map(cb => cb.value);
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

  let matrix = StockData.computeCorrelationMatrix(aligned);

  // ── Reorder rows & columns so correlated stocks form visible blocks ──
  const order = hierarchicalOrder(matrix);
  selectedTickers = order.map(i => selectedTickers[i]);
  matrix = order.map(i => order.map(j => matrix[i][j]));

  // ── Build per-cell annotations with adaptive text color ──
  // Plotly's texttemplate uses one font for all cells, which leaves mid-value
  // cells (light bg) with white text that disappears. Annotations let us pick
  // a contrast color per cell based on |corr|. Diagonal cells get a dash —
  // they're always 1.00 so the number adds no information.
  const annotations = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      const v = matrix[i][j];
      const isDiag = i === j;
      annotations.push({
        x: selectedTickers[j],
        y: selectedTickers[i],
        text: isDiag ? "—" : (v >= 0 ? v.toFixed(2) : "−" + Math.abs(v).toFixed(2)),
        showarrow: false,
        font: {
          family: "JetBrains Mono, monospace",
          size: isDiag ? 14 : 13,
          // Light cells (mid corr) → dark text; dark cells → white text
          color: Math.abs(v) > 0.55 ? "#ffffff" : "#1e222d",
        },
      });
    }
  }

  container.innerHTML = "";
  smoothPlot(container, [{
    z: matrix,
    x: selectedTickers,
    y: selectedTickers,
    type: "heatmap",
    // Perceptually-balanced diverging palette: deep cobalt (−1) → cream (0)
    // → deep red (+1). The cream band keeps mid-correlation cells legible
    // against the dark page bg, where the old "blue → gray → red" scale
    // had values around 0 disappearing into the background.
    colorscale: [
      [0.00, "#1565c0"],   // strong negative
      [0.25, "#5b8def"],   // mild negative
      [0.45, "#eef0f4"],   // neutral band start
      [0.55, "#eef0f4"],   // neutral band end
      [0.75, "#ff8a65"],   // mild positive
      [1.00, "#c62828"],   // strong positive
    ],
    zmin: -1, zmax: 1,
    xgap: 3, ygap: 3,          // thin gaps → modern "grid" look
    hovertemplate: "<b>%{x}</b> ↔ <b>%{y}</b><br>ρ = %{z:.3f}<extra></extra>",
    colorbar: {
      title: { text: "ρ", side: "right", font: { size: 13, color: "#d1d4dc" } },
      tickvals: [-1, -0.5, 0, 0.5, 1],
      ticktext: ["−1.0", "−0.5", "0", "+0.5", "+1.0"],
      tickfont: { size: 10, color: "#787b86" },
      thickness: 12,
      len: 0.85,
      outlinewidth: 0,
    },
  }], plotlyLayout({
    height: 420,
    margin: { l: 70, r: 70, t: 30, b: 70 },
    xaxis: { tickangle: -45, side: "bottom", showgrid: false, zeroline: false, ticks: "" },
    yaxis: { autorange: "reversed", showgrid: false, zeroline: false, ticks: "" },
    annotations,
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

  const eventsData = [
  {
    title: "1987 Black Monday",
    description: "A sudden global stock market crash where the Dow Jones fell over 22% in a single day. It exposed weaknesses in market structure and led to the introduction of circuit breakers."
  },
  {
    title: "2000 Dot-com Bubble",
    description: "Tech stocks reached extreme valuations before collapsing. Many internet companies failed, and the NASDAQ lost nearly 80% of its value over the following years."
  },
  {
    title: "2008 Financial Crisis",
    description: "Triggered by the collapse of the housing market and financial institutions. Massive sell-offs occurred, leading to a global recession and major regulatory reforms."
  },
  {
    title: "2020 COVID Crash",
    description: "Markets dropped sharply due to global lockdowns and uncertainty. Rapid intervention by central banks led to one of the fastest recoveries in history."
  },
  {
    title: "2022 Rate Hike Selloff",
    description: "Rising inflation forced central banks to increase interest rates. Growth stocks, especially tech, declined significantly due to higher discount rates."
  }
];

const buttons = document.querySelectorAll(".timeline-event-btn");
const titleEl = document.querySelector(".timeline-events-description h3");
const descEl = document.querySelector(".timeline-events-description p");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const index = btn.dataset.event;
    const event = eventsData[index];

    // Update content
    titleEl.textContent = event.title;
    descEl.textContent = event.description;

    // Optional: active state
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

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
