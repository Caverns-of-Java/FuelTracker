// ── Configuration ──────────────────────────────────────────────────────────
// After deploying your Apps Script as a Web App, replace the placeholder below
// with your actual /exec URL.
var API_URL = "https://script.google.com/macros/s/AKfycbzxzcuLjOfgR2D1A2KcjFHZ3N7nxsGZSFGcTLe6iosmuXvGuwjJB3lVUstoKagvT64YBQ/exec";

// ── Safe formula evaluator ─────────────────────────────────────────────────
// Accepts expressions containing only digits, +, -, *, /, (, ), ., and spaces.
// No identifiers or strings can pass the whitelist, so Function() is safe here.
function evaluateFormula(str) {
  var sanitized = str.trim();
  if (!/^[\d+\-*/().\s]+$/.test(sanitized)) {
    throw new Error("Formula contains invalid characters. Only numbers and + - * / ( ) are allowed.");
  }
  var result;
  try {
    // eslint-disable-next-line no-new-func
    result = Function('"use strict"; return (' + sanitized + ')')();
  } catch (e) {
    throw new Error("Could not evaluate: " + sanitized);
  }
  if (typeof result !== "number" || !isFinite(result)) {
    throw new Error("Formula did not produce a valid number.");
  }
  return result;
}

// ── Error display ──────────────────────────────────────────────────────────
function showError(msg) {
  var el = document.getElementById("form-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearError() {
  var el = document.getElementById("form-error");
  el.textContent = "";
  el.classList.add("hidden");
}

// ── Render functions ───────────────────────────────────────────────────────
function formatMetric(value, decimals) {
  if (value === null || value === undefined || value === "" || isNaN(value)) {
    return "--";
  }
  return Number(value).toFixed(decimals);
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "" || isNaN(value)) {
    return null;
  }
  var parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTrend(currentValue, previousValue, direction) {
  var current = toFiniteNumber(currentValue);
  var previous = toFiniteNumber(previousValue);
  if (current === null || previous === null) return "neutral";

  if (current === previous) return "neutral";

  if (direction === "lower") {
    return current < previous ? "improved" : "worsened";
  }

  return current > previous ? "improved" : "worsened";
}

function applyTrendClass(el, currentValue, previousValue, direction) {
  if (!el) return;
  el.classList.remove("metric-improved", "metric-worsened");

  var trend = getTrend(currentValue, previousValue, direction);
  if (trend === "improved") {
    el.classList.add("metric-improved");
  } else if (trend === "worsened") {
    el.classList.add("metric-worsened");
  }
}

function renderLatest(metrics) {
  document.getElementById("latest-cpk").textContent = formatMetric(metrics.latestCostPerKm, 4);
  document.getElementById("latest-eff").textContent = formatMetric(metrics.latestEfficiencyLPerKm, 4);
  document.getElementById("latest-ppl").textContent = formatMetric(metrics.latestPricePerLitre, 4);

  applyTrendClass(document.getElementById("tile-cpk"), metrics.latestCostPerKm, metrics.previousCostPerKm, "lower");
  applyTrendClass(document.getElementById("tile-eff"), metrics.latestEfficiencyLPerKm, metrics.previousEfficiencyLPerKm, "higher");
  applyTrendClass(document.getElementById("tile-ppl"), metrics.latestPricePerLitre, metrics.previousPricePerLitre, "lower");
}

function renderHistory(entries) {
  var list = document.getElementById("history-list");
  list.innerHTML = "";

  if (!entries || entries.length === 0) {
    var empty = document.createElement("li");
    empty.className = "no-data";
    empty.textContent = "No history yet.";
    list.appendChild(empty);
    return;
  }

  entries.forEach(function (entry, index) {
    var previousEntry = entries[index + 1];

    var li = document.createElement("li");
    li.className = "history-item";

    var dateSpan = document.createElement("span");
    dateSpan.className = "entry-date";
    dateSpan.textContent = entry.date;

    var valuesWrap = document.createElement("div");
    valuesWrap.className = "entry-metrics";

    var cpkSpan = document.createElement("span");
    cpkSpan.className = "entry-metric";
    cpkSpan.textContent = "CPK: " + formatMetric(entry.costPerKm, 4) + " $/km";
    applyTrendClass(cpkSpan, entry.costPerKm, previousEntry ? previousEntry.costPerKm : null, "lower");

    var effSpan = document.createElement("span");
    effSpan.className = "entry-metric";
    effSpan.textContent = "Eff: " + formatMetric(entry.efficiencyLPerKm, 4) + " L/km";
    applyTrendClass(effSpan, entry.efficiencyLPerKm, previousEntry ? previousEntry.efficiencyLPerKm : null, "higher");

    var pplSpan = document.createElement("span");
    pplSpan.className = "entry-metric";
    pplSpan.textContent = "PPL: " + formatMetric(entry.pricePerLitre, 4) + " $/L";
    applyTrendClass(pplSpan, entry.pricePerLitre, previousEntry ? previousEntry.pricePerLitre : null, "lower");

    li.appendChild(dateSpan);
    valuesWrap.appendChild(cpkSpan);
    valuesWrap.appendChild(effSpan);
    valuesWrap.appendChild(pplSpan);
    li.appendChild(valuesWrap);
    list.appendChild(li);
  });
}

// ── Load data ──────────────────────────────────────────────────────────────
function loadData() {
  fetch(API_URL + "?mode=latest")
    .then(function (res) {
      if (!res.ok) throw new Error("Server returned " + res.status);
      return res.json();
    })
    .then(function (data) {
      renderLatest(data);
      renderHistory(data.history);
    })
    .catch(function () {
      var list = document.getElementById("history-list");
      list.innerHTML = '<li class="no-data">Failed to load data. Check your API URL or network.</li>';
      document.getElementById("latest-cpk").textContent = "--";
      document.getElementById("latest-eff").textContent = "--";
      document.getElementById("latest-ppl").textContent = "--";
    });
}

// ── PWA ───────────────────────────────────────────────────────────────────
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {
      // Keep app functional even if service worker registration fails.
    });
  }
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal() {
  var today = new Date();
  var yyyy = today.getFullYear();
  var mm = String(today.getMonth() + 1).padStart(2, "0");
  var dd = String(today.getDate()).padStart(2, "0");
  document.getElementById("field-date").value = yyyy + "-" + mm + "-" + dd;

  clearError();
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("field-fuel-cost").focus();
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("entry-form").reset();
  clearError();
}

