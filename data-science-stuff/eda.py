"""
StockWise — Exploratory Data Analysis
Generates charts for the README EDA section.
Output: data-science-stuff/figures/
"""

import os
import glob
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
from datetime import datetime

# ── Config ──────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
FIG_DIR = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(FIG_DIR, exist_ok=True)

STYLE = {
    "bg": "#131722",
    "surface": "#1e222d",
    "text": "#d1d4dc",
    "muted": "#787b86",
    "accent": "#2962ff",
    "green": "#26a69a",
    "red": "#ef5350",
    "purple": "#7c4dff",
    "orange": "#ff9800",
}

plt.rcParams.update({
    "figure.facecolor": STYLE["bg"],
    "axes.facecolor": STYLE["surface"],
    "axes.edgecolor": STYLE["muted"],
    "axes.labelcolor": STYLE["text"],
    "text.color": STYLE["text"],
    "xtick.color": STYLE["muted"],
    "ytick.color": STYLE["muted"],
    "grid.color": "#2a2e39",
    "grid.alpha": 0.5,
    "font.family": "sans-serif",
    "font.size": 11,
    "legend.facecolor": STYLE["surface"],
    "legend.edgecolor": STYLE["muted"],
})


def load_ticker(folder, ticker):
    """Load a single ticker CSV."""
    path = os.path.join(DATA_DIR, folder, f"{ticker}.csv")
    df = pd.read_csv(path, parse_dates=["Date"])
    df = df.sort_values("Date").dropna(subset=["Adj Close"])
    return df


def load_all_meta():
    """Load metadata and count rows per ticker."""
    meta_path = os.path.join(DATA_DIR, "symbols_valid_meta.csv")
    meta = pd.read_csv(meta_path)
    return meta


