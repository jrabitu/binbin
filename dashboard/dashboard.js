const API_BASE = "http://127.0.0.1:8080";

const binLabels = {
  plastic: "Хуванцар",
  paper: "Цаас",
  can: "Лааз",
  general: "Бусад",
};

const CLASS_LABELS_MN = {
  paper: "Цаас",
  pet_bottle: "PET хуванцар сав",
  can: "Лааз",
  carton_box: "Картон хайрцаг",
  cup_container: "Аяга",
  food_waste: "Эко хаягдал",
  glass: "Шил",
  others: "Бусад",
  plastic_other: "Хуванцар",
  wrapper: "Уут, боодол",
  electronics: "Электрон хог",
  batteries: "Батерей",
  fabric_napkins: "Даавуун материал",
};

const STATUS_LABELS_MN = {
  success: "Амжилттай",
  detected: "Илэрсэн",
  confirmation_required: "Баталгаажуулах",
  unsupported: "Дэмжигдээгүй",
  multiple_items: "Олон объект",
  no_detection: "Илрээгүй",
  bin_not_found: "Сав олдсонгүй",
};

const BIN_COLORS = {
  plastic: { accent: "#5b9dff", bg: "rgba(91,157,255,0.12)" },
  paper: { accent: "#24c07d", bg: "rgba(36,192,125,0.12)" },
  can: { accent: "#f5b041", bg: "rgba(245,176,65,0.12)" },
  general: { accent: "#9ba8bb", bg: "rgba(155,168,187,0.12)" },
};

let allLogs = [];
let allEvents = [];
let allTrashcans = [];
let binChart = null;
let statusChart = null;

async function fetchJson(url) {
  const res = await fetch(url);
  const result = await res.json();

  if (!result.success) {
    console.warn("API returned error:", result);
  }

  return result.data || [];
}

function formatTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function getConfLevel(confPct) {
  if (confPct >= 90) return { label: "Өндөр", color: "#24c07d" };
  if (confPct >= 75) return { label: "Дунд", color: "#f5b041" };
  return { label: "Бага", color: "#ef5b65" };
}

function createStatusBadge(status) {
  const label = STATUS_LABELS_MN[status] || status || "—";
  return `<span class="status-badge status-${status}">${label}</span>`;
}

async function loadSummary() {
  const data = await fetchJson(`${API_BASE}/dashboard/summary`);

  document.getElementById("totalDetections").textContent = data.total_detections ?? 0;
  document.getElementById("todayDetections").textContent = data.today_detections ?? 0;
  document.getElementById("successfulSorts").textContent = data.successful_sorts ?? 0;
  document.getElementById("totalEvents").textContent = data.total_events ?? 0;

  const rate = data.total_detections > 0
    ? Math.round((data.successful_sorts / data.total_detections) * 100)
    : 0;

  const rateEl = document.getElementById("successRateText");
  if (rateEl) rateEl.textContent = `${rate}% амжилтын хувь`;

  const confEl = document.getElementById("avgConfidence");
  if (confEl) confEl.textContent = `${data.avg_confidence ?? 0}%`;

  return data;
}

async function loadFeedbackSummary() {
  const data = await fetchJson(`${API_BASE}/dashboard/feedback-summary`);

  const total = data.total_feedback ?? 0;
  const correct = data.correct_count ?? 0;
  const corrected = data.corrected_count ?? 0;
  const acc = total > 0 ? Math.round((correct / total) * 100) : 0;

  document.getElementById("feedbackSummary").textContent = `${acc}%`;
  document.getElementById("feedbackSubText").textContent = `${correct} зөв / ${corrected} зассан`;
}

