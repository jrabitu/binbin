const API_BASE = "http://127.0.0.1:8080";

const screens = {
  idle: document.getElementById("screen-idle"),
  scanning: document.getElementById("screen-scanning"),
  result: document.getElementById("screen-result"),
  multi: document.getElementById("screen-multi"),
  error: document.getElementById("screen-error"),
  help: document.getElementById("screen-help"),
  binDetail: document.getElementById("screen-bin-detail"),
  about: document.getElementById("screen-about")
};

const detectBtn = document.getElementById("detectBtn");
const helpBtn = document.getElementById("helpBtn");
const aboutBtn = document.getElementById("aboutBtn");
const tryAgainBtn = document.getElementById("tryAgainBtn");
const multiContinueBtn = document.getElementById("multiContinueBtn");
const resultHomeBtn = document.getElementById("resultHomeBtn");
const feedbackYesBtn = document.getElementById("feedbackYesBtn");
const feedbackNoBtn = document.getElementById("feedbackNoBtn");
const correctBinSelect = document.getElementById("correctBinSelect");
const datetimeText = document.getElementById("datetimeText");

let lastDetectionId = null;
let autoReturnTimer = null;

const classLabels = {
  paper: "Цаас",
  pet_bottle: "PET Хуванцар сав",
  can: "Лааз",
  carton_box: "Картон хайрцаг",
  cup_container: "Сав",
  food_waste: "Хоолны хаягдал",
  glass: "Шил",
  others: "Бусад",
  plastic_other: "Бусад хуванцар",
  wrapper: "Сав баглаа боодол",
  electronics: "Цахилгаан хог хаягдал",
  batteries: "Батерей"
};

const binLabels = {
  plastic: "Хуванцар сав",
  paper: "Цаас",
  can: "Лааз",
  general: "Бусад"
};

const binIcons = {
  plastic: "💧",
  paper: "📄",
  can: "🥫",
  general: "🗑️"
};

const binImpactText = {
  plastic: "Хуванцар сав ангилснаар дахин боловсруулалтыг нэмэгдүүлж, хаягдлыг бууруулна.",
  paper: "Цаасыг зөв ангилснаар дахин боловсруулалт нэмэгдэж, модны хэрэглээ буурна.",
  can: "Лаазыг ангилан цуглуулах нь металл дахин боловсруулах боломжийг нэмэгдүүлнэ.",
  general: "Бусад төрлийн хог хаягдлыг зөв тусгаарласнаар орчны бохирдлыг бууруулна."
};

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove("active"));
  screens[name].classList.add("active");

  if (name !== "result") {
    clearAutoReturnTimer();
  }
}

