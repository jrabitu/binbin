const API_URL = "http://127.0.0.1:8080";

let cameraStream = null;
let capturedImageBlob = null;
let capturedImageUrl = null;
let lastDetectionId = null;
let autoReturnTimer = null;
let binApiData = {};

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

const classLabels = {
  paper: "Цаас",
  pet_bottle: "PET хуванцар сав",
  can: "Лааз",
  carton_box: "Картон хайрцаг",
  cup_container: "Аяга",
  food_waste: "Эко хаягдал",
  glass: "Шил",
  others: "Бусад",
  plastic_other: "Хуванцар",
  wrapper: "Боодол",
  electronics: "Электрон хог",
  batteries: "Батерей",
  fabric_napkins: "Даавуун материал"
};

const binLabels = {
  plastic: "Хуванцар",
  paper: "Цаас",
  can: "Лааз",
  general: "Бусад"
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
  plastic: "Хуванцар ангилснаар дахин боловсруулах боломж нэмэгдэнэ.",
  paper: "Цаас ангилснаар дахин боловсруулах сүлжээнд оруулах боломжтой.",
  can: "Металл дахин боловсруулах нь эрчим хүч хэмнэдэг.",
  general: "Хогийг зөв ангилах нь байгаль орчинд эерэг нөлөөтэй."
};

const binSub = {
  plastic: "PET · Хуванцар",
  paper: "Цаас · Картон",
  can: "Металл · Лааз",
  general: "Ерөнхий хог"
};

const binDetailData = {
  plastic: {
    typeTag: "Хуванцар",
    purpose: "Энэ савны зориулалт: PET ус, ундааны сав, шампунь болон ахуйн химийн хуванцар савнуудыг энд хийнэ үү. Зөвхөн хуванцар төрлийн савнууд хамаарна — бусад материалтай хольж болохгүй.",
    tips: [
      "Саванд үлдсэн шингэнийг гаргаж, зайлж угаана уу.",
      "Таг болон этикетийг тусад нь хаяна уу.",
      "Чавхдаж дарсан саванд илүү олон ширхэг багтана.",
      "Бохир буюу тосложсон саван дахин боловсруулах боломжгүй."
    ]
  },
  paper: {
    typeTag: "Цаас",
    purpose: "Энэ савны зориулалт: Цаасан хуудас, сонин, дэвтэр, картон хайрцаг болон цаасан уутнуудыг энд хийнэ үү. Хуурай, цэвэр цаас л тохирно — чийглэг эсвэл тосложсон цаасыг оруулж болохгүй.",
    tips: [
      "Тос, ус, хоолны үлдэгдэлгүй цагаан цаасыг авна уу.",
      "Пицца хайрцаг, чийглэг цаасыг оруулж болохгүй.",
      "Картон хайрцгийг нугалж, хавтгайлж хийнэ үү.",
      "Дахин боловсруулах тэмдэгтэй цаас энэ ангилалд хамаарна."
    ]
  },
  can: {
    typeTag: "Металл",
    purpose: "Энэ савны зориулалт: Ундааны лааз, металл хаягдлыг энд хийнэ үү. Аэрозол, даралттай лааз хамаарахгүй.",
    tips: [
      "Лаазыг хоослоно уу.",
      "Лаазыг жижиг болгосноор илүү олон ширхэг багтана.",
      "Даралттай, дотроо шингэн зүйл агуулсан лаазыг оруулж болохгүй."
    ]
  },
  general: {
    typeTag: "Ерөнхий",
    purpose: "Энэ савны зориулалт: Дахин боловсруулах боломжгүй эсвэл дахин боловсруулах ангилалд хамаарахгүй хаягдлыг энд хийнэ үү. Нийлмэл материал, хоолны хаягдал энд орно. Аюултай хог (батерей, электроник) тусгай саванд хийнэ үү.",
    tips: [
      "Ямар савд хийхээ мэдэхгүй бол энд хийнэ үү.",
      "Нийлмэл материал буюу хольцтой эд зүйлс энд.",
      "Хоол хаягдал, шороо, үнсийг энд авна уу.",
      "Аюултай хог — тусгай саванд, энд хийхгүй."
    ]
  }
};


function resetScanState() {
  clearAutoReturnTimer();
  stopCamera();

  capturedImageBlob = null;

  document.getElementById("countdownOverlay")?.classList.add("hidden");
  document.getElementById("correctBinSelect")?.classList.add("hidden");
  document.getElementById("resultAltBox")?.classList.add("hidden");

  const scanText = document.getElementById("scanText");
  const statusText = document.getElementById("scanStatusText");

  if (scanText) scanText.textContent = "Хогийг камер дор байрлуулна уу!";
  if (statusText) statusText.textContent = "";
}


