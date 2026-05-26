// Type definitions
import { t, tArray, setLanguage, getLanguage, loadLanguage, languageIcons, getNextLanguage } from './i18n';

interface ThemeConfig {
  bg: string;
  border: string;
  hand: string;
  secondHand: string;
  tick: string;
  number: string;
}

interface TimezoneInfo {
  name: string;
  zone: string;
  offset: string;
}

// State
let currentTheme: string = 'light';
let is24Hour: boolean = true;
let selectedTimezone: string = 'local';
let clockSize: number = 480;
let cachedCanvasSize: number = 0;

// Cached Intl formatters for performance
const intlFormatterCache: Map<string, Intl.DateTimeFormat> = new Map();
const timezoneListFormatterCache: Map<string, Intl.DateTimeFormat> = new Map();

function getClockIntlFormatter(timezone: string): Intl.DateTimeFormat {
  const key = `${timezone}_clock`;
  if (!intlFormatterCache.has(key)) {
    intlFormatterCache.set(key, new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    }));
  }
  return intlFormatterCache.get(key)!;
}

function getTimezoneListFormatter(timezone: string, hour12: boolean): Intl.DateTimeFormat {
  const key = `${timezone}_list_${hour12 ? '12' : '24'}`;
  if (!timezoneListFormatterCache.has(key)) {
    timezoneListFormatterCache.set(key, new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12,
    }));
  }
  return timezoneListFormatterCache.get(key)!;
}


// Stopwatch state
let stopwatchRunning: boolean = false;
let stopwatchStartTime: number = 0;
let stopwatchElapsed: number = 0;
let stopwatchInterval: number | null = null;
let lapCount: number = 0;

// Countdown state
let countdownRunning: boolean = false;
let countdownTotal: number = 0;
let countdownRemaining: number = 0;
let countdownInterval: number | null = null;