// ── Form submit ────────────────────────────────────────────────────────────
function handleSubmit(event) {
  event.preventDefault();
  clearError();

  var dateVal     = document.getElementById("field-date").value.trim();
  var fuelCostStr = document.getElementById("field-fuel-cost").value.trim();
  var odometerVal = document.getElementById("field-odometer").value.trim();
  var litresVal   = document.getElementById("field-litres").value.trim();

  if (!dateVal)     { showError("Date is required.");           return; }
  if (!fuelCostStr) { showError("Fuel cost is required.");      return; }
  if (!odometerVal) { showError("Odometer is required.");       return; }
  if (!litresVal)   { showError("Litres filled is required.");  return; }

  var fuelCost;
  try {
    fuelCost = evaluateFormula(fuelCostStr);
    if (fuelCost <= 0) throw new Error("Fuel cost must be greater than 0.");
  } catch (e) {
    showError(e.message);
    return;
  }

  var odometer = Number(odometerVal);
  if (!Number.isFinite(odometer) || odometer <= 0) {
    showError("Odometer must be a positive number.");
    return;
  }

  var litresFilled = Number(litresVal);
  if (!Number.isFinite(litresFilled) || litresFilled <= 0 || litresFilled > 50) {
    showError("Litres filled must be between 0.1 and 50.");
    return;
  }

  var submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  // Content-Type: text/plain avoids a CORS preflight on the Apps Script endpoint.
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      date: dateVal,
      fuelCost: fuelCost,
      odometer: odometer,
      litresFilled: litresFilled
    })
  })
    .then(function (res) {
      if (!res.ok) throw new Error("Server returned " + res.status);
      return res.json();
    })
    .then(function (data) {
      if (data.status !== "ok") throw new Error("Unexpected server response.");
      closeModal();
      window.location.reload();
    })
    .catch(function (err) {
      showError("Failed to save: " + err.message);
    })
    .finally(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save";
    });
}

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  loadData();
  registerServiceWorker();
  document.getElementById("add-btn").addEventListener("click", openModal);
  document.getElementById("cancel-btn").addEventListener("click", closeModal);
  document.getElementById("entry-form").addEventListener("submit", handleSubmit);
  document.querySelector(".modal-backdrop").addEventListener("click", closeModal);
}

document.addEventListener("DOMContentLoaded", init);