function clearAutoReturnTimer() {
  if (autoReturnTimer) {
    clearTimeout(autoReturnTimer);
    autoReturnTimer = null;
  }
}

function startAutoReturn(seconds = 10) {
  clearAutoReturnTimer();

  autoReturnTimer = setTimeout(() => {
    resetResultUI();
    showScreen("idle");
  }, seconds * 1000);
}

function resetResultUI() {
  document.getElementById("correctBinSelect")?.classList.add("hidden");
  document.getElementById("resultAltBox")?.classList.add("hidden");
}

function showScreen(name) {
  Object.values(screens).forEach(screen => {
    screen?.classList.remove("active");
  });

  screens[name]?.classList.add("active");

  if (name === "idle") {
    resetScanState();
    fetchBinStatus();
  }

  if (name !== "result") {
    clearAutoReturnTimer();
  }
}

function updateDateTime() {
  const el = document.getElementById("datetimeText");
  if (!el) return;

  const now = new Date();

  const days = [
    "Ням",
    "Даваа",
    "Мягмар",
    "Лхагва",
    "Пүрэв",
    "Баасан",
    "Бямба"
  ];

  const text =
    `${now.getFullYear()} оны ` +
    `${now.getMonth() + 1}-р сарын ` +
    `${now.getDate()} · ` +
    `${days[now.getDay()]} · ` +
    `${String(now.getHours()).padStart(2, "0")}:` +
    `${String(now.getMinutes()).padStart(2, "0")}`;

  el.textContent = text;
}

setInterval(updateDateTime, 1000);
updateDateTime();

async function startCamera() {
  const video = document.getElementById("cameraPreview");

  if (!video) {
    throw new Error("Camera preview element not found.");
  }

  stopCamera();

  await new Promise(resolve => setTimeout(resolve, 300));

  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  video.srcObject = cameraStream;

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Camera metadata loading failed."));
  });

  await video.play();

  let tries = 0;

  while ((!video.videoWidth || !video.videoHeight) && tries < 20) {
    await new Promise(resolve => setTimeout(resolve, 100));
    tries++;
  }

  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Camera started but video size is not ready.");
  }
}

function stopCamera() {
  const video = document.getElementById("cameraPreview");

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
    video.removeAttribute("src");
    video.load();
  }
}

async function captureImage() {
  const video = document.getElementById("cameraPreview");
  const canvas = document.getElementById("captureCanvas");

  if (!video || !canvas) {
    throw new Error("Capture elements not found.");
  }

  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) {
    throw new Error("Camera frame is not ready.");
  }

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("Failed to create image blob."));
        return;
      }

      capturedImageBlob = blob;

      if (capturedImageUrl) {
        URL.revokeObjectURL(capturedImageUrl);
      }

      capturedImageUrl = URL.createObjectURL(blob);

      resolve(blob);
    }, "image/jpeg", 0.95);
  });
}