// DOM Elements
const canvas = document.getElementById('clock-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement;
const formatBtn = document.getElementById('format-btn') as HTMLButtonElement;
const langBtn = document.getElementById('lang-btn') as HTMLButtonElement;
const timezoneDisplay = document.getElementById('timezone-display') as HTMLDivElement;
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.panel');
const sizeSlider = document.getElementById('clock-size-slider') as HTMLInputElement;

// Stopwatch elements
const swDisplay = document.getElementById('stopwatch-display') as HTMLDivElement;
const swStartBtn = document.getElementById('sw-start') as HTMLButtonElement;
const swLapBtn = document.getElementById('sw-lap') as HTMLButtonElement;
const swResetBtn = document.getElementById('sw-reset') as HTMLButtonElement;
const lapList = document.getElementById('lap-list') as HTMLDivElement;

// Countdown elements
const cdDisplay = document.getElementById('countdown-display') as HTMLDivElement;
const cdHoursInput = document.getElementById('cd-hours') as HTMLInputElement;
const cdMinutesInput = document.getElementById('cd-minutes') as HTMLInputElement;
const cdSecondsInput = document.getElementById('cd-seconds') as HTMLInputElement;
const cdStartBtn = document.getElementById('cd-start') as HTMLButtonElement;
const cdResetBtn = document.getElementById('cd-reset') as HTMLButtonElement;

// Timezone data
const timezoneNames: Record<string, Record<string, string>> = {
  local: { zh: '本地时间', en: 'Local Time', ja: 'ローカル時刻', ko: '로컬 시간' },
  'Asia/Shanghai': { zh: '北京时间', en: 'Beijing Time', ja: '北京時間', ko: '베이징 시간' },
  'Asia/Tokyo': { zh: '东京时间', en: 'Tokyo Time', ja: '東京時間', ko: '도쿄 시간' },
  'Asia/Seoul': { zh: '首尔时间', en: 'Seoul Time', ja: 'ソウル時間', ko: '서울 시간' },
  'Asia/Bangkok': { zh: '曼谷时间', en: 'Bangkok Time', ja: 'バンコク時間', ko: '방콕 시간' },
  'Asia/Kolkata': { zh: '孟买时间', en: 'Mumbai Time', ja: 'ムンバイ時間', ko: '뭄바이 시간' },
  'Asia/Dubai': { zh: '迪拜时间', en: 'Dubai Time', ja: 'ドバイ時間', ko: '두바이 시간' },
  'Europe/Moscow': { zh: '莫斯科时间', en: 'Moscow Time', ja: 'モスクワ時間', ko: '모스크바 시간' },
  'Europe/London': { zh: '伦敦时间', en: 'London Time', ja: 'ロンドン時間', ko: '런던 시간' },
  'Europe/Paris': { zh: '巴黎时间', en: 'Paris Time', ja: 'パリ時間', ko: '파리 시간' },
  'America/New_York': { zh: '纽约时间', en: 'New York Time', ja: 'ニューヨーク時間', ko: '뉴욕 시간' },
  'America/Los_Angeles': { zh: '洛杉矶时间', en: 'Los Angeles Time', ja: 'ロサンゼルス時間', ko: '로스앤젤레스 시간' },
  'Australia/Sydney': { zh: '悉尼时间', en: 'Sydney Time', ja: 'シドニー時間', ko: '시드니 시간' },
};

const timezones: TimezoneInfo[] = [
  { name: 'local', zone: 'local', offset: '本地' },
  { name: 'Asia/Shanghai', zone: 'Asia/Shanghai', offset: 'UTC+8' },
  { name: 'Asia/Tokyo', zone: 'Asia/Tokyo', offset: 'UTC+9' },
  { name: 'Asia/Seoul', zone: 'Asia/Seoul', offset: 'UTC+9' },
  { name: 'Asia/Bangkok', zone: 'Asia/Bangkok', offset: 'UTC+7' },
  { name: 'Asia/Kolkata', zone: 'Asia/Kolkata', offset: 'UTC+5:30' },
  { name: 'Asia/Dubai', zone: 'Asia/Dubai', offset: 'UTC+4' },
  { name: 'Europe/Moscow', zone: 'Europe/Moscow', offset: 'UTC+3' },
  { name: 'Europe/London', zone: 'Europe/London', offset: 'UTC+0' },
  { name: 'Europe/Paris', zone: 'Europe/Paris', offset: 'UTC+1' },
  { name: 'America/New_York', zone: 'America/New_York', offset: 'UTC-5' },
  { name: 'America/Los_Angeles', zone: 'America/Los_Angeles', offset: 'UTC-8' },
  { name: 'Australia/Sydney', zone: 'Australia/Sydney', offset: 'UTC+10' },
];

function getTimezoneName(zone: string): string {
  const lang = getLanguage();
  return timezoneNames[zone]?.[lang] || timezoneNames[zone]?.['zh'] || zone;
}

// Load saved preferences from localStorage
function loadPreferences(): void {
  const savedTheme = localStorage.getItem('clock-theme');
  if (savedTheme) {
    currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme === 'dark' ? 'dark' : '');
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  const savedFormat = localStorage.getItem('clock-format');
  if (savedFormat) {
    is24Hour = savedFormat === '24';
    formatBtn.textContent = is24Hour ? '24H' : '12H';
  }

  const savedTimezone = localStorage.getItem('clock-timezone');
  if (savedTimezone) {
    selectedTimezone = savedTimezone;
  }

  const savedCountdown = localStorage.getItem('clock-countdown');
  if (savedCountdown) {
    const [h, m, s] = savedCountdown.split(':').map(Number);
    cdHoursInput.value = h.toString();
    cdMinutesInput.value = m.toString();
    cdSecondsInput.value = s.toString();
  }

  const savedSize = localStorage.getItem('clock-size');
  if (savedSize) {
    clockSize = parseInt(savedSize, 10);
  }

  const savedTab = localStorage.getItem('clock-tab');
  if (savedTab) {
    switchTab(savedTab);
  }
}

// Get theme colors
function getThemeColors(): ThemeConfig {
  const isDark = currentTheme === 'dark';
  return {
    bg: isDark ? '#16213e' : '#ffffff',
    border: isDark ? '#eee' : '#333',
    hand: isDark ? '#eee' : '#333',
    secondHand: isDark ? '#ff6b6b' : '#e74c3c',
    tick: isDark ? '#ccc' : '#555',
    number: isDark ? '#ddd' : '#444',
  };
}

// Initialize canvas size
function initCanvas(): void {
  const size = Math.min(clockSize, window.innerWidth - 40);
  cachedCanvasSize = size;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Cached timezone lookup to avoid .find() every frame
let cachedSelectedTz: TimezoneInfo | undefined;

function updateCachedTimezone(): void {
  cachedSelectedTz = timezones.find(tz => tz.zone === selectedTimezone);
}

// Draw the analog clock
function drawClock(date: Date): void {
  const size = cachedCanvasSize;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 10;

  const colors = getThemeColors();

  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Draw outer circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Draw hour markers
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6 - Math.PI / 2;
    const isQuarterHour = i % 3 === 0;
    const outerRadius = radius - 8;
    const innerRadius = isQuarterHour ? radius - 28 : radius - 18;

    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
    ctx.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
    ctx.strokeStyle = colors.tick;
    ctx.lineWidth = isQuarterHour ? 3 : 2;
    ctx.stroke();
  }

  // Draw minute markers
  for (let i = 0; i < 60; i++) {
    if (i % 5 !== 0) {
      const angle = (i * Math.PI) / 30 - Math.PI / 2;
      const outerRadius = radius - 8;
      const innerRadius = radius - 14;

      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
      ctx.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
      ctx.strokeStyle = colors.tick;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Draw numbers
  ctx.fillStyle = colors.number;
  ctx.font = `${size * 0.06}px 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const angle = (i * Math.PI) / 6 - Math.PI / 2;
    const numRadius = radius - 42;
    const x = centerX + Math.cos(angle) * numRadius;
    const y = centerY + Math.sin(angle) * numRadius;
    ctx.fillText(i.toString(), x, y);
  }

  // Get time components
  let hours: number, minutes: number, seconds: number, ms: number;
  let displayYear: number, displayMonth: number, displayDate: number, displayWeekday: number;
  
  if (selectedTimezone === 'local') {
    hours = date.getHours();
    minutes = date.getMinutes();
    seconds = date.getSeconds();
    ms = date.getMilliseconds();
    displayYear = date.getFullYear();
    displayMonth = date.getMonth();
    displayDate = date.getDate();
    displayWeekday = date.getDay();
  } else {
    const formatter = getClockIntlFormatter(selectedTimezone);
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
    hours = getPart('hour');
    minutes = getPart('minute');
    seconds = getPart('second');
    displayYear = getPart('year');
    displayMonth = getPart('month') - 1;
    displayDate = getPart('day');
    displayWeekday = date.getDay();
    ms = date.getMilliseconds();
  }

  // Calculate angles
  const secondAngle = ((seconds + ms / 1000) * Math.PI) / 30 - Math.PI / 2;
  const minuteAngle = ((minutes + seconds / 60) * Math.PI) / 30 - Math.PI / 2;
  const hourAngle = (((hours % 12) + minutes / 60) * Math.PI) / 6 - Math.PI / 2;

  // Draw hour hand
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(hourAngle) * (radius * 0.5),
    centerY + Math.sin(hourAngle) * (radius * 0.5)
  );
  ctx.strokeStyle = colors.hand;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Draw minute hand
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(minuteAngle) * (radius * 0.7),
    centerY + Math.sin(minuteAngle) * (radius * 0.7)
  );
  ctx.strokeStyle = colors.hand;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Draw second hand
  ctx.beginPath();
  ctx.moveTo(
    centerX - Math.cos(secondAngle) * (radius * 0.15),
    centerY - Math.sin(secondAngle) * (radius * 0.15)
  );
  ctx.lineTo(
    centerX + Math.cos(secondAngle) * (radius * 0.8),
    centerY + Math.sin(secondAngle) * (radius * 0.8)
  );
  ctx.strokeStyle = colors.secondHand;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Draw center dot
  ctx.beginPath();
  ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
  ctx.fillStyle = colors.secondHand;
  ctx.fill();

  // Draw center dot highlight
  ctx.beginPath();
  ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
  ctx.fillStyle = colors.bg;
  ctx.fill();

  // Draw date display below center
  const monthNames = tArray('monthNames');
  const weekdayNames = tArray('weekdayNames');
  const dateStr = `${displayYear}.${String(displayMonth + 1).padStart(2, '0')}.${String(displayDate).padStart(2, '0')} ${weekdayNames[displayWeekday] || ''}`;
  
  ctx.fillStyle = colors.number;
  ctx.font = `${size * 0.035}px 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(dateStr, centerX, centerY + radius * 0.35);

  // Update timezone display using cached lookup
  if (selectedTimezone === 'local') {
    timezoneDisplay.textContent = t('localTimeLabel');
  } else {
    timezoneDisplay.textContent = cachedSelectedTz ? `${t('timezoneDisplayLabel')} ${getTimezoneName(cachedSelectedTz.name)} (${cachedSelectedTz.offset})` : '';
  }
}

// Animation loop
function animate(): void {
  drawClock(new Date());
  requestAnimationFrame(animate);
}

// Format time for display
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

// Format countdown time
function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Theme toggle
themeBtn.addEventListener('click', (): void => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  themeBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('clock-theme', currentTheme);
});

// Format toggle
formatBtn.addEventListener('click', (): void => {
  is24Hour = !is24Hour;
  formatBtn.textContent = is24Hour ? '24H' : '12H';
  localStorage.setItem('clock-format', is24Hour ? '24' : '12');
  // Clear timezone list formatter cache since hour12 changed
  timezoneListFormatterCache.clear();
  renderTimezones();
});

// Tab switching
function switchTab(tab: string): void {
  tabBtns.forEach(b => b.classList.remove('active'));
  panels.forEach(p => p.classList.remove('active'));
  const targetBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (targetBtn) targetBtn.classList.add('active');
  const panel = document.getElementById(`${tab}-panel`);
  if (panel) panel.classList.add('active');
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', (): void => {
    const tab = btn.getAttribute('data-tab');
    if (!tab) return;
    switchTab(tab);
    localStorage.setItem('clock-tab', tab);
  });
});