async function loadTrashcans() {
  allTrashcans = await fetchJson(`${API_BASE}/dashboard/trashcans`);

  const container = document.getElementById("trashcanGrid");
  if (!container) return;

  container.innerHTML = "";

  allTrashcans.forEach(trashcan => {
    const fill = Number(trashcan.avg_fill_level || 0);
    const isLive = Number(trashcan.is_real_device) === 1 || trashcan.is_real_device === true;

    const card = document.createElement("div");
    card.className = `fleet-card ${isLive ? "live" : ""}`;

    card.innerHTML = `
      <div class="fleet-top">
        <h4>${trashcan.trashcan_name}</h4>
        <span class="${isLive ? "live-tag" : "sim-tag"}">
          ${isLive ? "Live" : "Sim"}
        </span>
      </div>

      <p>${trashcan.location || "Байршил тодорхойгүй"}</p>

      <div class="fleet-meta">
        <span>Нийт хаягдал: ${trashcan.total_items ?? 0}</span>
        <span>Дундаж дүүргэлт: ${fill}%</span>
        <span>Төлөв: ${trashcan.status || "—"}</span>
      </div>

      <div class="fill-bar-wrap">
        <div class="fill-bar-track">
          <div class="fill-bar-fill" style="width:${fill}%;background:${getFillColor(fill)}"></div>
        </div>
        <span class="fill-label">${fill}%</span>
      </div>
    `;

    card.addEventListener("click", () => openTrashcanDetail(trashcan.id));
    container.appendChild(card);
  });
}

function getFillColor(fill) {
  if (fill >= 90) return "#ef5b65";
  if (fill >= 75) return "#f5b041";
  return "#24c07d";
}

async function openTrashcanDetail(trashcanId) {
  const data = await fetchJson(`${API_BASE}/dashboard/trashcans/${trashcanId}`);

  if (!data || !data.trashcan) return;

  document.getElementById("trashcanDetailPanel").classList.remove("hidden");

  document.getElementById("detailTrashcanName").textContent = data.trashcan.trashcan_name;
  document.getElementById("detailTrashcanLocation").textContent =
    `${data.trashcan.location || "Байршил тодорхойгүй"} · ${data.trashcan.is_real_device ? "Live prototype" : "Simulation"}`;

  renderDetailBins(data.bins || []);
  renderDetailLogs(data.logs || []);
  renderDetailEvents(data.events || []);

  document.getElementById("trashcanDetailPanel").scrollIntoView({ behavior: "smooth" });
}

function renderDetailBins(bins) {
  const container = document.getElementById("detailBinGrid");
  container.innerHTML = "";

  bins.forEach(bin => {
    const c = BIN_COLORS[bin.bin_type] || BIN_COLORS.general;
    const fill = Number(bin.current_fill_level || 0);

    const box = document.createElement("div");
    box.className = "bin-box";
    box.style.cssText = `border-color:${c.accent}40;border-left:4px solid ${c.accent};background:${c.bg};`;

    box.innerHTML = `
      <div class="bin-box-top">
        <h4>${bin.bin_name || binLabels[bin.bin_type] || bin.bin_type}</h4>
        <span class="bin-type-tag" style="color:${c.accent};background:${c.accent}22">
          ${binLabels[bin.bin_type] || bin.bin_type}
        </span>
      </div>

      <div class="bin-count">${bin.item_count ?? 0}</div>
      <div class="bin-location">${bin.location || "—"} · ${bin.status || "—"}</div>

      <div class="fill-bar-wrap">
        <div class="fill-bar-track">
          <div class="fill-bar-fill" style="width:${fill}%;background:${getFillColor(fill)}"></div>
        </div>
        <span class="fill-label">${fill}%</span>
      </div>
    `;

    container.appendChild(box);
  });
}

function renderDetailLogs(logs) {
  const tbody = document.getElementById("detailLogsBody");
  tbody.innerHTML = "";

  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="5">Бүртгэл байхгүй</td></tr>`;
    return;
  }

  logs.forEach(log => {
    const cls = log.final_class || log.detected_class || "—";
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${log.id}</td>
      <td>${CLASS_LABELS_MN[cls] || cls}</td>
      <td>${binLabels[log.final_bin_type] || log.final_bin_type || "—"}</td>
      <td>${createStatusBadge(log.detection_status)}</td>
      <td>${formatTs(log.created_at)}</td>
    `;

    tbody.appendChild(row);
  });
}

