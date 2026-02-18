// カメラを使わない完全ローカル生成アート。外部AIは使用しません。

const startButton = document.getElementById("startBtn");
const stopButton = document.getElementById("stopBtn");
const modeSelect = document.getElementById("modeSelect");
const intensityRange = document.getElementById("intensityRange");
const statusText = document.getElementById("statusText");
const dateTimeText = document.getElementById("dateTimeText");
const weatherText = document.getElementById("weatherText");
const weatherFactorText = document.getElementById("weatherFactor");

const visionCanvas = document.getElementById("visionCanvas");
const visionCtx = visionCanvas.getContext("2d", { alpha: false });

const artCanvas = document.createElement("canvas");
const artCtx = artCanvas.getContext("2d", { alpha: false });

let animationId = 0;
let isRunning = false;
let procWidth = 0;
let procHeight = 0;
let frameData = null;
let weather = {
  temp: null,
  code: null,
  windspeed: null,
};

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

function dayOfYear(now) {
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
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
}

function renderWeatherInfo() {
  const factor = normalizeWeatherCode(weather.code);
  weatherText.textContent = weatherLabel(weather.code, weather.temp, weather.windspeed);
  weatherFactorText.textContent = factor.toFixed(2);
}

async function fetchWeather() {
  weatherText.textContent = "天気を取得中...";
  weatherFactorText.textContent = "...";

  if (!navigator.geolocation) {
    setStatus("この環境では位置情報を使えないため、時間要素のみで表現します。");
    weatherText.textContent = "位置情報API非対応";
    weatherFactorText.textContent = "1.00";
    weather = { temp: null, code: null, windspeed: null };
    return;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
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
        } catch (error) {
          weather = { temp: null, code: null, windspeed: null };
          console.error(error);
          weatherText.textContent = "天気取得失敗（時間要素で継続）";
          weatherFactorText.textContent = "1.00";
        }

        renderWeatherInfo();
        resolve();
      },
      () => {
        weather = { temp: null, code: null, windspeed: null };
        setStatus("位置情報を許可しない設定です。時間ベース表現で継続します。");
        renderWeatherInfo();
        resolve();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 180000 },
    );
  });
}

function atmosphereBlend(x, y, time, mode, intensity, now) {
  const i = intensity / 100;
  const totalMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const dayProgress = totalMinutes / (24 * 60);
  const doy = dayOfYear(now);
  const noise = pseudoNoise((x + time * 0.001) * 0.02, (y + time * 0.001) * 0.02, (mode.length + i) * 42.2);

  const weatherFactor = normalizeWeatherCode(weather.code);
  const windBias = weather.windspeed == null ? 1 : 1 + weather.windspeed / 40;
  const tempBias = weather.temp == null ? 0 : weather.temp / 40;

  let baseHue;
  let sat;
  let light;

  if (mode === "sunrise") {
    baseHue = (240 + noise * 160 + Math.sin(dayProgress * Math.PI * 2 + i) * 30 + doy * 0.7 + tempBias * 15) % 360;
    sat = 55 + 30 * i + weatherFactor * 10;
    light = 25 + 45 * dayProgress + 12 * noise;
  } else if (mode === "storm") {
    baseHue = (120 + (x * 1.5 + y * 0.8 + time * 0.06 + i * 120) * 0.35) % 360;
    sat = 75 + weatherFactor * 12 + i * 8;
    light = 15 + (noise * 50) + Math.sin(time * 0.003 + x * 0.1) * 12 + weatherFactor * 4;
  } else {
    const aurora = Math.sin((x * 0.08 + time * 0.002) + Math.cos(y * 0.05 + now.getMinutes() * 0.2));
    baseHue = (170 + aurora * 60 + y * 0.5 + dayProgress * 140 + weatherFactor * 25) % 360;
    sat = 70 + i * 20 + weatherFactor * 14;
    light = 28 + 32 * Math.sin(noise * Math.PI * 2 + dayProgress * Math.PI * 2) + 8 * windBias;
  }

  const jitter = Math.sin((x + y) * 0.09 + time * 0.004 * windBias + Math.cos(dayProgress * Math.PI * 2)) * 12;
  const orbit = (Math.sin((x * 0.03 + jitter) + time * 0.001 + i * 1.5) + Math.cos((y * 0.02 - jitter) - totalMinutes * 0.03)) * 0.5;

  return {
    r: baseHue,
    g: orbit * 22 + sat,
    b: light + jitter + windBias * 3,
    sat,
    light: clamp(light + orbit * 8, 10, 95),
  };
}

function draw(time) {
  if (!isRunning) {
    return;
  }

  const now = new Date();
  const mode = modeSelect.value;
  const intensity = Number(intensityRange.value);
  const factor = normalizeWeatherCode(weather.code) * (1 + (weather.windspeed || 0) / 60);
  const output = frameData.data;

  refreshInfo(now);
  renderWeatherInfo();

  for (let y = 0; y < procHeight; y += 1) {
    for (let x = 0; x < procWidth; x += 1) {
      const idx = (y * procWidth + x) * 4;
      const amp = atmosphereBlend(x, y, time, mode, intensity, now);

      const swirl = Math.sin((x * 0.09 + time * 0.0009 * factor) + Math.cos(y * 0.06 - time * 0.0012));
      const wave = Math.cos((y * 0.08 + time * 0.001 + mode.length) * factor) * 18;

      const hue = (amp.r + swirl * 35 + wave + now.getMilliseconds() * 0.01) % 360;
      const sat = amp.sat + intensity * 0.4 + factor * 8;
      const light = amp.light + intensity * 0.2 + swell(now);

      const color = hslToRgba((hue + 360) % 360, clamp(sat, 20, 95), clamp(light, 5, 92));
      const edge = Math.sin((x / procWidth) * Math.PI * 2) * Math.cos((y / procHeight) * Math.PI * 2);
      const fade = ((x + y) % 60) / 120 + 0.7;

      output[idx] = clamp(color[0] + edge * 30 * fade, 0, 255);
      output[idx + 1] = clamp(color[1] + edge * 12 * fade, 0, 255);
      output[idx + 2] = clamp(color[2] + edge * 25 * fade, 0, 255);
      output[idx + 3] = 255;
    }
  }

  artCtx.putImageData(frameData, 0, 0);
  visionCtx.imageSmoothingEnabled = true;
  visionCtx.filter = `brightness(${1 + (intensity / 100) * 0.2})`;
  visionCtx.drawImage(artCanvas, 0, 0, visionCanvas.width, visionCanvas.height);
  visionCtx.filter = "none";

  statusText.textContent = `動作中: ${modeLabel(mode)} / 強度 ${intensity}% / weather x ${factor.toFixed(2)}`;
  animationId = requestAnimationFrame(draw);
}

function swell(now) {
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return 10 * Math.sin((seconds / 86400) * Math.PI * 2) + 8;
}

function modeLabel(value) {
  if (value === "sunrise") {
    return "夜明けの波";
  }
  if (value === "storm") {
    return "嵐のノイズ";
  }
  return "オーロラスピリット";
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

  resizeCanvases();
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
  visionCtx.clearRect(0, 0, visionCanvas.width, visionCanvas.height);
  setStatus("停止しました。再開してください。");
}

startButton.addEventListener("click", startArt);
stopButton.addEventListener("click", stopArt);

window.addEventListener("resize", () => {
  if (isRunning) {
    resizeCanvases();
  }
});
