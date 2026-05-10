const API_BASE = "http://127.0.0.1:8080";

const binLabels = {
  plastic: "Хуванцар",
  paper:   "Цаас",
  can:     "Лааз",
  general: "Бусад",
};


const CLASS_LABELS_MN = {
  paper:         "Цаас",
  pet_bottle:    "PET хуванцар сав",
  can:           "Лааз",
  carton_box:    "Картон хайрцаг",
  cup_container: "Аяга",
  food_waste:    "Эко хаягдал",
  glass:         "Шил",
  others:        "Бусад",
  plastic_other: "Хуванцар",
  wrapper:       "Уут, боодол",
  electronics:   "Электрон хог хаягдал",
  batteries:     "Батерей",
};


const STATUS_LABELS_MN = {
  detected:       "Илэрсэн",
  unsupported:    "Дэмжигдээгүй",
  multiple_items: "Олон объект илэрсэн",
  no_detection:   "Илрээгүй",
  bin_not_found:  "Сав олдсонгүй",
};

// Итгэлцлийн түвшин тодорхойлох
function getConfLevel(confPct) {
  if (confPct >= 90) return { label: "Өндөр", color: "#24c07d" };
  if (confPct >= 75) return { label: "Дунд",  color: "#f5b041" };
  return                    { label: "Бага",   color: "#ef5b65" };
}

const BIN_COLORS = {
  plastic: { accent: "#5b9dff", bg: "rgba(91,157,255,0.12)" },
  paper:   { accent: "#24c07d", bg: "rgba(36,192,125,0.12)" },
  can:     { accent: "#f5b041", bg: "rgba(245,176,65,0.12)"  },
  general: { accent: "#9ba8bb", bg: "rgba(155,168,187,0.12)"},
};

let allLogs   = [];
let allEvents = [];
let binChart   = null;
let statusChart = null;

async function fetchJson(url) {
  const res = await fetch(url);
  const result = await res.json();
  return result.data || [];
}

function formatTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// summary
async function loadSummary() {
  const data = await fetchJson(`${API_BASE}/dashboard/summary`);

  document.getElementById("totalDetections").textContent = data.total_detections ?? 0;
  document.getElementById("todayDetections").textContent = data.today_detections  ?? 0;
  document.getElementById("successfulSorts").textContent = data.successful_sorts  ?? 0;
  document.getElementById("totalEvents").textContent     = data.total_events      ?? 0;

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
  const data  = await fetchJson(`${API_BASE}/dashboard/feedback-summary`);
  const total = (data.correct_count ?? 0) + (data.corrected_count ?? 0);
  const acc   = total > 0 ? Math.round((data.correct_count / total) * 100) : 0;

  const el = document.getElementById("feedbackSummary");
  if (el) el.textContent = `${acc}%`;

  const sub = document.getElementById("feedbackSubText");
  if (sub) sub.textContent = `${data.correct_count ?? 0} зөв / ${data.corrected_count ?? 0} зассан`;
}