function renderDetailEvents(events) {
  const tbody = document.getElementById("detailEventsBody");
  tbody.innerHTML = "";

  if (!events.length) {
    tbody.innerHTML = `<tr><td colspan="4">Үйл явдал байхгүй</td></tr>`;
    return;
  }

  events.forEach(event => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${event.id}</td>
      <td>${event.event_type}</td>
      <td>${event.event_message}</td>
      <td>${formatTs(event.created_at)}</td>
    `;

    tbody.appendChild(row);
  });
}

async function loadBinStats() {
  const bins = await fetchJson(`${API_BASE}/dashboard/bin-stats`);
  const container = document.getElementById("binStatsGrid");

  container.innerHTML = "";

  const realBins = bins.filter(b => Number(b.trashcan_id) === 1);

  realBins.forEach(bin => {
    const c = BIN_COLORS[bin.bin_type] || BIN_COLORS.general;
    const fill = Number(bin.current_fill_level || 0);

    const box = document.createElement("div");
    box.className = "bin-box";
    box.style.cssText = `border-color:${c.accent}30;border-left:3px solid ${c.accent};background:${c.bg};`;

    box.innerHTML = `
      <div class="bin-box-top">
        <h4>${bin.bin_name || binLabels[bin.bin_type] || bin.bin_type}</h4>
        <span class="bin-type-tag" style="color:${c.accent};background:${c.accent}22">
          ${binLabels[bin.bin_type] || bin.bin_type}
        </span>
      </div>

      <div class="bin-count">${bin.item_count ?? 0}</div>
      <div class="bin-location">${bin.trashcan_name || ""} · ${bin.location || "—"}</div>

      <div class="fill-bar-wrap">
        <div class="fill-bar-track">
          <div class="fill-bar-fill" style="width:${fill}%;background:${getFillColor(fill)}"></div>
        </div>
        <span class="fill-label">${fill}%</span>
      </div>
    `;

    container.appendChild(box);
  });

  return realBins;
}

function renderCharts(bins, summary) {
  const binCtx = document.getElementById("binDistChart")?.getContext("2d");

  if (binCtx) {
    const data = bins.filter(b => (b.item_count ?? 0) > 0);

    if (binChart) binChart.destroy();

    binChart = new Chart(binCtx, {
      type: "bar",
      data: {
        labels: data.map(b => binLabels[b.bin_type] || b.bin_type),
        datasets: [{
          data: data.map(b => b.item_count),
          backgroundColor: data.map(b => (BIN_COLORS[b.bin_type] || BIN_COLORS.general).accent),
          borderRadius: 6,
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: { color: "#aab9cc" },
            beginAtZero: true,
          },
          y: {
            grid: { display: false },
            ticks: { color: "#eef4fb" },
          },
        },
      },
    });
  }

  const statusCtx = document.getElementById("statusChart")?.getContext("2d");

  if (statusCtx) {
    const breakdown = summary.status_breakdown || {};
    const keys = ["success", "detected", "confirmation_required", "unsupported", "multiple_items", "no_detection"];
    const colors = ["#24c07d", "#24c07d", "#f5b041", "#ef5b65", "#f5b041", "#9ba8bb"];
    const active = keys.filter(k => (breakdown[k] || 0) > 0);

    if (statusChart) statusChart.destroy();

    statusChart = new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: active.map(k => STATUS_LABELS_MN[k] || k),
        datasets: [{
          data: active.map(k => breakdown[k]),
          backgroundColor: active.map(k => colors[keys.indexOf(k)]),
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "64%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#aab9cc", padding: 14 },
          },
        },
      },
    });
  }
}

function getFilteredLogs() {
  const status = document.getElementById("logStatusFilter").value;
  const bin = document.getElementById("logBinFilter").value;
  const sort = document.getElementById("logSortField").value;

  let logs = [...allLogs];

  if (status !== "all") logs = logs.filter(l => l.detection_status === status);
  if (bin !== "all") logs = logs.filter(l => l.final_bin_type === bin);

  logs.sort((a, b) => {
    if (sort === "confidence") {
      return Number(b.final_confidence || b.confidence || 0) - Number(a.final_confidence || a.confidence || 0);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return logs;
}

function renderLogs() {
  const logs = getFilteredLogs();
  const tbody = document.getElementById("logsTableBody");

  tbody.innerHTML = "";

  logs.forEach(log => {
    const cls = log.final_class || log.detected_class || "—";
    const conf = Number(log.final_confidence || log.confidence || 0);
    const confPct = Math.round(conf * 100);
    const confLvl = getConfLevel(confPct);

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${log.id}</td>
      <td>${CLASS_LABELS_MN[cls] || cls}</td>
      <td>
        <div class="conf-cell">
          <span style="color:${confLvl.color};font-weight:700">${confPct}%</span>
          <div class="conf-bar-track">
            <div class="conf-bar-fill" style="width:${confPct}%;background:${confLvl.color}"></div>
          </div>
        </div>
      </td>
      <td>${binLabels[log.final_bin_type] || log.final_bin_type || "—"}</td>
      <td>${createStatusBadge(log.detection_status)}</td>
      <td>${formatTs(log.created_at)}</td>
    `;

    tbody.appendChild(row);
  });
}