// Stopwatch functions
function updateStopwatch(): void {
  const now = Date.now();
  const elapsed = now - stopwatchStartTime + stopwatchElapsed;
  swDisplay.textContent = formatTime(elapsed);
}

function startStopwatch(): void {
  if (!stopwatchRunning) {
    stopwatchRunning = true;
    stopwatchStartTime = Date.now();
    stopwatchInterval = window.setInterval(updateStopwatch, 10);
    swStartBtn.textContent = t('swPause');
  } else {
    stopwatchRunning = false;
    stopwatchElapsed += Date.now() - stopwatchStartTime;
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    swStartBtn.textContent = t('swStart');
  }
}

function resetStopwatch(): void {
  stopwatchRunning = false;
  stopwatchElapsed = 0;
  stopwatchStartTime = 0;
  if (stopwatchInterval) clearInterval(stopwatchInterval);
  swDisplay.textContent = '00:00:00.00';
  swStartBtn.textContent = t('swStart');
  lapCount = 0;
  lapList.innerHTML = '';
}

function recordLap(): void {
  if (!stopwatchRunning) return;
  lapCount++;
  const elapsed = (Date.now() - stopwatchStartTime + stopwatchElapsed);
  const item = document.createElement('div');
  item.className = 'data-list-item';
  item.textContent = `${t('lapLabel')} ${lapCount}: ${formatTime(elapsed)}`;
  lapList.prepend(item);
}

