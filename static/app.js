"use strict";

const emotions = {
  sadness: { name: "Sadness", icon: "😢", color: "#3c75ac", tint: "#edf3fb" },
  joy: { name: "Joy", icon: "😄", color: "#b67a16", tint: "#fff3d9" },
  love: { name: "Love", icon: "❤️", color: "#ba507c", tint: "#fbeaf1" },
  anger: { name: "Anger", icon: "😠", color: "#bc503d", tint: "#fcece7" },
  fear: { name: "Fear", icon: "😨", color: "#7860ad", tint: "#f1ecfa" },
  surprise: { name: "Surprise", icon: "😲", color: "#227e79", tint: "#e3f4f0" },
};

const form = document.getElementById("sentence-form");
const sentence = document.getElementById("sentence");
const analyze = document.getElementById("analyze");
const errorBox = document.getElementById("error");
const report = document.querySelector(".report");
const shortcut = document.getElementById("shortcut");
let ready = false;
let busy = false;
let retryTimer;
let tokenLimit = null;

if (/Mac|iPhone|iPad/.test(navigator.platform)) shortcut.textContent = "⌘ + Enter";

function updateForm() {
  document.getElementById("char-count").textContent =
    sentence.value.length.toLocaleString("en-US") + " / 2,000";
  analyze.disabled = busy || !ready || !sentence.value.trim();
  analyze.textContent = busy ? "Analyzing…" : "Analyze emotion";
}

function setService(mode, message) {
  ready = mode === "online";
  document.getElementById("service").dataset.mode = mode;
  document.getElementById("service-text").textContent = message;
  updateForm();
}

async function checkModel() {
  window.clearTimeout(retryTimer);
  try {
    const response = await fetch("/health", { cache: "no-store" });
    const health = await response.json();
    if (response.ok && health.model_loaded) {
      setService("online", "Model online");
      if (tokenLimit !== health.max_tokens) {
        tokenLimit = health.max_tokens;
        renderWindow(tokenLimit);
      }
      return;
    }
    setService("offline", "Model unavailable");
  } catch {
    setService("offline", "Server offline");
  }
  retryTimer = window.setTimeout(checkModel, 4000);
}

function renderWindow(limit, used = null, total = null) {
  document.getElementById("token-limit").textContent = limit + " slots";
  const cells = document.createDocumentFragment();
  for (let i = 0; i < limit; i++) {
    const cell = document.createElement("i");
    if (used !== null && i < used) cell.className = "filled";
    cells.append(cell);
  }
  document.getElementById("token-strip").replaceChildren(cells);
  if (used === null) return;

  const note = document.getElementById("token-note");
  if (total > limit) {
    note.textContent = `Used the first ${limit} of ${total} tokens. Trimmed ${total - limit} from the end.`;
  } else {
    note.textContent = `Used ${used} of ${limit} slots. Added ${limit - used} padding zeros at the end.`;
  }
}

function percent(value) {
  if (value > 0 && value < 0.001) return "<0.1%";
  return (value * 100).toFixed(1) + "%";
}

function renderScores(probabilities = null) {
  const labels = Object.keys(emotions);
  if (probabilities) labels.sort((a, b) => probabilities[b] - probabilities[a]);
  const rows = document.createDocumentFragment();
  const template = document.getElementById("score-template");
  for (const label of labels) {
    const row = template.content.firstElementChild.cloneNode(true);
    const style = emotions[label];
    row.style.setProperty("--bar", style.color);
    row.querySelector(".name").textContent = style.name;
    row.querySelector(".score-value").textContent = probabilities ? percent(probabilities[label]) : "—";
    row.querySelector(".fill").style.width = probabilities ? probabilities[label] * 100 + "%" : "0%";
    if (probabilities && label === labels[0]) row.classList.add("leading");
    rows.append(row);
  }
  document.getElementById("scores").replaceChildren(rows);
}

function renderPrediction(data) {
  const style = emotions[data.predicted_emotion];
  const confidence = percent(data.confidence) + " confidence";
  report.style.setProperty("--tone", style.color);
  report.style.setProperty("--wash", style.tint);
  document.getElementById("signal-icon").textContent = style.icon;
  document.getElementById("top-emotion").textContent = style.name;
  document.getElementById("confidence").textContent = confidence;
  const quote = document.getElementById("submitted-text");
  quote.textContent = "“" + data.text + "”";
  quote.hidden = false;
  renderScores(data.probabilities);
  renderWindow(data.max_tokens, data.tokens_used, data.token_count);
  document.getElementById("announcement").textContent = style.name + ", " + confidence + ".";
  if (window.matchMedia("(max-width: 740px)").matches) {
    report.scrollIntoView({ block: "start", behavior: "instant" });
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = sentence.value.trim();
  if (!text || !ready || busy) return;
  busy = true;
  updateForm();
  errorBox.hidden = true;
  report.setAttribute("aria-busy", "true");
  try {
    const response = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      if (response.status === 503) await checkModel();
      const problem = await response.json().catch(() => ({}));
      throw new Error(typeof problem.detail === "string"
        ? problem.detail : "The sentence could not be analyzed. Check your text and try again.");
    }
    renderPrediction(await response.json());
  } catch (error) {
    if (error instanceof TypeError) {
      setService("offline", "Server offline");
      checkModel();
      errorBox.textContent = "Could not reach the local server. Check the terminal and try again.";
    } else {
      errorBox.textContent = error.message;
    }
    errorBox.hidden = false;
  } finally {
    busy = false;
    report.removeAttribute("aria-busy");
    updateForm();
  }
});

sentence.addEventListener("input", () => {
  errorBox.hidden = true;
  updateForm();
});
sentence.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    form.requestSubmit();
  }
});
for (const button of document.querySelectorAll("[data-example]")) {
  button.addEventListener("click", () => {
    sentence.value = button.dataset.example;
    sentence.dispatchEvent(new Event("input"));
    sentence.focus();
  });
}

renderScores();
checkModel();