async function loadLogs() {
  allLogs = await fetchJson(`${API_BASE}/dashboard/logs`);
  renderLogs();
}

function getFilteredEvents() {
  const type = document.getElementById("eventTypeFilter").value;

  let events = [...allEvents];

  if (type !== "all") {
    events = events.filter(e => e.event_type === type);
  }

  return events;
}

function renderEvents() {
  const events = getFilteredEvents();
  const tbody = document.getElementById("eventsTableBody");

  tbody.innerHTML = "";

  events.forEach(event => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${event.id}</td>
      <td>${event.event_type}</td>
      <td>${event.event_message}</td>
      <td>${event.related_detection_id ?? "—"}</td>
      <td>${formatTs(event.created_at)}</td>
    `;

    tbody.appendChild(row);
  });
}

async function loadEvents() {
  allEvents = await fetchJson(`${API_BASE}/dashboard/events`);
  renderEvents();
}

function exportCsv(filename, rows, headers) {
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(k => `"${r[k] ?? ""}"`).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function exportFilteredLogsCsv() {
  exportCsv(
    "monbin_detection_logs.csv",
    getFilteredLogs(),
    ["id", "final_class", "final_confidence", "final_bin_type", "detection_status", "created_at"]
  );
}

function exportFilteredEventsCsv() {
  exportCsv(
    "monbin_system_events.csv",
    getFilteredEvents(),
    ["id", "event_type", "event_message", "related_detection_id", "created_at"]
  );
}

async function loadDashboard() {
  try {
    const [summary, , , bins] = await Promise.all([
      loadSummary(),
      loadFeedbackSummary(),
      loadTrashcans(),
      loadBinStats(),
      loadLogs(),
      loadEvents(),
    ]);

    if (summary && bins) {
      renderCharts(bins, summary);
    }
  } catch (err) {
    console.error("Dashboard load failed:", err);
  }
}

document.getElementById("refreshBtn")?.addEventListener("click", loadDashboard);
document.getElementById("exportBtn")?.addEventListener("click", exportFilteredLogsCsv);
document.getElementById("exportLogsBtn")?.addEventListener("click", exportFilteredLogsCsv);
document.getElementById("exportEventsBtn")?.addEventListener("click", exportFilteredEventsCsv);

document.getElementById("logStatusFilter")?.addEventListener("change", renderLogs);
document.getElementById("logBinFilter")?.addEventListener("change", renderLogs);
document.getElementById("logSortField")?.addEventListener("change", renderLogs);
document.getElementById("eventTypeFilter")?.addEventListener("change", renderEvents);

document.getElementById("closeTrashcanDetailBtn")?.addEventListener("click", () => {
  document.getElementById("trashcanDetailPanel")?.classList.add("hidden");
  document.getElementById("fleet")?.scrollIntoView({ behavior: "smooth" });
});

window.addEventListener("DOMContentLoaded", loadDashboard);