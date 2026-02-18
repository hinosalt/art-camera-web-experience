// カメラを使わない完全ローカル生成アート。外部AIは使用しません。

const startButton = document.getElementById("startBtn");
const stopButton = document.getElementById("stopBtn");
const modeSelect = document.getElementById("modeSelect");
const intensityRange = document.getElementById("intensityRange");
const refreshWeatherButton = document.getElementById("refreshWeatherBtn");
const statusText = document.getElementById("statusText");
const dateTimeText = document.getElementById("dateTimeText");
const weatherText = document.getElementById("weatherText");
const weatherFactorText = document.getElementById("weatherFactor");
const weatherLocationText = document.getElementById("weatherLocationText");
const weatherSourceText = document.getElementById("weatherSourceText");
const weatherFactorValue = document.getElementById("weatherFactorValue");
const windBiasValue = document.getElementById("windBiasValue");
const tempBiasValue = document.getElementById("tempBiasValue");
const dayProgressValue = document.getElementById("dayProgressValue");
const cursorSignalValue = document.getElementById("cursorSignalValue");
const influenceText = document.getElementById("influenceText");

const visionCanvas = document.getElementById("visionCanvas");
const visionCtx = visionCanvas.getContext("2d", { alpha: false });
const cursorMarker = document.getElementById("cursorMarker");

const artCanvas = document.createElement("canvas");
const artCtx = artCanvas.getContext("2d", { alpha: false });

let animationId = 0;
let isRunning = false;
let procWidth = 0;
let procHeight = 0;
let frameData = null;
let previousFrame = null;
let cursorX = 0.5;
let cursorY = 0.5;
let cursorStrength = 0;
let cursorDrag = 0;
let cursorTargetX = 0.5;
let cursorTargetY = 0.5;
let cursorTargetStrength = 0;
let cursorTargetDrag = 0;
let weatherSource = "未取得";
let weather = {
  temp: null,
  code: null,
  windspeed: null,
};
setWeatherSource(weatherSource);

const weatherNames = {
  0: "快晴",
  1: "主に晴れ",
  2: "部分的に曇り",
  3: "曇り",
  45: "霧",
  48: "霧が濃い",
  51: "弱い霧雨",
  53: "霧雨",
  55: "強い霧雨",
  61: "小雨",
  63: "雨",
  65: "大雨",
  71: "小雪",
  73: "雪",
  75: "大雪",
  80: "にわか雨",
  81: "雨",
  82: "豪雨",
  95: "雷雨",
  96: "雷雨（雹）",
  99: "雷雨（雹）",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hslToRgba(h, s, l, a = 255) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  const chunk = Math.floor(h / 60) % 6;
  let r;
  let g;
  let b;

  if (chunk === 0) {
    r = c;
    g = x;
    b = 0;
  } else if (chunk === 1) {
    r = x;
    g = c;
    b = 0;
  } else if (chunk === 2) {
    r = 0;
    g = c;
    b = x;
  } else if (chunk === 3) {
    r = 0;
    g = x;
    b = c;
  } else if (chunk === 4) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
    a,
  ];
}

function pseudoNoise(seedX, seedY, seedT) {
  const v = Math.sin(seedX * 12.9898 + seedY * 78.233 + seedT * 43758.5453) * 43758.5453;
  return v - Math.floor(v);
}

function smoothBlend(value, target, ratio) {
  return value * (1 - ratio) + target * ratio;
}

function dayOfYear(now) {
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function setSafeText(element, message) {
  if (!element) {
    return;
  }
  element.textContent = message;
}

function setWeatherSource(message) {
  weatherSource = message;
  setSafeText(weatherSourceText, message);
}

function signalText(value, fallback = "-") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return value.toFixed(2);
}

function normalizeWeatherCode(code) {
  if (code === null || code === undefined) {
    return 1;
  }

  if ([95, 96, 99].includes(code)) {
    return 4;
  }
  if (code >= 80) {
    return 3;
  }
  if (code >= 61) {
    return 2.2;
  }
  if (code >= 71) {
    return 1.5;
  }
  if (code >= 51) {
    return 1.8;
  }
  if (code >= 45) {
    return 1.3;
  }

  return 1;
}