async function runCountdown(seconds = 3) {
  const overlay = document.getElementById("countdownOverlay");
  const number = document.getElementById("countdownNum");

  overlay?.classList.remove("hidden");

  for (let i = seconds; i >= 1; i--) {
    if (number) number.textContent = i;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (number) number.textContent = "✓";

  await new Promise(resolve => setTimeout(resolve, 400));

  overlay?.classList.add("hidden");
}

async function sendDetection(blob) {
  if (!blob) {
    throw new Error("Captured image is empty.");
  }

  const formData = new FormData();
  formData.append("file", blob, "capture.jpg");

  console.log("Sending image to:", `${API_URL}/detect`);

  try {
    const response = await fetch(`${API_URL}/detect`, {
      method: "POST",
      body: formData
    });

    console.log("Backend response status:", response.status);

    const text = await response.text();
    console.log("Raw backend response:", text);

    return JSON.parse(text);

  } catch (error) {
    console.error("Fetch failed:", error);
    throw new Error("Backend рүү зураг илгээж чадсангүй. Backend terminal дээр POST /detect орж байгаа эсэхийг шалгана уу.");
  }
}

async function fetchBinStatus() {
  try {
    const response = await fetch(`${API_URL}/bins`);

    if (!response.ok) return;

    const result = await response.json();

    const bins = result.data || [];

    bins.forEach(bin => {
      binApiData[bin.bin_type] = bin;

      const badge = document.getElementById(`badge-${bin.bin_type}`);
      if (badge) badge.textContent = bin.item_count;
    });

  } catch (error) {
    console.error(error);
  }
}

function updateConfidenceBar(confidence = 0) {
  const pct = Math.round(confidence * 100);

  const badge = document.getElementById("resultConfBadge");
  const fill = document.getElementById("resultConfFill");

  if (!badge || !fill) return;

  badge.textContent = `${pct}%`;

  let color = "#c53a3a";
  let cls = "conf-low";

  if (pct >= 85) {
    color = "#218548";
    cls = "conf-high";
  }
  else if (pct >= 65) {
    color = "#b87a00";
    cls = "conf-medium";
  }

  badge.className = `result-conf-badge ${cls}`;

  fill.style.width = `${pct}%`;
  fill.style.background = color;
}

function renderAgreementInfo(data) {
  const autoBox = document.getElementById("resultAutoBox");

  if (!autoBox) return;

  const binName = binLabels[data.final_bin_type] || data.final_bin_type || "тохирох сав";

  autoBox.innerHTML = `
    <h3>Баярлалаа</h3>
    <p>Хогийг <strong>${binName}</strong> ангилалд амжилттай бүртгэлээ.</p>
  `;
}

function renderConflictInfo(data) {
  const altBox = document.getElementById("resultAltBox");
  const altContent = document.getElementById("altPredContent");

  if (!altBox || !altContent) return;

  altBox.classList.remove("hidden");

  altContent.innerHTML = `
    <div class="alt-pred-item">
      <span class="alt-pred-cls">Системийн санал</span>
      <span class="alt-pred-pct">
        ${classLabels[data.final_class] || data.final_class}
      </span>
      <span class="alt-pred-pct">
        ${binLabels[data.final_bin_type] || data.final_bin_type}
      </span>
    </div>
  `;
}

function renderResult(data) {

  lastDetectionId = data.log_id || null;

  resetResultUI();

  const image =
    document.getElementById("resultPreview");

  const resultClass =
    document.getElementById("resultDetectedClass");

  const resultBin =
    document.getElementById("resultBinType");

  const autoBox =
    document.getElementById("resultAutoBox");

  const confirmBox =
    document.getElementById("resultConfirmBox");

  autoBox?.classList.add("hidden");
  confirmBox?.classList.add("hidden");

  if (capturedImageUrl && image) {
    image.src = capturedImageUrl;
  }

  resultClass.textContent =
    classLabels[data.final_class] || data.final_class;

  resultBin.textContent =
    binLabels[data.final_bin_type] || data.final_bin_type;

  resultBin.style.background =
    binOrbBg[data.final_bin_type] || "#eee";

  updateConfidenceBar(data.final_confidence || 0);

  if (data.status === "success") {

    autoBox?.classList.remove("hidden");

    renderAgreementInfo(data);

    startAutoReturn(10);
  }

  else if (data.status === "confirmation_required") {

    confirmBox?.classList.remove("hidden");

    renderConflictInfo(data);

    startAutoReturn(15);
  }

  showScreen("result");
}

function setErrorMode(title, message, hint, buttonText) {

  const titleEl =
    document.getElementById("errorTitle");

  const msgEl =
    document.getElementById("errorMessageText");

  const hintEl =
    document.getElementById("errorHintText");

  const buttonEl =
    document.getElementById("tryAgainBtn");

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (hintEl) hintEl.textContent = hint;
  if (buttonEl) buttonEl.textContent = buttonText;
}

function handleError(data) {

  const status = data.status;

  if (status === "multiple_items") {
    showScreen("multi");
    return;
  }

  if (status === "unsupported") {

    setErrorMode(
      "Тусгай хог илэрлээ",
      data.warning_message || "Тусгай ангиллын хог.",
      "Зориулалтын саванд хаяна уу.",
      "Нүүр рүү буцах"
    );

    showScreen("error");
    return;
  }

  if (status === "no_detection") {

    setErrorMode(
      "Хог илэрсэнгүй",
      "Камер дээр хаягдал илэрсэнгүй.",
      "Хогийг төв хэсэгт байрлуулаад дахин оролдоно уу.",
      "Дахин оролдох"
    );

    showScreen("error");
    return;
  }

  if (status === "bin_not_found") {

    setErrorMode(
      "Сав олдсонгүй",
      "Идэвхтэй ангилах сав олдсонгүй.",
      "Системийн тохиргоог шалгана уу.",
      "Нүүр рүү буцах"
    );

    showScreen("error");
    return;
  }

  setErrorMode(
    "Системийн алдаа",
    "Тодорхойгүй алдаа гарлаа.",
    "Backend болон камерын холболтыг шалгана уу.",
    "Дахин оролдох"
  );

  showScreen("error");
}

async function startDetection() {
  const scanText = document.getElementById("scanText");
  const statusText = document.getElementById("scanStatusText");
  const detectBtn = document.getElementById("detectBtn");

  try {
    resetScanState();

    if (detectBtn) detectBtn.disabled = true;

    showScreen("scanning");

    if (scanText) scanText.textContent = "Хогийг камерын өмнө байрлуулна уу";
    if (statusText) statusText.textContent = "Камер асаж байна...";

    await startCamera();

    if (statusText) statusText.textContent = "Бэлтгэж байна...";
    await runCountdown(3);

    if (statusText) statusText.textContent = "Зураг авч байна...";
    const blob = await captureImage();

    stopCamera();

    if (statusText) statusText.textContent = "Зургийг backend рүү илгээж байна...";
    if (scanText) scanText.textContent = "Түр хүлээнэ үү";

    const result = await sendDetection(blob);

    if (!result || !result.data) {
      const detail = result?.detail;
      const msg = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map(d => d.msg || String(d)).join(", ")
          : "Backend алдааны хариу ирлээ. Console дээр харна уу.";
      throw new Error(msg);
    }

    const data = result.data;

    if (
      data.status === "unsupported" ||
      data.status === "multiple_items" ||
      data.status === "no_detection" ||
      data.status === "bin_not_found"
    ) {
      handleError(data);
      return;
    }

    renderResult(data);
    fetchBinStatus();

  } catch (error) {
    console.error("Detection flow error:", error);

    stopCamera();

    document.getElementById("countdownOverlay")?.classList.add("hidden");

    setErrorMode(
      "Системийн алдаа",
      error.message || "Танилт хийх үед алдаа гарлаа.",
      "Browser console болон backend terminal дээрх алдааг шалгана уу.",
      "Дахин оролдох"
    );

    showScreen("error");
  } finally {
    if (detectBtn) detectBtn.disabled = false;
  }
}

async function submitFeedback(
  wasCorrect,
  correctedBinType = null
) {

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
    console.error(error);
  }

  resetResultUI();

  showScreen("idle");
}

