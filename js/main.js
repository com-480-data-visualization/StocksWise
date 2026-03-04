/* ── Scroll-spy: highlight active nav link ── */
const sections = document.querySelectorAll(".topic-section");
const navLinks = document.querySelectorAll("#topnav ul a");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
      }
    });
  },
  { rootMargin: `-${getComputedStyle(document.documentElement).getPropertyValue("--nav-h")} 0px -60% 0px`, threshold: 0 }
);

sections.forEach((s) => observer.observe(s));

/* ── Quiz ── */
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
    msg = "Solid understanding of the fundamentals — you're ready to explore individual stocks and more advanced strategies.";
  } else if (pct >= 50) {
    profile = "Balanced Investor";
    msg = "Good base! A mix of ETFs and blue-chip stocks would suit your current knowledge. Keep learning!";
  } else {
    profile = "Conservative Investor";
    msg = "No worries — everyone starts somewhere. Index ETFs are a great first step while you build your knowledge.";
  }

  titleEl.textContent = `${score}/${quizData.length} — ${profile}`;
  textEl.textContent = msg;
  resultEl.classList.remove("hidden");
}

buildQuiz();
