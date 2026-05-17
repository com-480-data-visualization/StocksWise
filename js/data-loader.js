/* ══════════════════════════════════════════════
   StocksWise - Data Loader & Financial Indicators
   Loads CSV stock/ETF data and computes technical indicators.
   ══════════════════════════════════════════════ */

const StockData = (() => {
  const cache = {};
  const DATA_BASE = "https://raw.githubusercontent.com/com-480-data-visualization/StocksWise/data";

  // Map display tickers to the filename actually present in the dataset.
  // Meta rebranded from FB → META in Oct 2021; the historical file is still FB.
  const TICKER_ALIASES = {
    META: "FB",
  };

  async function loadTicker(ticker) {
    const key = ticker.toUpperCase();
    const fileKey = TICKER_ALIASES[key] || key;
    if (cache[fileKey]) return cache[fileKey];

    const paths = [
      `${DATA_BASE}/stocks/${fileKey}.csv`,
      `${DATA_BASE}/etfs/${fileKey}.csv`,
    ];

    for (const url of paths) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        const data = parseCSV(text);
        if (data.length > 0) {
          cache[fileKey] = data;
          return data;
        }
      } catch (e) { /* try next path */ }
    }
    console.warn(`Could not load data for ${ticker}`);
    return null;
  }

  let metaCache = null;
  let nameMap = null;

  // Synchronous lookup once loadMeta() has populated the cache. Returns the
  // company name for a ticker, or null if unknown / not yet loaded. Callers
  // wanting to ensure the cache is warm should `await StockData.loadMeta()`
  // first (most pages do this at startup to populate ticker pickers).
  function companyName(symbol) {
    if (!nameMap) return null;
    return nameMap.get(symbol.toUpperCase()) || null;
  }

  // Convenience: kick off a lazy load, and once it's done, walk every element
  // with a `data-ticker` attribute and set its `title` to the company name.
  // Idempotent - call whenever new ticker chips appear in the DOM.
  async function annotateTickerTitles(root) {
    await loadMeta();
    const scope = root || document;
    scope.querySelectorAll("[data-ticker]").forEach((el) => {
      const t = el.dataset.ticker;
      const name = companyName(t);
      if (name && el.getAttribute("title") !== name) el.setAttribute("title", name);
    });
  }

  async function loadMeta() {
    if (metaCache) return metaCache;
    try {
      const res = await fetch(`${DATA_BASE}/symbols_valid_meta.csv`);
      if (!res.ok) return [];
      const text = await res.text();
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",");
      const symbolIdx = headers.indexOf("Symbol") !== -1 ? headers.indexOf("Symbol") : headers.indexOf("NASDAQ Symbol");
      const nameIdx = headers.indexOf("Security Name") !== -1 ? headers.indexOf("Security Name") : 1;
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (cols.length > Math.max(symbolIdx, nameIdx)) {
          rows.push({ symbol: cols[symbolIdx]?.trim(), name: cols[nameIdx]?.trim() });
        }
      }
      metaCache = rows.filter(r => r.symbol && r.symbol.length > 0);
      nameMap = new Map(metaCache.map(r => [r.symbol.toUpperCase(), r.name]));
      return metaCache;
    } catch (e) { return []; }
  }

  function parseCSV(text) {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < 7) continue;
      const date = cols[0];
      const open = parseFloat(cols[1]);
      const high = parseFloat(cols[2]);
      const low = parseFloat(cols[3]);
      const close = parseFloat(cols[4]);
      const adjClose = parseFloat(cols[5]);
      const volume = parseInt(cols[6], 10);
      if (isNaN(close) || isNaN(open)) continue;
      rows.push({ date, open, high, low, close, adjClose, volume });
    }
    return rows;
  }

  function filterByDate(data, startDate, endDate) {
    return data.filter(d => {
      if (startDate && d.date < startDate) return false;
      if (endDate && d.date > endDate) return false;
      return true;
    });
  }

  // Simple Moving Average
  function computeSMA(data, period, field = "close") {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j][field];
      result.push(sum / period);
    }
    return result;
  }

  // Exponential Moving Average
  function computeEMA(data, period, field = "close") {
    const result = [];
    const k = 2 / (period + 1);
    let ema = null;
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      if (ema === null) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j][field];
        ema = sum / period;
      } else {
        ema = data[i][field] * k + ema * (1 - k);
      }
      result.push(ema);
    }
    return result;
  }

  // RSI (Relative Strength Index)
  function computeRSI(data, period = 14, field = "close") {
    const result = [];
    const changes = [];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) { changes.push(0); result.push(null); continue; }
      changes.push(data[i][field] - data[i - 1][field]);
      if (i < period) { result.push(null); continue; }

      let avgGain = 0, avgLoss = 0;
      if (i === period) {
        for (let j = 1; j <= period; j++) {
          if (changes[j] > 0) avgGain += changes[j];
          else avgLoss -= changes[j];
        }
        avgGain /= period;
        avgLoss /= period;
      } else {
        const prevRSI = result[i - 1];
        const prevAvgGain = result._lastAvgGain || 0;
        const prevAvgLoss = result._lastAvgLoss || 0;
        avgGain = (prevAvgGain * (period - 1) + Math.max(changes[i], 0)) / period;
        avgLoss = (prevAvgLoss * (period - 1) + Math.max(-changes[i], 0)) / period;
      }
      result._lastAvgGain = avgGain;
      result._lastAvgLoss = avgLoss;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
    delete result._lastAvgGain;
    delete result._lastAvgLoss;
    return result;
  }

  // MACD
  function computeMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9, field = "close") {
    const emaFast = computeEMA(data, fastPeriod, field);
    const emaSlow = computeEMA(data, slowPeriod, field);
    const macdLine = emaFast.map((f, i) => (f !== null && emaSlow[i] !== null) ? f - emaSlow[i] : null);

    // Signal line (EMA of MACD)
    const macdData = macdLine.map((v, i) => ({ close: v, date: data[i].date }));
    const signal = [];
    const k = 2 / (signalPeriod + 1);
    let ema = null;
    let validCount = 0;
    for (let i = 0; i < macdData.length; i++) {
      if (macdData[i].close === null) { signal.push(null); continue; }
      validCount++;
      if (validCount < signalPeriod) { signal.push(null); continue; }
      if (ema === null) {
        let sum = 0, cnt = 0;
        for (let j = 0; j <= i; j++) {
          if (macdData[j].close !== null) { sum += macdData[j].close; cnt++; if (cnt === signalPeriod) break; }
        }
        ema = sum / signalPeriod;
      } else {
        ema = macdData[i].close * k + ema * (1 - k);
      }
      signal.push(ema);
    }

    const histogram = macdLine.map((m, i) => (m !== null && signal[i] !== null) ? m - signal[i] : null);
    return { macdLine, signal, histogram };
  }

  // Rolling Volatility (annualized)
  function computeRollingVolatility(data, window = 30, field = "close") {
    const returns = [null];
    for (let i = 1; i < data.length; i++) {
      returns.push(Math.log(data[i][field] / data[i - 1][field]));
    }
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < window) { result.push(null); continue; }
      const slice = returns.slice(i - window + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b) / window;
      const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (window - 1);
      result.push(Math.sqrt(variance) * Math.sqrt(252) * 100);
    }
    return result;
  }

  // Max Drawdown
  function computeMaxDrawdown(data, field = "close") {
    let peak = -Infinity;
    let maxDD = 0;
    let peakDate = data[0].date, troughDate = data[0].date;
    let currentPeakDate = data[0].date;
    const drawdownSeries = [];

    for (let i = 0; i < data.length; i++) {
      const val = data[i][field];
      if (val > peak) {
        peak = val;
        currentPeakDate = data[i].date;
      }
      const dd = (peak - val) / peak;
      drawdownSeries.push(-dd * 100);
      if (dd > maxDD) {
        maxDD = dd;
        peakDate = currentPeakDate;
        troughDate = data[i].date;
      }
    }
    return { maxDD: maxDD * 100, peakDate, troughDate, drawdownSeries };
  }

  // Sharpe Ratio
  function computeSharpeRatio(data, riskFreeRate = 0.02, field = "close") {
    if (data.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push(data[i][field] / data[i - 1][field] - 1);
    }
    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    const annualReturn = avgReturn * 252;
    const std = Math.sqrt(returns.reduce((a, b) => a + (b - avgReturn) ** 2, 0) / (returns.length - 1));
    const annualVol = std * Math.sqrt(252);
    return annualVol === 0 ? 0 : (annualReturn - riskFreeRate) / annualVol;
  }

  // Annualized Return
  function computeAnnualizedReturn(data, field = "close") {
    if (data.length < 2) return 0;
    const startPrice = data[0][field];
    const endPrice = data[data.length - 1][field];
    const years = daysBetween(data[0].date, data[data.length - 1].date) / 365.25;
    return (Math.pow(endPrice / startPrice, 1 / years) - 1) * 100;
  }

  // Annualized Volatility
  function computeAnnualizedVolatility(data, field = "close") {
    if (data.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push(Math.log(data[i][field] / data[i - 1][field]));
    }
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  // Correlation matrix
  function computeCorrelationMatrix(datasets) {
    // datasets is an array of arrays of daily returns
    const n = datasets.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        matrix[i][j] = correlation(datasets[i], datasets[j]);
      }
    }
    return matrix;
  }

  function correlation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i]; sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }
    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  }

  function dailyReturns(data, field = "close") {
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push(data[i][field] / data[i - 1][field] - 1);
    }
    return returns;
  }

  // Support & Resistance detection
  function detectSupportResistance(data, windowSize = 20, field = "close") {
    const supports = [];
    const resistances = [];
    for (let i = windowSize; i < data.length - windowSize; i++) {
      const val = data[i][field];
      let isLow = true, isHigh = true;
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j === i) continue;
        if (data[j][field] <= val) isLow = false;
        if (data[j][field] >= val) isHigh = false;
      }
      if (isLow) supports.push({ date: data[i].date, price: val });
      if (isHigh) resistances.push({ date: data[i].date, price: val });
    }
    // Cluster nearby levels
    return {
      supports: clusterLevels(supports),
      resistances: clusterLevels(resistances),
    };
  }

  function clusterLevels(levels, threshold = 0.03) {
    if (levels.length === 0) return [];
    const sorted = [...levels].sort((a, b) => a.price - b.price);
    const clusters = [{ price: sorted[0].price, count: 1, dates: [sorted[0].date] }];
    for (let i = 1; i < sorted.length; i++) {
      const last = clusters[clusters.length - 1];
      if (Math.abs(sorted[i].price - last.price) / last.price < threshold) {
        last.price = (last.price * last.count + sorted[i].price) / (last.count + 1);
        last.count++;
        last.dates.push(sorted[i].date);
      } else {
        clusters.push({ price: sorted[i].price, count: 1, dates: [sorted[i].date] });
      }
    }
    return clusters.filter(c => c.count >= 2).sort((a, b) => b.count - a.count).slice(0, 5);
  }

  function daysBetween(d1, d2) {
    return (new Date(d2) - new Date(d1)) / 86400000;
  }

  // Generate portfolio value from multiple tickers with weights
  function computePortfolioValue(tickerDatasets, weights, initialCapital = 1000) {
    // Align all datasets to same date range
    const dateMap = new Map();
    tickerDatasets.forEach((data, idx) => {
      data.forEach(d => {
        if (!dateMap.has(d.date)) dateMap.set(d.date, Array(tickerDatasets.length).fill(null));
        dateMap.get(d.date)[idx] = d.close;
      });
    });

    const dates = [...dateMap.keys()].sort();
    const aligned = dates.filter(d => {
      const vals = dateMap.get(d);
      return vals.every(v => v !== null);
    });

    if (aligned.length < 2) return [];

    const startPrices = dateMap.get(aligned[0]);
    const portfolio = aligned.map(date => {
      const prices = dateMap.get(date);
      let value = 0;
      for (let i = 0; i < weights.length; i++) {
        value += weights[i] * (prices[i] / startPrices[i]);
      }
      return { date, value: value * initialCapital };
    });
    return portfolio;
  }

  return {
    loadTicker,
    filterByDate,
    computeSMA,
    computeEMA,
    computeRSI,
    computeMACD,
    computeRollingVolatility,
    computeMaxDrawdown,
    computeSharpeRatio,
    computeAnnualizedReturn,
    computeAnnualizedVolatility,
    computeCorrelationMatrix,
    dailyReturns,
    detectSupportResistance,
    computePortfolioValue,
    loadMeta,
    companyName,
    annotateTickerTitles,
    daysBetween,
  };
})();