function weatherLabel(code, temp, windspeed) {
  if (code == null) {
    return "位置情報未許可または取得失敗（時間ベースで再生）";
  }

  const weatherName = weatherNames[code] || `条件コード ${code}`;
  const tempText = temp == null ? "温度取得不可" : `${temp.toFixed(1)}℃`;
  const windText = windspeed == null ? "風速不明" : `${windspeed.toFixed(1)}m/s`;
  return `${weatherName} / ${tempText} / 風速${windText}`;
}

function refreshInfo(now = new Date()) {
  const date = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const time = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  dateTimeText.textContent = `${date} ${time}`;
}

function updateWeatherLocation(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") {
    setSafeText(weatherLocationText, "位置情報なし");
    return;
  }
  setSafeText(weatherLocationText, `${lat.toFixed(3)}, ${lon.toFixed(3)}`);
}

function clampPointer(event) {
  const rect = visionCanvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function applyCursorFromPointer(event, dragging) {
  const point = clampPointer(event);
  if (!point) {
    return;
  }

  cursorTargetX = point.x;
  cursorTargetY = point.y;
  cursorTargetStrength = dragging ? 0.9 : 0.55;
  cursorTargetDrag = dragging ? 1 : 0;
}

function updateCursorMarker(event, dragging) {
  if (!cursorMarker) {
    return;
  }

  const point = clampPointer(event);
  if (!point) {
    cursorMarker.classList.remove("active");
    return;
  }

  cursorMarker.style.left = `${Math.round(point.x * visionCanvas.clientWidth)}px`;
  cursorMarker.style.top = `${Math.round(point.y * visionCanvas.clientHeight)}px`;
  cursorMarker.classList.add("active");
  cursorMarker.classList.toggle("dragging", dragging);
}

function clearCursorTarget() {
  cursorTargetStrength = 0;
  cursorTargetDrag = 0;
}

function resizeCanvases() {
  const targetWidth = Math.min(1200, Math.max(300, window.innerWidth - 64));
  const targetHeight = Math.max(220, Math.round(targetWidth * 9 / 16));

  visionCanvas.width = targetWidth;
  visionCanvas.height = targetHeight;

  procWidth = Math.max(240, Math.round(targetWidth / 5));
  procHeight = Math.max(140, Math.round(targetHeight / 5));

  artCanvas.width = procWidth;
  artCanvas.height = procHeight;
  frameData = artCtx.createImageData(procWidth, procHeight);
  previousFrame = new Uint8ClampedArray(frameData.data.length);
}

function renderWeatherInfo() {
  const factor = normalizeWeatherCode(weather.code);
  weatherText.textContent = weatherLabel(weather.code, weather.temp, weather.windspeed);
  weatherFactorText.textContent = factor.toFixed(2);
}

function getWeatherSignals(now) {
  const totalMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const dayProgress = clamp(totalMinutes / (24 * 60), 0, 1);
  const weatherFactor = normalizeWeatherCode(weather.code);
  const windBias = weather.windspeed == null ? 1 : clamp(1 + weather.windspeed / 45, 1, 2.4);
  const tempBias = weather.temp == null ? 1 : clamp(0.82 + weather.temp / 45, 0.45, 1.75);
  const weatherWeight = weatherFactor * 0.55 + windBias * 0.27 + tempBias * 0.18;
  const dayWeight = 0.78 + dayProgress * 0.44;
  const combinedWeather = weatherWeight * dayWeight;

  return {
    dayProgress,
    weatherFactor,
    windBias,
    tempBias,
    weatherWeight,
    dayWeight,
    combinedWeather,
  };
}

function updateInsightValues(signals, cursorSignal) {
  setSafeText(weatherFactorValue, signalText(signals.weatherFactor));
  setSafeText(windBiasValue, signalText(signals.windBias));
  setSafeText(tempBiasValue, signalText(signals.tempBias));
  setSafeText(dayProgressValue, `${signalText(signals.dayProgress * 100)}%`);
  setSafeText(cursorSignalValue, signalText(cursorSignal));
  setSafeText(
    influenceText,
    `weatherWeight=${signalText(signals.weatherWeight)} / dayWeight=${signalText(signals.dayWeight)} / total=${signalText(signals.combinedWeather)}`,
  );
}

async function fetchWeather() {
  weatherText.textContent = "天気を取得中...";
  weatherFactorText.textContent = "...";
  setWeatherSource("位置情報を確認中…");

  if (!navigator.geolocation) {
    setStatus("この環境では位置情報を使えないため、時間要素のみで表現します。");
    setWeatherSource("位置情報API非対応（時間ベース）");
    weatherText.textContent = "位置情報API非対応";
    weatherFactorText.textContent = "1.00";
    updateWeatherLocation(null, null);
    weather = { temp: null, code: null, windspeed: null };
    return;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          updateWeatherLocation(latitude, longitude);
          setWeatherSource("現在地で天気取得中");
          const weatherURL = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`;

          const response = await fetch(weatherURL);
          if (!response.ok) {
            throw new Error("天気取得エラー");
          }

          const payload = await response.json();
          const w = payload.current_weather || {};
          weather = {
            temp: typeof w.temperature === "number" ? w.temperature : null,
            code: typeof w.weathercode === "number" ? w.weathercode : null,
            windspeed: typeof w.windspeed === "number" ? w.windspeed : null,
          };
          setWeatherSource("現在地から取得成功");
        } catch (error) {
          setWeatherSource("現在地は取得できたが天気情報取得失敗（時間ベース）");
          weather = { temp: null, code: null, windspeed: null };
          console.error(error);
          weatherText.textContent = "天気取得失敗（時間要素で継続）";
          weatherFactorText.textContent = "1.00";
        }

        renderWeatherInfo();
        resolve();
      },
      (error) => {
        const reasonText =
          error && error.code === 1
            ? "位置情報許可なし（時間ベース）"
            : error && error.code === 2
              ? "位置情報取得不可（時間ベース）"
              : error && error.code === 3
                ? "位置情報タイムアウト（時間ベース）"
                : "位置情報取得失敗（時間ベース）";

        weather = { temp: null, code: null, windspeed: null };
        updateWeatherLocation(null, null);
        setWeatherSource(reasonText);
        setStatus(`${reasonText}。時間ベースで再生します。`);
        renderWeatherInfo();
        resolve();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 180000 },
    );
  });
}

function atmosphereBlend(x, y, time, mode, intensity, signals, now, cursorXValue, cursorYValue, cursorStrengthValue, cursorDragValue) {
  const i = intensity / 100;
  const dayProgress = signals.dayProgress;
  const totalMinutes = dayProgress * 24 * 60;
  const doy = dayOfYear(now);
  const secondOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
  const t = secondOfDay + x * 0.0008 + y * 0.0008;
  const drift = Math.sin(t * 0.12 + mode.length);
  const noise = pseudoNoise(x * 0.05 + t * 0.004, y * 0.05 + t * 0.004, (mode.length + i) * 6.2);

  const weatherFactor = signals.weatherFactor;
  const windBias = signals.windBias;
  const tempBias = signals.tempBias;
  const weatherWeight = signals.weatherWeight;

  let baseHue;
  let sat;
  let light;

  if (mode === "sunrise") {
    baseHue = (206 + noise * 84 + Math.sin(dayProgress * Math.PI * 2) * 16 + doy * 0.4 + tempBias * 8 + drift * 9 + windBias * 7) % 360;
    sat = 28 + 34 * i + weatherWeight * 5.5 + weatherFactor * 2;
    light = 35 + 14 * dayProgress + 8 * noise;
  } else if (mode === "storm") {
    baseHue = (170 + (x * 0.9 + y * 0.55 + time * 0.001 + i * 90) * 0.22 + drift * 8) % 360;
    sat = 34 + weatherWeight * 6 + i * 8 + windBias * 5;
    light = 24 + noise * 14 + Math.sin(t * 0.22 + x * 0.05) * 2.5 + weatherFactor * 2.8;
  } else {
    const aurora = Math.sin((x * 0.08 + t * 0.1) + Math.cos(y * 0.04 + now.getMinutes() * 0.2));
    baseHue = (192 + aurora * 32 + y * 0.28 + dayProgress * 90 + weatherWeight * 9 + tempBias * 2.4) % 360;
    sat = 42 + i * 11 + weatherWeight * 7;
    light = 32 + 13 * Math.sin(noise * Math.PI * 2 + dayProgress * Math.PI * 2) + windBias * 2.4 + tempBias * 0.8;
  }

  const jitter = Math.sin((x + y) * 0.045 + time * 0.001 * windBias + Math.cos(dayProgress * Math.PI * 2) + drift) * (5 + weatherWeight * 0.8);
  const orbit = (Math.sin((x * 0.02 + jitter * 0.2) + time * 0.0003 + i * 1.1) + Math.cos((y * 0.02 - jitter * 0.2) - totalMinutes * 0.008)) * (0.32 + weatherWeight * 0.045);
  const cursorDist = Math.hypot((x / procWidth) - cursorXValue, (y / procHeight) - cursorYValue);
  const cursorPulse = Math.exp(-cursorDist * 6.1) * cursorStrengthValue * (1 + cursorDragValue * 0.6);
  const cursorFlow = Math.sin((x + y) * 0.06 + time * 0.001 * (1 + cursorDragValue) + cursorDist * 4) * cursorPulse;

  return {
    r: baseHue,
    g: orbit * 18 + sat + cursorFlow * 12,
    b: light + jitter + windBias * 2.6 + cursorPulse * 5.2,
    sat,
    light: clamp(light + orbit * 8 + cursorFlow * 0.8, 10, 95),
    cursor: cursorPulse,
  };
}

function draw(time) {
  if (!isRunning) {
    return;
  }

  const now = new Date();
  const mode = modeSelect.value;
  const intensity = Number(intensityRange.value);
  const signals = getWeatherSignals(now);
  const factor = signals.combinedWeather;
  const secondOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
  const timeSlow = secondOfDay * 0.08;
  const output = frameData.data;
  cursorX = smoothBlend(cursorX, cursorTargetX, 0.12);
  cursorY = smoothBlend(cursorY, cursorTargetY, 0.12);
  cursorStrength = smoothBlend(cursorStrength, cursorTargetStrength, 0.05);
  cursorDrag = smoothBlend(cursorDrag, cursorTargetDrag, 0.08);
  const cursorSignal = Math.max(0, cursorStrength) * 0.9;

  refreshInfo(now);
  renderWeatherInfo();
  updateInsightValues(signals, cursorSignal);

  for (let y = 0; y < procHeight; y += 1) {
    for (let x = 0; x < procWidth; x += 1) {
      const idx = (y * procWidth + x) * 4;
      const amp = atmosphereBlend(x, y, timeSlow, mode, intensity, signals, now, cursorX, cursorY, cursorStrength, cursorDrag);
      const cursorPulse = amp.cursor * (1 + cursorDrag * 0.4);

      const swirl = Math.sin((x * 0.045 + timeSlow * 0.03 * factor) + Math.cos(y * 0.03 - timeSlow * 0.02) + cursorPulse * 0.24);
      const wave = Math.cos((y * 0.038 + timeSlow * 0.025 + mode.length) * factor) * 10 + cursorPulse * 3.2;

      const hue = (amp.r + swirl * 18 + wave) % 360;
      const sat = clamp(amp.sat + intensity * 0.20 + factor * 3.2 + cursorPulse * 16, 16, 74);
      const light = clamp(amp.light + intensity * 0.11 + swell(now) + cursorPulse * 5, 8, 68);

      const color = hslToRgba((hue + 360) % 360, sat, light);
      const edge = Math.sin((x / procWidth) * Math.PI * 2) * Math.cos((y / procHeight) * Math.PI * 2);
      const fade = ((x + y) % 60) / 120 + 0.7;

      const target = [
        clamp(color[0] + edge * 18 * fade, 0, 255),
        clamp(color[1] + edge * 7 * fade, 0, 255),
        clamp(color[2] + edge * 14 * fade, 0, 255),
      ];

      output[idx] = smoothBlend(output[idx], target[0], 0.8);
      output[idx + 1] = smoothBlend(output[idx + 1], target[1], 0.8);
      output[idx + 2] = smoothBlend(output[idx + 2], target[2], 0.8);

      if (previousFrame) {
        output[idx] = clamp(smoothBlend(output[idx], previousFrame[idx], 0.88), 0, 255);
        output[idx + 1] = clamp(smoothBlend(output[idx + 1], previousFrame[idx + 1], 0.88), 0, 255);
        output[idx + 2] = clamp(smoothBlend(output[idx + 2], previousFrame[idx + 2], 0.88), 0, 255);
      }

      output[idx + 3] = 255;
    }
  }

  artCtx.putImageData(frameData, 0, 0);
  if (previousFrame) {
    previousFrame.set(output);
  }
  visionCtx.imageSmoothingEnabled = true;
  visionCtx.filter = `brightness(${1 + (intensity / 100) * 0.06})`;
  visionCtx.drawImage(artCanvas, 0, 0, visionCanvas.width, visionCanvas.height);
  visionCtx.filter = "none";

  if (cursorSignal > 0.15) {
    statusText.textContent = `動作中: ${modeLabel(mode)} / 強度 ${intensity}% / weather x ${factor.toFixed(2)} / カーソル ${Math.round(cursorSignal * 100)}%`;
  } else {
    statusText.textContent = `動作中: ${modeLabel(mode)} / 強度 ${intensity}% / weather x ${factor.toFixed(2)}`;
  }
  animationId = requestAnimationFrame(draw);
}

function swell(now) {
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return 6 + 2 * Math.sin((seconds / 86400) * Math.PI * 2);
}

function modeLabel(value) {
  if (value === "sunrise") {
    return "夜明けの波";
  }
  if (value === "storm") {
    return "嵐のノイズ";
  }
  return "オーロラ";
}

function setStatus(message) {
  statusText.textContent = message;
}

function startArt() {
  if (isRunning) {
    return;
  }

  isRunning = true;
  startButton.disabled = true;
  stopButton.disabled = false;
  setStatus("生成を開始します...");
  setWeatherSource("位置情報取得を待機中");

  resizeCanvases();
  if (previousFrame) {
    previousFrame.fill(0);
  }
  refreshInfo();
  fetchWeather();
  animationId = requestAnimationFrame(draw);
}

function stopArt() {
  if (!isRunning) {
    return;
  }

  isRunning = false;
  startButton.disabled = false;
  stopButton.disabled = true;
  cancelAnimationFrame(animationId);
  if (previousFrame) {
    previousFrame.fill(0);
  }
  visionCtx.clearRect(0, 0, visionCanvas.width, visionCanvas.height);
  if (cursorMarker) {
    cursorMarker.classList.remove("active", "dragging");
  }
  setStatus("停止しました。再開してください。");
}

function onCanvasPointerMove(event) {
  applyCursorFromPointer(event, cursorTargetDrag > 0.5);
  updateCursorMarker(event, cursorTargetDrag > 0.5);
}

function onCanvasPointerDown(event) {
  visionCanvas.setPointerCapture(event.pointerId);
  applyCursorFromPointer(event, true);
  updateCursorMarker(event, true);
}

function onCanvasPointerUp(event) {
  try {
    if (visionCanvas.hasPointerCapture(event.pointerId)) {
      visionCanvas.releasePointerCapture(event.pointerId);
    }
  } catch {
    // ignore browsers that don't support release in this state
  }

  cursorTargetDrag = 0;
  clearCursorTarget();
  if (cursorMarker) {
    cursorMarker.classList.remove("dragging");
  }
}

function onCanvasPointerLeave() {
  clearCursorTarget();
  if (cursorMarker) {
    cursorMarker.classList.remove("active", "dragging");
  }
}

function refreshWeatherNow() {
  fetchWeather();
}

startButton.addEventListener("click", startArt);
stopButton.addEventListener("click", stopArt);
refreshWeatherButton?.addEventListener("click", refreshWeatherNow);

visionCanvas.addEventListener("pointermove", onCanvasPointerMove);
visionCanvas.addEventListener("pointerdown", onCanvasPointerDown);
visionCanvas.addEventListener("pointerup", onCanvasPointerUp);
visionCanvas.addEventListener("pointercancel", onCanvasPointerUp);
visionCanvas.addEventListener("pointerleave", onCanvasPointerLeave);
visionCanvas.addEventListener("pointerover", onCanvasPointerMove);

window.addEventListener("resize", () => {
  if (isRunning) {
    resizeCanvases();
  }
});