//bin stats
async function loadBinStats() {
  const bins = await fetchJson(`${API_BASE}/dashboard/bin-stats`);
  const container = document.getElementById("binStatsGrid");
  container.innerHTML = "";

  bins.forEach(bin => {
    const c       = BIN_COLORS[bin.bin_type] || BIN_COLORS.general;
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
      <div class="bin-location">${bin.location || "Байршил тодорхойгүй"}</div>
    `;
    container.appendChild(box);
  });

  return bins;
}

// chart
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
            ticks: { color: "#aab9cc", font: { size: 12 } },
            beginAtZero: true,
          },
          y: {
            grid: { display: false },
            ticks: { color: "#eef4fb", font: { size: 13 } },
          },
        },
      },
    });
  }

  // detection status detail
  const statusCtx = document.getElementById("statusChart")?.getContext("2d");
  if (statusCtx) {
    const breakdown = summary.status_breakdown || {};
    const keys   = ["detected", "unsupported", "multiple_items", "no_detection"];
    const colors = ["#24c07d", "#ef5b65", "#f5b041", "#9ba8bb"];
    const labelsMn = {
      detected:       "Илэрсэн",
      unsupported:    "Дэмжигдээгүй",
      multiple_items: "Олон объект илэрсэн",
      no_detection:   "Илэрцгүй",
    };
    const active = keys.filter(k => (breakdown[k] || 0) > 0);

    if (statusChart) statusChart.destroy();
    statusChart = new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: active.map(k => labelsMn[k] || k),
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
            labels: { color: "#aab9cc", padding: 14, font: { size: 12 } },
          },
        },
      },
    });
  }
}

// Статусын badge
function createStatusBadge(status) {
  const label = STATUS_LABELS_MN[status] || status;
  return `<span class="status-badge status-${status}">${label}</span>`;
}

function renderLogDetail(log) {
  const panel = document.getElementById("logDetailPanel");
  panel.classList.remove("hidden");

  const confPct = (Number(log.confidence) * 100).toFixed(1);
  const confLvl = getConfLevel(parseFloat(confPct));
  // Итгэлцлийн түвшнийг өнгөтэй харуулах
  const confHtml = `
    <span style="font-weight:700;color:${confLvl.color}">${confPct}%</span>
    <span style="font-size:12px;color:${confLvl.color};margin-left:6px">(${confLvl.label})</span>
  `;

  panel.innerHTML = `
    <h4>Танилтын дэлгэрэнгүй</h4>
    <div class="detail-grid">
      <div class="detail-item"><span>ID</span>${log.id}</div>
      <div class="detail-item"><span>Илэрсэн ангилал</span>${CLASS_LABELS_MN[log.detected_class] || log.detected_class || "—"}</div>
      <div class="detail-item"><span>Итгэлцэл</span>${confHtml}</div>
      <div class="detail-item"><span>Зорилтот сав</span>${binLabels[log.final_bin_type] || log.final_bin_type || "—"}</div>
      <div class="detail-item"><span>Төлөв</span>${STATUS_LABELS_MN[log.detection_status] || log.detection_status}</div>
      <div class="detail-item"><span>Загвар</span>${log.model_version || "—"}</div>
      <div class="detail-item"><span>Цаг</span>${formatTs(log.created_at)}</div>
      <div class="detail-item"><span>Нийт илэрсэн</span>${log.detected_count ?? "—"}</div>
    </div>
  `;
}

function getFilteredLogs() {
  const status = document.getElementById("logStatusFilter").value;
  const bin    = document.getElementById("logBinFilter").value;
  const sort   = document.getElementById("logSortField").value;

  let logs = [...allLogs];
  if (status !== "all") logs = logs.filter(l => l.detection_status === status);
  if (bin    !== "all") logs = logs.filter(l => l.final_bin_type   === bin);

  logs.sort((a, b) => sort === "confidence"
    ? Number(b.confidence) - Number(a.confidence)
    : new Date(b.created_at) - new Date(a.created_at)
  );
  return logs;
}

function renderLogs() {
  const logs  = getFilteredLogs();
  const tbody = document.getElementById("logsTableBody");
  tbody.innerHTML = "";

  logs.forEach(log => {
    const confPct  = Math.round(Number(log.confidence) * 100);
    const confLvl  = getConfLevel(confPct);
    const row = document.createElement("tr");
    
    
    row.innerHTML = `
      <td>${log.id}</td>
      <td>${CLASS_LABELS_MN[log.detected_class] || log.detected_class || "—"}</td>
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
    row.addEventListener("click", () => renderLogDetail(log));
    tbody.appendChild(row);
  });
}

async function loadLogs() {
  allLogs = await fetchJson(`${API_BASE}/dashboard/logs`);
  renderLogs();
}

//event table
function renderEventDetail(event) {
  const panel = document.getElementById("eventDetailPanel");
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h4>Үйл явцын дэлгэрэнгүй</h4>
    <div class="detail-grid">
      <div class="detail-item"><span>ID</span>${event.id}</div>
      <div class="detail-item"><span>Төрөл</span>${event.event_type}</div>
      <div class="detail-item"><span>Мэдэгдэл</span>${event.event_message}</div>
      <div class="detail-item"><span>Холбоотой танилт</span>${event.related_detection_id ?? "—"}</div>
      <div class="detail-item"><span>Цаг</span>${formatTs(event.created_at)}</div>
    </div>
  `;
}

function getFilteredEvents() {
  const type = document.getElementById("eventTypeFilter").value;
  let events = [...allEvents];
  if (type !== "all") events = events.filter(e => e.event_type === type);
  return events;
}

function renderEvents() {
  const events = getFilteredEvents();
  const tbody  = document.getElementById("eventsTableBody");
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
    row.addEventListener("click", () => renderEventDetail(event));
    tbody.appendChild(row);
  });
}

async function loadEvents() {
  allEvents = await fetchJson(`${API_BASE}/dashboard/events`);
  renderEvents();
}

// export hiih bolomj
function exportCsv(filename, rows, headers) {
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(k => `"${r[k] ?? ""}"`).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportFilteredLogsCsv() {
  exportCsv("monbin_detection_logs.csv", getFilteredLogs(),
    ["id","detected_class","confidence","final_bin_type","detection_status","created_at"]);
}

function exportFilteredEventsCsv() {
  exportCsv("monbin_system_events.csv", getFilteredEvents(),
    ["id","event_type","event_message","related_detection_id","created_at"]);
}

// bit of bootstrap
async function loadDashboard() {
  try {
    const [summary, , bins] = await Promise.all([
      loadSummary(),
      loadFeedbackSummary(),
      loadBinStats(),
      loadLogs(),
      loadEvents(),
    ]);
    if (summary && bins) renderCharts(bins, summary);
  } catch (err) {
    console.error("Dashboard load failed:", err);
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadDashboard);
document.getElementById("exportBtn").addEventListener("click", exportFilteredLogsCsv);
document.getElementById("exportLogsBtn").addEventListener("click", exportFilteredLogsCsv);
document.getElementById("exportEventsBtn").addEventListener("click", exportFilteredEventsCsv);

document.getElementById("logStatusFilter").addEventListener("change", renderLogs);
document.getElementById("logBinFilter").addEventListener("change", renderLogs);
document.getElementById("logSortField").addEventListener("change", renderLogs);
document.getElementById("eventTypeFilter").addEventListener("change", renderEvents);

window.addEventListener("DOMContentLoaded", loadDashboard);