swStartBtn.addEventListener('click', startStopwatch);
swResetBtn.addEventListener('click', resetStopwatch);
swLapBtn.addEventListener('click', recordLap);

// Countdown functions
function updateCountdown(): void {
  countdownRemaining -= 100;
  if (countdownRemaining <= 0) {
    countdownRemaining = 0;
    countdownRunning = false;
    if (countdownInterval) clearInterval(countdownInterval);
    cdStartBtn.textContent = t('cdStart');
    cdDisplay.textContent = '00:00:00';
    
    // Alert when countdown finishes
    cdDisplay.style.color = '#e74c3c';
    setTimeout(() => {
      cdDisplay.style.color = '';
      alert(t('cdAlert'));
    }, 100);
  } else {
    cdDisplay.textContent = formatCountdown(countdownRemaining);
  }
}

function startCountdown(): void {
  if (!countdownRunning) {
    if (countdownRemaining <= 0) {
      const h = parseInt(cdHoursInput.value) || 0;
      const m = parseInt(cdMinutesInput.value) || 0;
      const s = parseInt(cdSecondsInput.value) || 0;
      countdownTotal = (h * 3600 + m * 60 + s) * 1000;
      countdownRemaining = countdownTotal;
      
      // Save countdown settings
      localStorage.setItem('clock-countdown', `${h}:${m}:${s}`);
    }
    
    if (countdownRemaining > 0) {
      countdownRunning = true;
      countdownInterval = window.setInterval(updateCountdown, 100);
      cdStartBtn.textContent = t('cdPause');
      cdHoursInput.disabled = true;
      cdMinutesInput.disabled = true;
      cdSecondsInput.disabled = true;
    }
  } else {
    countdownRunning = false;
    if (countdownInterval) clearInterval(countdownInterval);
    cdStartBtn.textContent = t('cdResume');
  }
}

function resetCountdown(): void {
  countdownRunning = false;
  if (countdownInterval) clearInterval(countdownInterval);
  countdownRemaining = countdownTotal;
  cdStartBtn.textContent = t('cdStart');
  cdHoursInput.disabled = false;
  cdMinutesInput.disabled = false;
  cdSecondsInput.disabled = false;
  cdDisplay.textContent = countdownRemaining > 0 ? formatCountdown(countdownRemaining) : '00:00:00';
}

cdStartBtn.addEventListener('click', startCountdown);
cdResetBtn.addEventListener('click', resetCountdown);

