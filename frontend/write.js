const API_URL = "http://127.0.0.1:8080";

// line
const CLASS_THRESHOLDS = {
  paper:         0.93,
  pet_bottle:    0.93,
  can:           0.91,
  carton_box:    0.88,
  cup_container: 0.85,
  food_waste:    0.82,
  glass:         0.85,
  others:        0.80,
  plastic_other: 0.82,
  wrapper:       0.78,
  electronics:   0.85,
  batteries:     0.85,
};

// Ангиллын босго утгыг авах (байхгүй бол default 0.85)
function getClassThreshold(cls) {
  return CLASS_THRESHOLDS[cls] ?? 0.85;
}

// state
let cameraStream = null;
let capturedImage = null;
let lastCaptureImageUrl = null;
let lastDetectionId = null;
let autoReturnTimer = null;


// label maps
const classLabels = {
  paper: "Цаас",
  pet_bottle: "PET Хуванцар сав",
  can: "Лааз",
  carton_box: "Картон хайрцаг",
  cup_container: "Аяга",
  food_waste: "Эко хаягдал",
  glass: "Шил",
  others: "Бусад",
  plastic_other: "Хуванцар (бусад)",
  wrapper: "Уут, боодол",
  electronics: "Электрон хог хаягдал",
  batteries: "Батерей"
};

const binLabels = {
  plastic: "Хуванцар сав",
  paper: "Цаас",
  can: "Лааз",
  general: "Бусад хог"
};

const binImages = {
  plastic: "./assets/images/plastic.png",
  paper: "./assets/images/paper.png",
  can: "./assets/images/can.png",
  general: "./assets/images/general.png"
};

const binOrbBg = {
  plastic: "#cfe8f5",
  paper: "#cde8ce",
  can: "#f9dfac",
  general: "#e0dbd4"
};

const binImpact = {
  plastic: "Хуванцар савыг ангилснаар дахин боловсруулах боломж нэмэгдэж, байгаль орчинд хуримтлагдах хуванцар хаягдлыг бууруулахад тусална.",
  paper: "Цаасыг зөв ангилах нь модны хэрэглээг бууруулж, дахин боловсруулах сүлжээнд оруулах боломжийг нэмэгдүүлнэ. 1 тонн цаасыг дахин боловсруулахад 17 мод хамгаалагдана.",
  can: "Метал лааз дахин боловсруулах нь шинэ хөнгөн цагаан үйлдвэрлэхтэй харьцуулахад 95% бага эрчим хүч зарцуулдаг.",
  general: "Бусад ангиллын хогийг зөв ялгах нь хог хаягдлын тогтвортой менежментэд чухал хувь нэмэр оруулдаг."
};

const binSub = {
  plastic: "PET · Хуванцар",
  paper: "Цаас · Картон",
  can: "Лааз · Хөнгөн цагаан",
  general: "Ерөнхий хог"
};

// screen management
const screens = {
  idle: document.getElementById("screen-idle"),
  scanning: document.getElementById("screen-scanning"),
  result: document.getElementById("screen-result"),
  multi: document.getElementById("screen-multi"),
  error: document.getElementById("screen-error"),
  help: document.getElementById("screen-help"),
  binDetail: document.getElementById("screen-bin-detail"),
  about: document.getElementById("screen-about"),
  donate: document.getElementById("screen-donate")
};

function showScreen(name) {
  Object.values(screens).forEach(screen => screen && screen.classList.remove("active"));
  const target = screens[name];
  if (target) target.classList.add("active");

  if (name !== "result") {
    clearAutoReturnTimer();
  }
}


// auto return
function clearAutoReturnTimer() {
  if (autoReturnTimer) {
    clearTimeout(autoReturnTimer);
    autoReturnTimer = null;
  }
}