function updateDateTime() {
  const now = new Date();
  const days = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
  const y  = now.getFullYear();
  const m  = now.getMonth() + 1;
  const d  = now.getDate();
  const wd = days[now.getDay()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  datetimeText.textContent = `${y} оны ${m}-р сарын ${d} · ${wd} · ${hh}:${mm}`;
}


setInterval(updateDateTime, 1000);
updateDateTime();

async function fetchBinStatus() {
  try {
    const response = await fetch(`${API_BASE}/bins`);
    if (!response.ok) return;

    const result = await response.json();
    const bins = result.data || [];

    bins.forEach(bin => {
      const badge = document.getElementById(`badge-${bin.bin_type}`);
      const fill = document.getElementById(`fill-${bin.bin_type}`);
      const fillText = document.getElementById(`fill-text-${bin.bin_type}`);

      if (badge) badge.textContent = bin.item_count;
      if (fill) fill.style.width = `${bin.current_fill_level}%`;
      if (fillText) fillText.textContent = `${bin.current_fill_level}%`;
    });
  } catch (error) {
    console.error("Bin status fetch failed:", error);
  }
}

function clearAutoReturnTimer() {
  if (autoReturnTimer) {
    clearTimeout(autoReturnTimer);
    autoReturnTimer = null;
  }
}

function startAutoReturn(seconds = 8) {
  clearAutoReturnTimer();
  autoReturnTimer = setTimeout(() => {
    correctBinSelect.classList.add("hidden");
    showScreen("idle");
  }, seconds * 1000);
}

function setErrorMessage(message) {
  document.getElementById("errorMessageText").textContent = message;
}

function populateResultScreen(data) {
  lastDetectionId = data.log_id || null;

  document.getElementById("resultDetectedClass").textContent =
    classLabels[data.detected_class] || data.detected_class;

  document.getElementById("resultBinType").textContent =
    binLabels[data.final_bin_type] || data.final_bin_type;

  document.getElementById("resultPreview").src = "assets/test2.jpg";

  const feedbackQuestionText = document.getElementById("feedbackQuestionText");
  const feedbackActions = document.getElementById("feedbackActions");
  const resultHomeBtn = document.getElementById("resultHomeBtn");

  correctBinSelect.classList.add("hidden");

  if (data.confidence > 0.90) {
    feedbackQuestionText.classList.add("hidden");
    feedbackActions.classList.add("hidden");
    resultHomeBtn.classList.remove("hidden");
    startAutoReturn(6);
  } else {
    feedbackQuestionText.classList.remove("hidden");
    feedbackActions.classList.remove("hidden");
    resultHomeBtn.classList.remove("hidden");
    startAutoReturn(10);
  }
}

function populateBinDetail(binType) {
  const titleMap = {
    plastic: "Хуванцар сав",
    paper: "Цаас",
    can: "Лааз",
    general: "Бусад"
  };

  const badgeEl = document.getElementById(`badge-${binType}`);
  const fillTextEl = document.getElementById(`fill-text-${binType}`);

  const itemCount = badgeEl ? badgeEl.textContent : "0";
  const fillPercent = fillTextEl ? fillTextEl.textContent : "0%";

  document.getElementById("detailIcon").textContent = binIcons[binType] || "♻";
  document.getElementById("detailTitle").textContent = titleMap[binType] || binType;
  document.getElementById("detailItemCount").textContent = itemCount;
  document.getElementById("detailFillPercent").textContent = fillPercent;
  document.getElementById("detailProgressBar").style.width = fillPercent;
  document.getElementById("detailProgressBar").className = "progress-fill";

  if (binType === "plastic") document.getElementById("detailProgressBar").style.background = "#468df6";
  if (binType === "paper") document.getElementById("detailProgressBar").style.background = "#12c987";
  if (binType === "can") document.getElementById("detailProgressBar").style.background = "#ffb000";
  if (binType === "general") document.getElementById("detailProgressBar").style.background = "#8c95a8";

  document.getElementById("detailImpactText").textContent =
    binImpactText[binType] || "Энэ ангиллын савны мэдээлэл.";
}

async function startDetection() {
  showScreen("scanning");

  try {
    const response = await fetch(`${API_BASE}/detect?source=uploads/test2.jpg`, {
      method: "POST"
    });

    const result = await response.json();

    if (!response.ok || result.success === false) {
      const status = result?.data?.detection_status;

      if (status === "multiple_items") {
        document.getElementById("multiPreview").src = "assets/test2.jpg";
        showScreen("multi");
        return;
      }

      if (status === "unsupported") {
        setErrorMessage(result?.data?.warning_message || "Тухайн төрлийн хаягдлыг энэ систем хүлээн авахгүй.");
        showScreen("error");
        return;
      }

      setErrorMessage(result?.message || "Танилт хийх үед алдаа гарлаа.");
      showScreen("error");
      return;
    }

    populateResultScreen(result.data);
    fetchBinStatus();
    correctBinSelect.classList.add("hidden");
    showScreen("result");

  } catch (error) {
    console.error(error);
    setErrorMessage("Backend сервертэй холбогдож чадсангүй.");
    showScreen("error");
  }
}

async function submitFeedback(wasCorrect, correctedBinType = null) {
  clearAutoReturnTimer();

  if (!lastDetectionId) {
    showScreen("idle");
    return;
  }

  try {
    await fetch(`${API_BASE}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        detection_id: lastDetectionId,
        was_correct: wasCorrect,
        corrected_bin_type: correctedBinType
      })
    });
  } catch (error) {
    console.error("Feedback save failed:", error);
  }

  setTimeout(() => {
    correctBinSelect.classList.add("hidden");
    showScreen("idle");
  }, 700);
}

document.querySelectorAll(".bin-card").forEach(card => {
  card.addEventListener("click", () => {
    const binType = card.dataset.bin;
    populateBinDetail(binType);
    showScreen("binDetail");
  });
});

document.querySelectorAll(".back-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.back;
    showScreen(target);
  });
});

document.querySelectorAll(".mini-bin").forEach(btn => {
  btn.addEventListener("click", () => {
    const correctedBinType = btn.dataset.correctBin;
    submitFeedback(false, correctedBinType);
  });
});

detectBtn.addEventListener("click", startDetection);
helpBtn.addEventListener("click", () => showScreen("help"));
aboutBtn.addEventListener("click", () => showScreen("about"));
tryAgainBtn.addEventListener("click", startDetection);
multiContinueBtn.addEventListener("click", () => showScreen("idle"));
resultHomeBtn.addEventListener("click", () => showScreen("idle"));

feedbackYesBtn.addEventListener("click", () => {
  clearAutoReturnTimer();
  submitFeedback(true, null);
});

feedbackNoBtn.addEventListener("click", () => {
  clearAutoReturnTimer();
  correctBinSelect.classList.remove("hidden");
});

resultHomeBtn.addEventListener("click", () => {
  clearAutoReturnTimer();
  showScreen("idle");
});

document.querySelectorAll(".mini-bin").forEach(btn => {
  btn.addEventListener("click", () => {
    clearAutoReturnTimer();
    const correctedBinType = btn.dataset.correctBin;
    submitFeedback(false, correctedBinType);
  });
});

fetchBinStatus();