// Render timezone list
function renderTimezones(): void {
  const list = document.getElementById('timezone-list') as HTMLDivElement;
  list.innerHTML = '';

  const now = new Date();

  timezones.forEach(tz => {
    const item = document.createElement('div');
    item.className = `timezone-item ${selectedTimezone === tz.zone ? 'active' : ''}`;
    
    let timeStr: string;
    if (tz.zone === 'local') {
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      if (is24Hour) {
        timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      } else {
        const hour12 = h % 12 || 12;
        const ampm = h >= 12 ? 'PM' : 'AM';
        timeStr = `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`;
      }
    } else {
      const formatter = getTimezoneListFormatter(tz.zone, !is24Hour);
      timeStr = formatter.format(now);
    }

    item.innerHTML = `
      <div>
        <div class="timezone-name">${getTimezoneName(tz.name)}</div>
        <div class="timezone-offset">${tz.offset}</div>
      </div>
      <div class="timezone-time">${timeStr}</div>
    `;

    item.addEventListener('click', (): void => {
      selectedTimezone = tz.zone;
      localStorage.setItem('clock-timezone', tz.zone);
      updateCachedTimezone();
      renderTimezones();
    });

    list.appendChild(item);
  });
}

// Update timezone list every second
setInterval(renderTimezones, 1000);

// Handle window resize with debounce
let resizeTimer: number | null = null;
window.addEventListener('resize', (): void => {
  if (resizeTimer) cancelAnimationFrame(resizeTimer);
  resizeTimer = requestAnimationFrame((): void => {
    initCanvas();
    resizeTimer = null;
  });
});

// Update all UI text when language changes
function updateUILanguage(): void {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      const translation = t(key as keyof ReturnType<typeof loadLanguage>);
      // Update text content for buttons, labels, and text elements
      if (el instanceof HTMLButtonElement || el instanceof HTMLLabelElement || el instanceof HTMLParagraphElement || el instanceof HTMLHeadingElement) {
        el.textContent = translation;
      }
    }
  });
  
  // Update button titles
  themeBtn.title = t('themeToggleTitle');
  formatBtn.title = t('formatToggleTitle');
  
  // Update language button display
  const langBtn = document.getElementById('lang-btn') as HTMLButtonElement;
  if (langBtn) {
    langBtn.textContent = languageIcons[getLanguage()] || '🇨🇳';
    langBtn.title = `${t('languageToggleTitle')}: ${getLanguage().toUpperCase()}`;
  }
  
  // Update stopwatch buttons based on state
  if (stopwatchRunning) {
    swStartBtn.textContent = t('swPause');
  } else {
    swStartBtn.textContent = t('swStart');
  }
  swLapBtn.textContent = t('swLap');
  swResetBtn.textContent = t('swReset');
  
  // Update countdown buttons based on state
  if (countdownRunning) {
    cdStartBtn.textContent = t('cdPause');
  } else if (countdownRemaining < countdownTotal && countdownRemaining > 0) {
    cdStartBtn.textContent = t('cdResume');
  } else {
    cdStartBtn.textContent = t('cdStart');
  }
  cdResetBtn.textContent = t('cdReset');
  
  // Update lap list items
  const lapItems = lapList.querySelectorAll('.data-list-item');
  lapItems.forEach((item, idx) => {
    const timeMatch = item.textContent?.match(/: (.*)$/);
    if (timeMatch) {
      item.textContent = `${t('lapLabel')} ${idx + 1}: ${timeMatch[1]}`;
    }
  });
  
  // Update timezone display text
  if (selectedTimezone === 'local') {
    timezoneDisplay.textContent = t('localTimeLabel');
  } else {
    const tz = timezones.find(tz => tz.zone === selectedTimezone);
    timezoneDisplay.textContent = tz ? `${t('timezoneDisplayLabel')} ${getTimezoneName(tz.name)} (${tz.offset})` : '';
  }
  
  // Refresh timezone list
  renderTimezones();
}

// Clock size slider handler
sizeSlider.addEventListener('input', (): void => {
  clockSize = parseInt(sizeSlider.value, 10);
  localStorage.setItem('clock-size', clockSize.toString());
  initCanvas();
});

// Language toggle button handler
if (langBtn) {
  langBtn.addEventListener('click', (): void => {
    setLanguage(getNextLanguage());
    updateUILanguage();
  });
}

// Initialize
loadLanguage();
loadPreferences();
sizeSlider.value = clockSize.toString();
initCanvas();
updateCachedTimezone();
renderTimezones();
updateUILanguage();
animate();