function startAutoReturn(seconds = 8) {
  clearAutoReturnTimer();
  autoReturnTimer = setTimeout(() => {
    document.getElementById("correctBinSelect")?.classList.add("hidden");
    showScreen("idle");
  }, seconds * 1000);
}

// datetime
function updateDateTime() {
  const el = document.getElementById("datetimeText");
  if (!el) return;

  const now = new Date();
  const days = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
  const y  = now.getFullYear();
  const m  = now.getMonth() + 1;
  const d  = now.getDate();
  const wd = days[now.getDay()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  el.textContent = `${y} оны ${m}-р сарын ${d} · ${wd} · ${hh}:${mm}`;
}

setInterval(updateDateTime, 1000);
updateDateTime();


// camera
async function startCamera(videoElement) {
  cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = cameraStream;
  await videoElement.play();
  // Camera дулаацах богино хугацаа - 2 дахь скан дахин хурдан эхлэхэд videoWidth=0 байхаас сэргийлнэ
  await new Promise(resolve => setTimeout(resolve, 250));
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}

function captureFrame(videoElement, canvasElement) {
  const w = videoElement.videoWidth;
  const h = videoElement.videoHeight;
  if (!w || !h) {
    return Promise.reject(new Error("Камер бэлэн болоогүй байна."));
  }
  const context = canvasElement.getContext("2d");
  canvasElement.width = w;
  canvasElement.height = h;
  context.drawImage(videoElement, 0, 0, w, h);

  return new Promise(resolve => {
    canvasElement.toBlob(blob => {
      capturedImage = blob;
      if (blob) lastCaptureImageUrl = URL.createObjectURL(blob);
      resolve(blob);
    }, "image/jpeg");
  });
}


// counter UI

function runCountdown(seconds = 3) {
  return new Promise(resolve => {
    const overlay = document.getElementById("countdownOverlay");
    const numEl = document.getElementById("countdownNum");

    overlay.classList.remove("hidden");
    let count = seconds;
    numEl.textContent = count;

    const interval = setInterval(() => {
      count--;

      if (count <= 0) {
        clearInterval(interval);
        numEl.textContent = "✓";
        setTimeout(() => {
          overlay.classList.add("hidden");
          resolve();
        }, 400);
      } else {
        numEl.textContent = count;
      }
    }, 1000);
  });
}


// API zurag илгээх
async function sendImageForDetection(imageBlob) {
  const formData = new FormData();
  formData.append("file", imageBlob, "capture.jpg");

  try {
    const response = await fetch(`${API_URL}/detect`, {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    return {
      ok: response.ok,
      data: result
    };
  } catch (error) {
    console.error("error sending img to detection:", error);
    return {
      ok: false,
      data: {
        message: "Backend сервертэй холбогдож чадсангүй."
      }
    };
  }
}


// bin status
async function fetchBinStatus() {
  try {
    const response = await fetch(`${API_URL}/bins`);
    if (!response.ok) return;

    const result = await response.json();
    const bins = result.data || [];

    bins.forEach(bin => {
      const badge = document.getElementById(`badge-${bin.bin_type}`);
      if (badge) {
        badge.textContent = bin.item_count;
      }
    });
  } catch (error) {
    console.error("Bin status fetch failed:", error);
  }
}

// Итгэлцлийн индикатор badge болон мөрийг шинэчлэх
function updateConfBar(confidence, detectedClass) {
  const pct = Math.round((confidence ?? 0) * 100);
  const threshold = getClassThreshold(detectedClass);
  const badge = document.getElementById("resultConfBadge");
  const fill  = document.getElementById("resultConfFill");

  if (badge) {
    badge.textContent = `${pct}%`;
    // Өнгийг итгэлцлийн түвшнээр тодорхойлох
    badge.className = "result-conf-badge " + (
      confidence >= threshold ? "conf-high" :
      confidence >= 0.65      ? "conf-medium" : "conf-low"
    );
  }
  if (fill) {
    fill.style.width = `${pct}%`;
    fill.style.background =
      confidence >= threshold ? "#218548" :
      confidence >= 0.65      ? "#b87a00" : "#c53a3a";
  }
}

// Хоёр ойролцоо ангиллыг харуулах (загвар тодорхойгүй үед)
function showAltPrediction(detections, primaryClass) {
  const altBox     = document.getElementById("resultAltBox");
  const altContent = document.getElementById("altPredContent");
  if (!altBox || !altContent) return;

  // Топ 2 өвөрмөц ангиллыг олох
  const seen = new Set();
  const topTwo = [];
  for (const d of (detections || [])) {
    if (!seen.has(d.detected_class)) {
      seen.add(d.detected_class);
      topTwo.push(d);
      if (topTwo.length === 2) break;
    }
  }

  // Хоёрдох ангиллын итгэлцэл 30%-аас дээш байвал хоёуланг харуулах
  if (topTwo.length < 2 || topTwo[1].confidence < 0.30) {
    altBox.classList.add("hidden");
    return;
  }

  const [p1, p2] = topTwo;
  const p1Pct = Math.round(p1.confidence * 100);
  const p2Pct = Math.round(p2.confidence * 100);

  altContent.innerHTML = `
    <div class="alt-pred-item">
      <span class="alt-pred-cls">${classLabels[p1.detected_class] || p1.detected_class}</span>
      <span class="alt-pred-pct">${p1Pct}%</span>
    </div>
    <span class="alt-vs">эсвэл</span>
    <div class="alt-pred-item alt-secondary">
      <span class="alt-pred-cls">${classLabels[p2.detected_class] || p2.detected_class}</span>
      <span class="alt-pred-pct">${p2Pct}%</span>
    </div>
  `;
  altBox.classList.remove("hidden");
}

// result UI
function showResultScreen(data) {
  lastDetectionId = data.log_id || null;

  const resultImage = document.getElementById("resultPreview");
  const resultClass = document.getElementById("resultDetectedClass");
  const resultBin = document.getElementById("resultBinType");

  const autoBox = document.getElementById("resultAutoBox");
  const confirmBox = document.getElementById("resultConfirmBox");
  const correctBinSelect = document.getElementById("correctBinSelect");

  const errorBox = document.getElementById("resultErrorBox");
  const multiBox = document.getElementById("resultMultiBox");

  // Бүх хайрцгийг нуух (дахин скан хийхэд өмнөх үр дүн харагдахгүй байх)
  autoBox?.classList.add("hidden");
  confirmBox?.classList.add("hidden");
  correctBinSelect?.classList.add("hidden");
  errorBox?.classList.add("hidden");
  multiBox?.classList.add("hidden");
  document.getElementById("resultAltBox")?.classList.add("hidden");

  // image
  if (resultImage && lastCaptureImageUrl) {
    resultImage.src = lastCaptureImageUrl;
  }

  // class
  resultClass.textContent =
    classLabels[data.detected_class] || data.detected_class || "—";

  
  // case 1: no detection
  if (data.status === "no_detection") {
    errorBox?.classList.remove("hidden");
    document.getElementById("resultErrorText").textContent =
      "Хог илэрсэнгүй";
    startAutoReturn(5);
    return;
  }

  
  // case 2: multiple
  if (data.status === "multiple_items") {
    multiBox?.classList.remove("hidden");
    startAutoReturn(6);
    return;
  }

  
  // case 3: electronics, batteries
  if (data.status === "unsupported") {
    errorBox?.classList.remove("hidden");
    document.getElementById("resultErrorText").textContent =
      data.warning_message || "Тусгай хог илэрлээ";
    startAutoReturn(6);
    return;
  }


  // Ангилах сав харуулах
  resultBin.textContent =
    binLabels[data.final_bin_type] || data.final_bin_type;
  resultBin.style.background =
    binOrbBg[data.final_bin_type] || "#e8eee9";

  // Итгэлцлийн мөр шинэчлэх
  updateConfBar(data.confidence ?? 0, data.detected_class);

  // Backend-ын босго эсвэл frontend-ын default босгыг ашиглах
  const threshold = data.class_threshold ?? getClassThreshold(data.detected_class);
  const conf = data.confidence ?? 0;

  if (conf >= threshold) {
    // Өндөр итгэлцэл: автомат баталгаажуулалт, 6 секундэд буцах
    autoBox?.classList.remove("hidden");
    startAutoReturn(6);
  } else {
    // Бага итгэлцэл: хэрэглэгчийн баталгаажуулалт хүсэх, 10 секундэд буцах
    showAltPrediction(data.detections, data.detected_class);
    confirmBox?.classList.remove("hidden");
    startAutoReturn(10);
  }
}


// error UI
function showErrorMessage(message) {
  const el = document.getElementById("errorMessageText");
  if (el) el.textContent = message;
}

function setErrorMode(title, message, hintText, buttonText = "Дахин оролдох") {
  const titleEl = document.getElementById("errorTitle");
  const hintEl = document.getElementById("errorHintText");
  const buttonEl = document.getElementById("tryAgainBtn");

  if (titleEl) titleEl.textContent = title;
  showErrorMessage(message);
  if (hintEl) hintEl.textContent = hintText;
  if (buttonEl) buttonEl.textContent = buttonText;
}

// error handler
function handleError(result) {
  const status = result?.data?.detection_status || result?.data?.status || result?.status;
  const cls = result?.data?.detected_class;

  if(cls === "batteries" || cls === "electronics"){
    setErrorMode(
      "Тусгай ангиллын хог",
      "Энэ төрлийн хогийг ангилах боломжгүй",
      "Батерей болон электрон хаягдлыг зориулалтын тусгай саванд хаяна уу.",
      "Нүүр рүү буцах"
    );
    showScreen("error");
    return;
  }
  
  if (status === "multiple_items") {
    showScreen("multi");
    return;
  }

  
  if (status === "unsupported") {
    setErrorMode(
      "Тусгай ангиллын хог",
      result?.data?.warning_message || "Энэ төрлийн хогийг систем ангилахгүй.",
      "Батерей болон цахилгаан барааг зориулалтын тусгай саванд хаяна уу.",
      "Нүүр рүү буцах"
    );
    showScreen("error");
    return;
  }

  if (status === "no_detection") {
    setErrorMode(
      "Хог илрээгүй",
      "Хог илэрсэнгүй. Камерын өмнө ойртуулна уу.",
      "Хогийг ганцаар нь, тод харагдахуйц байрлуулж дахин оролдоно уу.",
      "Дахин оролдох"
    );
    showScreen("error");
    return;
  }

  setErrorMode(
    "Системийн алдаа",
    result?.message || result?.data?.message || "Танилт хийх явцад алдаа гарлаа.",
    "Дахин оролдоно уу.",
    "Дахин оролдох"
  );
  showScreen("error");
}

// detection flow
async function startDetection() {
  const video = document.getElementById("cameraPreview");
  const canvas = document.getElementById("captureCanvas");
  const scanText = document.getElementById("scanText");
  const status = document.getElementById("scanStatusText");

  showScreen("scanning");

  try {
    if (status) status.textContent = "Камер асаж байна...";
    if (scanText) scanText.textContent = "Хогийг камерын өмнө байрлуулна уу";

    await startCamera(video);

    if (status) status.textContent = "Бэлтгэж байна...";
    await runCountdown(3);

    if (status) status.textContent = "Зураг авч байна...";
    const imageBlob = await captureFrame(video, canvas);

    stopCamera();

    if (scanText) scanText.textContent = "AI таньж байна...";
    if (status) status.textContent = "Ангилал тодорхойлж байна...";

    const response = await sendImageForDetection(imageBlob);

    if (!response.ok) {
      handleError(response.data);
      return;
    }

    const result = response.data;

    if (!result || !result.data) {
      handleError(result);
      return;
    }

    const data = result.data;
    const detectionStatus = data.status;

    // unsupported → error
    if (detectionStatus === "unsupported") {
      handleError(result);
      return;
    }

    // no detection → error
    if (detectionStatus === "no_detection") {
      handleError(result);
      return;
    }

    // multiple → multi screen
    if (detectionStatus === "multiple_items") {
      showScreen("multi");
      return;
    }

    // result screen
    showResultScreen(data);
    fetchBinStatus();
    showScreen("result");

  } catch (error) {
    console.error("error during detection flow:", error);
    stopCamera();
    document.getElementById("countdownOverlay")?.classList.add("hidden");

    setErrorMode(
      "Системийн алдаа",
      "Камертай холбогдож чадсангүй эсвэл танилт амжилтгүй боллоо.",
      "Камерын зөвшөөрөл болон backend холболтыг шалгаад дахин оролдоно уу.",
      "Дахин оролдох"
    );
    showScreen("error");
  }
}

// feedback
async function submitFeedback(wasCorrect, correctedBinType = null) {
  clearAutoReturnTimer();

  if (!lastDetectionId) {
    showScreen("idle");
    return;
  }

  try {
    await fetch(`${API_URL}/feedback`, {
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
    document.getElementById("correctBinSelect")?.classList.add("hidden");
    showScreen("idle");
  }, 700);
}

// bin detail
function openBinDetail(binType) {
  const badge = document.getElementById(`badge-${binType}`);
  const count = badge ? badge.textContent : "0";

  document.getElementById("detailIcon").src = binImages[binType] || "";
  document.getElementById("detailTitle").textContent = binLabels[binType] || binType;
  document.getElementById("detailSub").textContent = binSub[binType] || "";
  document.getElementById("detailItemCount").textContent = count;
  document.getElementById("detailImpactText").textContent = binImpact[binType] || "—";

  const orbEl = document.getElementById("detailOrbEl");
  if (orbEl) {
    orbEl.style.background = binOrbBg[binType] || "#eee";
  }

  showScreen("binDetail");
}


// event listeners
document.getElementById("detectBtn")?.addEventListener("click", startDetection);
document.getElementById("helpBtn")?.addEventListener("click", () => showScreen("help"));
document.getElementById("aboutBtn")?.addEventListener("click", () => showScreen("about"));
document.getElementById("donateBtn")?.addEventListener("click", () => showScreen("donate"));
document.getElementById("multiContinueBtn")?.addEventListener("click", () => showScreen("idle"));

document.getElementById("tryAgainBtn")?.addEventListener("click", () => {
  const errorTitle = document.getElementById("errorTitle")?.textContent || "";
  if (errorTitle === "Тусгай ангиллын хог") {
    showScreen("idle");
  } else {
    startDetection();
  }
});

document.getElementById("resultHomeBtn")?.addEventListener("click", () => {
  clearAutoReturnTimer();
  showScreen("idle");
});

document.getElementById("feedbackYesBtn")?.addEventListener("click", () => {
  clearAutoReturnTimer();
  submitFeedback(true, null);
});

document.getElementById("feedbackNoBtn")?.addEventListener("click", () => {
  clearAutoReturnTimer();
  document.getElementById("correctBinSelect")?.classList.remove("hidden");
});

document.querySelectorAll(".mini-bin").forEach(btn => {
  btn.addEventListener("click", () => {
    clearAutoReturnTimer();
    submitFeedback(false, btn.dataset.correctBin);
  });
});

document.querySelectorAll(".bin-card").forEach(card => {
  card.addEventListener("click", () => openBinDetail(card.dataset.bin));
});

document.querySelectorAll(".back-btn").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.back || "idle"));
});


// init
fetchBinStatus();
setInterval(fetchBinStatus, 30000);