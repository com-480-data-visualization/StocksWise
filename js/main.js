/* StocksWise - Main JS
   Theme toggle, nav, scroll effects, module quizzes, hero counters. */

/* Theme Toggle */
(function initTheme() {
  const saved = localStorage.getItem("sw-theme");
  if (saved === "light") document.body.classList.add("light");

  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    localStorage.setItem("sw-theme", isLight ? "light" : "dark");
    document.dispatchEvent(new CustomEvent("sw-theme-change"));
  });
})();

/* Ticker Tape */
(function initTicker() {
  const track = document.getElementById("ticker-track");
  if (!track) return;

  const tickers = [
    { symbol: "AAPL",  price: "189.84", change: "+1.23%", up: true },
    { symbol: "MSFT",  price: "415.56", change: "+0.87%", up: true },
    { symbol: "NVDA",  price: "878.37", change: "+3.41%", up: true },
    { symbol: "AMZN",  price: "178.25", change: "-0.42%", up: false },
    { symbol: "TSLA",  price: "175.21", change: "-2.15%", up: false },
    { symbol: "META",  price: "502.30", change: "+1.65%", up: true },
    { symbol: "GOOG",  price: "153.81", change: "+0.35%", up: true },
    { symbol: "QQQ",   price: "438.12", change: "+0.92%", up: true },
    { symbol: "NFLX",  price: "605.88", change: "+2.08%", up: true },
    { symbol: "AMD",   price: "172.44", change: "-1.12%", up: false },
  ];

  // Duplicate for seamless loop
  const items = [...tickers, ...tickers];
  track.innerHTML = items
    .map(
      (t) => `
    <div class="ticker-item" data-ticker="${t.symbol}">
      <span class="ticker-symbol">${t.symbol}</span>
      <span class="ticker-price">$${t.price}</span>
      <span class="ticker-change ${t.up ? "up" : "down"}">${t.change}</span>
    </div>`
    )
    .join("");

  if (window.StockData?.annotateTickerTitles) StockData.annotateTickerTitles(track);
})();

/* Mobile nav toggle */
(function initNavToggle() {
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    links.classList.toggle("open");
  });

  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => links.classList.remove("open"));
  });
})();

/* Scroll-spy: highlight active nav link */
(function initScrollSpy() {
  const sections = document.querySelectorAll(".topic-section");
  const navLinks = document.querySelectorAll("#nav-links a");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle(
              "active",
              link.getAttribute("href") === `#${id}`
            );
          });
        }
      });
    },
    {
      rootMargin: "-30% 0px -60% 0px",
      threshold: 0,
    }
  );

  sections.forEach((s) => observer.observe(s));
})();

/* Scroll reveal animation - two-way: cards toggle .visible on enter/exit
   so the module feels alive instead of cards piling up statically. */
(function initReveal() {
  const reveals = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("visible", entry.isIntersecting);
      });
    },
    // Shrunk viewport box keeps the in-focus card centered while neighbours blur on the edges.
    { threshold: 0.15, rootMargin: "-8% 0px -18% 0px" }
  );

  reveals.forEach((el) => observer.observe(el));
})();

/* Active-section highlight on the sticky label */
(function initActiveSection() {
  const sections = document.querySelectorAll(".topic-section");
  if (!sections.length) return;

  function update() {
    const viewH = window.innerHeight;
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const inView = rect.top < viewH * 0.6 && rect.bottom > viewH * 0.35;
      section.classList.toggle("in-view", inView);
    });
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    },
    { passive: true }
  );
  window.addEventListener("resize", update);
  update();
})();

/* Mouse-following glow - .section-glow is position: fixed so its 600px blur halo
   doesn't bloat document scroll height; left/top are viewport coords from clientX/Y,
   and only the section currently under :hover ever shows (no scroll handler needed). */
(function initGlow() {
  const glows = document.querySelectorAll(".section-glow");
  if (!glows.length) return;

  document.addEventListener("mousemove", (e) => {
    glows.forEach((g) => {
      g.style.left = e.clientX + "px";
      g.style.top  = e.clientY + "px";
    });
  });
})();