function openBinDetail(binType) {
  const d = binDetailData[binType] || {};
  const api = binApiData[binType] || {};
  const count = api.item_count ?? (parseInt(document.getElementById(`badge-${binType}`)?.textContent) || 0);

  document.getElementById("detailIcon").src = binImages[binType] || "";
  document.getElementById("detailTypeTag").textContent = d.typeTag || binType;
  document.getElementById("detailTitle").textContent = binLabels[binType] || binType;
  document.getElementById("detailSub").textContent = binSub[binType] || "";

  const orb = document.getElementById("detailOrbEl");
  if (orb) orb.style.background = binOrbBg[binType] || "#eee";

  document.getElementById("detailItemCount").textContent = count;
  document.getElementById("detailPurposeText").textContent = d.purpose || "";

  const tipsList = document.getElementById("detailTipsList");
  if (tipsList) {
    tipsList.innerHTML = (d.tips || []).map(t => `<li>${t}</li>`).join("");
  }

  showScreen("binDetail");
}

document.getElementById("detectBtn")
  ?.addEventListener("click", startDetection);

document.getElementById("helpBtn")
  ?.addEventListener("click", () => {
    showScreen("help");
  });

document.getElementById("aboutBtn")
  ?.addEventListener("click", () => {
    showScreen("about");
  });

document.getElementById("donateBtn")
  ?.addEventListener("click", () => {
    showScreen("donate");
  });

document.getElementById("multiContinueBtn")
  ?.addEventListener("click", () => {
    resetScanState();
    showScreen("idle");
  });

document.getElementById("tryAgainBtn")
  ?.addEventListener("click", () => {

    const title =
      document.getElementById("errorTitle")
        ?.textContent || "";

    if (
      title.includes("Тусгай") ||
      title.includes("Сав")
    ) {
      showScreen("idle");
    }

    else {
      startDetection();
    }
  });

document.getElementById("resultHomeBtn")
  ?.addEventListener("click", () => {
    resetScanState();
    showScreen("idle");
  });

document.getElementById("feedbackYesBtn")
  ?.addEventListener("click", () => {
    submitFeedback(true);
  });

document.getElementById("feedbackNoBtn")
  ?.addEventListener("click", () => {

    document.getElementById("correctBinSelect")
      ?.classList.remove("hidden");
  });

document.querySelectorAll(".mini-bin")
  .forEach(btn => {

    btn.addEventListener("click", () => {

      submitFeedback(
        false,
        btn.dataset.correctBin
      );

    });

  });

document.querySelectorAll(".bin-card")
  .forEach(card => {

    card.addEventListener("click", () => {
      openBinDetail(card.dataset.bin);
    });

  });

document.querySelectorAll(".back-btn")
  .forEach(btn => {

    btn.addEventListener("click", () => {
      showScreen(btn.dataset.back || "idle");
    });

  });

fetchBinStatus();

setInterval(fetchBinStatus, 30000);