# ═══════════════════════════════════════════════════════
# CHART 1: Growth of $1 — FAANG + QQQ
# ═══════════════════════════════════════════════════════
def chart_growth():
    print("  [1/5] Growth of $1 invested...")
    tickers = {
        "AAPL": ("Apple", STYLE["accent"]),
        "MSFT": ("Microsoft", STYLE["green"]),
        "AMZN": ("Amazon", STYLE["orange"]),
        "NVDA": ("NVIDIA", STYLE["purple"]),
        "TSLA": ("Tesla", STYLE["red"]),
        "QQQ":  ("QQQ ETF", STYLE["muted"]),
    }

    fig, ax = plt.subplots(figsize=(12, 6))
    start_date = pd.Timestamp("2010-01-04")

    for ticker, (name, color) in tickers.items():
        try:
            folder = "etfs" if ticker == "QQQ" else "stocks"
            df = load_ticker(folder, ticker)
            df = df[df["Date"] >= start_date].copy()
            if df.empty:
                continue
            df["Growth"] = df["Adj Close"] / df["Adj Close"].iloc[0]
            linewidth = 2.5 if ticker != "QQQ" else 1.5
            linestyle = "-" if ticker != "QQQ" else "--"
            ax.plot(df["Date"], df["Growth"], label=name,
                    color=color, linewidth=linewidth, linestyle=linestyle)
        except Exception as e:
            print(f"    Skipping {ticker}: {e}")

    ax.set_yscale("log")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"${v:,.0f}"))
    ax.set_title("Growth of $1 Invested (Jan 2010 – Apr 2020)", fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel("")
    ax.set_ylabel("Portfolio Value (log scale)")
    ax.legend(loc="upper left", fontsize=10)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, "growth_of_1.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)


# ═══════════════════════════════════════════════════════
# CHART 2: Dataset coverage — rows per ticker histogram
# ═══════════════════════════════════════════════════════
def chart_coverage():
    print("  [2/5] Dataset coverage histogram...")
    row_counts = []
    for folder in ["stocks", "etfs"]:
        pattern = os.path.join(DATA_DIR, folder, "*.csv")
        for path in glob.glob(pattern):
            try:
                n = sum(1 for _ in open(path)) - 1  # minus header
                if n > 0:
                    row_counts.append({"rows": n, "type": "Stock" if folder == "stocks" else "ETF"})
            except:
                pass

    df = pd.DataFrame(row_counts)
    fig, ax = plt.subplots(figsize=(10, 5))

    stocks = df[df["type"] == "Stock"]["rows"]
    etfs = df[df["type"] == "ETF"]["rows"]
    bins = np.linspace(0, max(df["rows"]), 60)

    ax.hist(stocks, bins=bins, alpha=0.7, color=STYLE["accent"], label=f"Stocks ({len(stocks):,})")
    ax.hist(etfs, bins=bins, alpha=0.7, color=STYLE["green"], label=f"ETFs ({len(etfs):,})")

    ax.set_title("Distribution of Trading Days per Ticker", fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel("Number of Trading Days")
    ax.set_ylabel("Number of Tickers")
    ax.legend(fontsize=10)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, "coverage_histogram.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)


# ═══════════════════════════════════════════════════════
# CHART 3: Market volume during crises
# ═══════════════════════════════════════════════════════
def chart_volume_crises():
    print("  [3/5] NASDAQ volume during crises...")
    try:
        df = load_ticker("etfs", "QQQ")
    except:
        print("    QQQ not found, skipping.")
        return

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.bar(df["Date"], df["Volume"] / 1e6, width=2, color=STYLE["accent"], alpha=0.6)

    crises = [
        ("2000-03-10", "Dot-com\npeak"),
        ("2008-09-15", "Lehman\ncollapse"),
        ("2020-03-16", "COVID\ncrash"),
    ]
    for date_str, label in crises:
        d = pd.Timestamp(date_str)
        if d >= df["Date"].min() and d <= df["Date"].max():
            ax.axvline(d, color=STYLE["red"], linewidth=1.5, linestyle="--", alpha=0.8)
            ax.text(d, ax.get_ylim()[1] * 0.92, label,
                    color=STYLE["red"], fontsize=9, ha="center", fontweight="bold",
                    bbox=dict(boxstyle="round,pad=0.3", facecolor=STYLE["bg"], edgecolor=STYLE["red"], alpha=0.8))

    ax.set_title("QQQ Daily Trading Volume with Major Crises", fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel("")
    ax.set_ylabel("Volume (millions of shares)")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, "volume_crises.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)


# ═══════════════════════════════════════════════════════
# CHART 4: Volatility comparison — stocks vs ETF
# ═══════════════════════════════════════════════════════
def chart_volatility():
    print("  [4/5] Volatility comparison...")
    tickers = {
        "NVDA": ("NVIDIA", STYLE["purple"], "stocks"),
        "TSLA": ("Tesla", STYLE["red"], "stocks"),
        "AAPL": ("Apple", STYLE["accent"], "stocks"),
        "QQQ":  ("QQQ ETF", STYLE["green"], "etfs"),
    }

    fig, ax = plt.subplots(figsize=(10, 5))
    start = pd.Timestamp("2015-01-01")

    for ticker, (name, color, folder) in tickers.items():
        try:
            df = load_ticker(folder, ticker)
            df = df[df["Date"] >= start].copy()
            if len(df) < 60:
                continue
            df["Return"] = df["Adj Close"].pct_change()
            df["Vol30"] = df["Return"].rolling(30).std() * np.sqrt(252) * 100
            ax.plot(df["Date"], df["Vol30"], label=name, color=color, linewidth=1.5, alpha=0.85)
        except Exception as e:
            print(f"    Skipping {ticker}: {e}")

    ax.set_title("30-Day Rolling Annualized Volatility (2015–2020)", fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel("")
    ax.set_ylabel("Annualized Volatility (%)")
    ax.legend(loc="upper left", fontsize=10)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, "volatility_comparison.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)


# ═══════════════════════════════════════════════════════
# CHART 5: Return vs Risk scatter (annualized)
# ═══════════════════════════════════════════════════════
def chart_risk_return():
    print("  [5/5] Risk vs Return scatter...")
    start = pd.Timestamp("2015-01-01")
    results = []

    # Sample a manageable subset
    stock_files = glob.glob(os.path.join(DATA_DIR, "stocks", "*.csv"))
    etf_files = glob.glob(os.path.join(DATA_DIR, "etfs", "*.csv"))

    for path in stock_files + etf_files:
        try:
            ticker = os.path.splitext(os.path.basename(path))[0]
            is_etf = "/etfs/" in path or "\\etfs\\" in path
            df = pd.read_csv(path, parse_dates=["Date"])
            df = df.sort_values("Date").dropna(subset=["Adj Close"])
            df = df[df["Date"] >= start]
            if len(df) < 252:  # at least 1 year of data
                continue
            returns = df["Adj Close"].pct_change().dropna()
            ann_return = returns.mean() * 252 * 100
            ann_vol = returns.std() * np.sqrt(252) * 100
            if ann_vol > 200 or abs(ann_return) > 300:
                continue  # skip outliers
            results.append({
                "ticker": ticker,
                "return": ann_return,
                "volatility": ann_vol,
                "type": "ETF" if is_etf else "Stock",
            })
        except:
            pass

    df = pd.DataFrame(results)
    if df.empty:
        print("    No data for scatter plot.")
        return

    fig, ax = plt.subplots(figsize=(10, 7))

    stocks = df[df["type"] == "Stock"]
    etfs = df[df["type"] == "ETF"]

    ax.scatter(stocks["volatility"], stocks["return"],
               c=STYLE["accent"], alpha=0.15, s=12, label=f"Stocks ({len(stocks)})")
    ax.scatter(etfs["volatility"], etfs["return"],
               c=STYLE["green"], alpha=0.3, s=18, label=f"ETFs ({len(etfs)})")

    # Highlight key tickers
    highlights = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "QQQ"]
    for _, row in df[df["ticker"].isin(highlights)].iterrows():
        ax.annotate(row["ticker"],
                    (row["volatility"], row["return"]),
                    fontsize=9, fontweight="bold", color=STYLE["text"],
                    textcoords="offset points", xytext=(6, 6),
                    arrowprops=dict(arrowstyle="-", color=STYLE["muted"], lw=0.5))
        ax.scatter([row["volatility"]], [row["return"]],
                   c=STYLE["orange"], s=40, zorder=5, edgecolors="white", linewidths=0.5)

    ax.axhline(0, color=STYLE["muted"], linewidth=0.5, linestyle="--")
    ax.set_title("Annualized Return vs Volatility (2015–2020)", fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel("Annualized Volatility (%)")
    ax.set_ylabel("Annualized Return (%)")
    ax.legend(loc="upper left", fontsize=10)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, "risk_return_scatter.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)


# ═══════════════════════════════════════════════════════
# RUN ALL
# ═══════════════════════════════════════════════════════
if __name__ == "__main__":
    print("StockWise EDA — generating figures...\n")
    chart_growth()
    chart_coverage()
    chart_volume_crises()
    chart_volatility()
    chart_risk_return()
    print(f"\nDone! Figures saved to {FIG_DIR}/")