/* Nav background on scroll */
(function initNavScroll() {
  const nav = document.getElementById("topnav");
  if (!nav) return;

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.style.borderBottomColor =
          window.scrollY > 80
            ? "var(--border-light)"
            : "var(--border)";
        ticking = false;
      });
      ticking = true;
    }
  });
})();

/* PER-MODULE QUIZZES (popup modals) */
(function initModuleQuizzes() {
  const moduleQuizzes = {
    stocks: {
      title: "Stocks - Module Quiz",
      questions: [
        {
          q: "What does a stock represent?",
          options: ["A loan you give to a company", "A piece of ownership in a company", "A government bond", "A type of savings account"],
          answer: 1,
        },
        {
          q: "What does 'Adj Close' account for?",
          options: ["Inflation", "Stock splits and dividends", "Broker fees", "Currency conversion"],
          answer: 1,
        },
      ],
    },
    etfs: {
      title: "ETFs - Module Quiz",
      questions: [
        {
          q: "What is the main advantage of an ETF over a single stock?",
          options: ["ETFs are always cheaper", "ETFs never lose value", "ETFs provide diversification", "ETFs pay higher dividends"],
          answer: 2,
        },
        {
          q: "What does the QQQ ETF track?",
          options: ["The S&P 500", "The Dow Jones", "The 100 largest non-financial NASDAQ companies", "All US tech stocks"],
          answer: 2,
        },
      ],
    },
    risks: {
      title: "Risks - Module Quiz",
      questions: [
        {
          q: "What does the Sharpe ratio measure?",
          options: ["The total return of a stock", "The volatility of a stock", "Return per unit of risk", "The daily trading volume"],
          answer: 2,
        },
        {
          q: "If a stock's price drops 50%, how much must it rise to recover?",
          options: ["50%", "75%", "100%", "200%"],
          answer: 2,
        },
      ],
    },
    simulation: {
      title: "Simulation - Module Quiz",
      questions: [
        {
          q: "What is Dollar-Cost Averaging?",
          options: ["Buying the cheapest stocks", "Investing a fixed amount at regular intervals", "Selling when prices drop", "Only buying in January"],
          answer: 1,
        },
        {
          q: "Why is backtesting with historical data useful?",
          options: ["It guarantees future returns", "It shows how strategies would have performed", "It eliminates all risk", "It predicts exact prices"],
          answer: 1,
        },
      ],
    },
  };

  const overlay = document.getElementById("quiz-overlay");
  const modal = overlay.querySelector(".quiz-modal");
  const titleEl = document.getElementById("quiz-modal-title");
  const bodyEl = document.getElementById("quiz-modal-body");
  const resultEl = document.getElementById("quiz-modal-result");
  const submitBtn = document.getElementById("quiz-modal-submit");
  const closeBtn = document.getElementById("quiz-close");

  let currentModule = null;

  function getCompleted() {
    try { return JSON.parse(localStorage.getItem("sw-completed") || "[]"); } catch { return []; }
  }
  function setCompleted(list) {
    localStorage.setItem("sw-completed", JSON.stringify(list));
  }
  function markCompleted(mod) {
    const list = getCompleted();
    if (!list.includes(mod)) { list.push(mod); setCompleted(list); }
    updateUI(mod);
  }
  function unmarkCompleted(mod) {
    const list = getCompleted().filter(m => m !== mod);
    setCompleted(list);
    const badge = document.getElementById("badge-" + mod);
    if (badge) { badge.textContent = ""; badge.classList.remove("show"); }
    const btn = document.querySelector(`.btn-quiz[data-module="${mod}"]`);
    if (btn) { btn.textContent = "Take Quiz"; btn.classList.remove("completed"); }
  }
  function updateUI(mod) {
    const badge = document.getElementById("badge-" + mod);
    if (badge) { badge.textContent = "Completed"; badge.classList.add("show"); }
    const btn = document.querySelector(`.btn-quiz[data-module="${mod}"]`);
    if (btn) { btn.textContent = "Retake Quiz"; btn.classList.add("completed"); }
  }

  getCompleted().forEach(updateUI);

  // Allow retake even when the module is already completed.
  document.querySelectorAll(".btn-quiz").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mod = btn.dataset.module;
      currentModule = mod;
      openQuiz(mod);
    });
  });

  function openQuiz(mod) {
    const data = moduleQuizzes[mod];
    titleEl.textContent = data.title;
    resultEl.classList.add("hidden");
    resultEl.classList.remove("fail");
    submitBtn.disabled = false;
    submitBtn.textContent = "Check Answers";
    delete submitBtn.dataset.action;

    let html = "";
    data.questions.forEach((item, i) => {
      html += `<div class="quiz-question" data-correct="${item.answer}">
        <p>${i + 1}. ${item.q}</p>
        <div class="quiz-options">`;
      item.options.forEach((opt, j) => {
        html += `<label><input type="radio" name="mq${i}" value="${j}"> ${opt}</label>`;
      });
      html += `</div></div>`;
    });
    bodyEl.innerHTML = html;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeQuiz() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    currentModule = null;
  }

  closeBtn.addEventListener("click", closeQuiz);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeQuiz(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("open")) closeQuiz(); });

  submitBtn.addEventListener("click", () => {
    // After a fail, the same button becomes "Try Again": reopen the quiz fresh.
    if (submitBtn.dataset.action === "retry") {
      openQuiz(currentModule);
      return;
    }
    if (submitBtn.dataset.action === "close") {
      closeQuiz();
      return;
    }

    const questions = bodyEl.querySelectorAll(".quiz-question");
    let score = 0;

    questions.forEach((qEl) => {
      const correct = parseInt(qEl.dataset.correct, 10);
      const labels = qEl.querySelectorAll("label");
      const selected = qEl.querySelector("input:checked");

      labels.forEach((label, idx) => {
        label.querySelector("input").disabled = true;
        if (idx === correct) label.classList.add("correct");
        else if (selected && parseInt(selected.value, 10) === idx) label.classList.add("wrong");
      });

      if (selected && parseInt(selected.value, 10) === correct) score++;
    });

    const total = questions.length;
    const passed = score === total;

    resultEl.classList.remove("hidden", "fail");
    if (passed) {
      resultEl.textContent = `${score}/${total} - Module completed!`;
      markCompleted(currentModule);
      submitBtn.textContent = "Close";
      submitBtn.dataset.action = "close";
    } else {
      // Failing a retake revokes the completed badge - current state is "not passed".
      if (getCompleted().includes(currentModule)) unmarkCompleted(currentModule);
      resultEl.classList.add("fail");
      resultEl.textContent = `${score}/${total} - Not quite. Try again!`;
      submitBtn.textContent = "Try Again";
      submitBtn.dataset.action = "retry";
    }
  });
})();

/* End-of-beginner-flow "Go to Expert mode" button */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("upgrade-to-expert");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const toggle = document.getElementById("expert-toggle");
    // Only flip if we're in beginner mode - clicking from expert would silently downgrade.
    if (toggle && !document.body.classList.contains("expert")) toggle.click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

/* Hero stat counter animation (count up from 0 on first view) */
document.addEventListener("DOMContentLoaded", () => {
  const els = document.querySelectorAll(".hero-stat-value[data-target]");
  if (!els.length) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const formatNum = (n, fmt) => fmt === "comma" ? Math.round(n).toLocaleString("en-US") : String(Math.round(n));

  const runCounter = (el) => {
    if (el.dataset.done === "1") return;
    el.dataset.done = "1";
    const target = parseFloat(el.dataset.target) || 0;
    const suffix = el.dataset.suffix || "";
    const fmt = el.dataset.format;
    if (reduceMotion) { el.textContent = formatNum(target, fmt) + suffix; return; }

    const duration = 1800;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = formatNum(target * easeOut(t), fmt) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (!("IntersectionObserver" in window)) { els.forEach(runCounter); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { runCounter(entry.target); io.unobserve(entry.target); }
    });
  }, { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
});
