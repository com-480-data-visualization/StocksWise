/* ══════════════════════════════════════════════
   StockWise — Main JS
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
   QUIZ
   ══════════════════════════════════════════════ */
const quizData = [
  {
    q: "What does a stock represent?",
    options: [
      "A loan you give to a company",
      "A piece of ownership in a company",
      "A government bond",
      "A type of savings account",
    ],
    answer: 1,
  },
  {
    q: "What is the main advantage of an ETF over a single stock?",
    options: [
      "ETFs are always cheaper",
      "ETFs never lose value",
      "ETFs provide diversification",
      "ETFs pay higher dividends",
    ],
    answer: 2,
  },
  {
    q: "What does the Sharpe ratio measure?",
    options: [
      "The total return of a stock",
      "The volatility of a stock",
      "Return per unit of risk",
      "The daily trading volume",
    ],
    answer: 2,
  },
  {
    q: "If a stock's price drops 50%, how much must it rise to recover?",
    options: ["50%", "75%", "100%", "200%"],
    answer: 2,
  },
  {
    q: "What does 'Adj Close' account for?",
    options: [
      "Inflation",
      "Stock splits and dividends",
      "Broker fees",
      "Currency conversion",
    ],
    answer: 1,
  },
];

function buildQuiz() {
  const container = document.getElementById("quiz-body");
  if (!container) return;

  let html = "";
  quizData.forEach((item, i) => {
    html += `<div class="quiz-question" data-correct="${item.answer}">
      <p>${i + 1}. ${item.q}</p>
      <div class="quiz-options">`;
    item.options.forEach((opt, j) => {
      html += `<label>
        <input type="radio" name="q${i}" value="${j}">
        ${opt}
      </label>`;
    });
    html += `</div></div>`;
  });
  html += `<button id="quiz-submit">Check Answers</button>`;
  container.innerHTML = html;

  document.getElementById("quiz-submit").addEventListener("click", evaluateQuiz);
}

function evaluateQuiz() {
  const questions = document.querySelectorAll(".quiz-question");
  let score = 0;

  questions.forEach((qEl) => {
    const correct = parseInt(qEl.dataset.correct, 10);
    const labels = qEl.querySelectorAll("label");
    const selected = qEl.querySelector("input:checked");

    labels.forEach((label, idx) => {
      label.querySelector("input").disabled = true;
      if (idx === correct) {
        label.classList.add("correct");
      } else if (selected && parseInt(selected.value, 10) === idx) {
        label.classList.add("wrong");
      }
    });

    if (selected && parseInt(selected.value, 10) === correct) {
      score++;
    }
  });

  document.getElementById("quiz-submit").disabled = true;

  const resultEl = document.getElementById("quiz-result");
  const titleEl = document.getElementById("result-title");
  const textEl = document.getElementById("result-text");

  const pct = Math.round((score / quizData.length) * 100);
  let profile, msg;
  if (pct >= 80) {
    profile = "Growth Investor";
    msg =
      "Solid understanding of the fundamentals — you're ready to explore individual stocks and more advanced strategies.";
  } else if (pct >= 50) {
    profile = "Balanced Investor";
    msg =
      "Good base! A mix of ETFs and blue-chip stocks would suit your current knowledge. Keep learning!";
  } else {
    profile = "Conservative Investor";
    msg =
      "No worries — everyone starts somewhere. Index ETFs are a great first step while you build your knowledge.";
  }

  titleEl.textContent = `${score}/${quizData.length} — ${profile}`;
  textEl.textContent = msg;
  resultEl.classList.remove("hidden");
}

buildQuiz();
