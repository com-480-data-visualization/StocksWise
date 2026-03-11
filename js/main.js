/* ══════════════════════════════════════════════
   StocksWise — Main JS
   ══════════════════════════════════════════════ */

/* ── Theme Toggle ── */
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

/* ── Ticker Tape ── */
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
    <div class="ticker-item">
      <span class="ticker-symbol">${t.symbol}</span>
      <span class="ticker-price">$${t.price}</span>
      <span class="ticker-change ${t.up ? "up" : "down"}">${t.change}</span>
    </div>`
    )
    .join("");
})();

/* ── Mobile nav toggle ── */
(function initNavToggle() {
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    links.classList.toggle("open");
  });

  // Close on link click
  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => links.classList.remove("open"));
  });
})();

/* ── Scroll-spy: highlight active nav link ── */
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

/* ── Scroll reveal animation ── */
(function initReveal() {
  const reveals = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );

  reveals.forEach((el) => observer.observe(el));
})();

/* ── Mouse-following glow ── */
(function initGlow() {
  document.querySelectorAll(".topic-section").forEach((section) => {
    const glow = section.querySelector(".section-glow");
    if (!glow) return;

    section.addEventListener("mousemove", (e) => {
      const rect = section.getBoundingClientRect();
      glow.style.left = (e.clientX - rect.left) + "px";
      glow.style.top = (e.clientY - rect.top) + "px";
    });
  });
})();

/* ── Nav background on scroll ── */
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

/* ══════════════════════════════════════════════
   PER-MODULE QUIZZES (popup modals)
   ══════════════════════════════════════════════ */
(function initModuleQuizzes() {
  const moduleQuizzes = {
    stocks: {
      title: "Stocks — Module Quiz",
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
      title: "ETFs — Module Quiz",
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
      title: "Risks — Module Quiz",
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
      title: "Simulation — Module Quiz",
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

  // Restore completed modules from localStorage
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
  function updateUI(mod) {
    const badge = document.getElementById("badge-" + mod);
    if (badge) { badge.textContent = "Completed"; badge.classList.add("show"); }
    const btn = document.querySelector(`.btn-quiz[data-module="${mod}"]`);
    if (btn) { btn.textContent = "Completed"; btn.classList.add("completed"); }
  }

  // Restore on load
  getCompleted().forEach(updateUI);

  // Open modal
  document.querySelectorAll(".btn-quiz").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mod = btn.dataset.module;
      if (getCompleted().includes(mod)) return;
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

  // Evaluate
  submitBtn.addEventListener("click", () => {
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

    submitBtn.disabled = true;
    const total = questions.length;
    const passed = score === total;

    resultEl.classList.remove("hidden", "fail");
    if (passed) {
      resultEl.textContent = `${score}/${total} — Module completed!`;
      markCompleted(currentModule);
    } else {
      resultEl.classList.add("fail");
      resultEl.textContent = `${score}/${total} — Not quite! Close and try again.`;
    }
  });
})();
