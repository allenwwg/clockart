// Type definitions
import { t, tArray, setLanguage, getLanguage, loadLanguage, languageIcons, getNextLanguage, type Translations } from './i18n';

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
let clockOnlyMode: boolean = false;
let soundEnabled: boolean = false;

// ---- Web Audio API Sound Engine ----
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      var AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        audioContext = new AC();
      }
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
      return null;
    }
  }
  return audioContext;
}

// Actually schedule and play a tone
function scheduleTone(audioCtx: AudioContext, frequency: number, duration: number, volume: number, type: string): void {
  var oscillator = audioCtx.createOscillator();
  var gainNode = audioCtx.createGain();

  oscillator.type = type as OscillatorType;
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + duration);

  // Clean up nodes after they finish to prevent memory leaks
  oscillator.onended = function() {
    oscillator.disconnect();
    gainNode.disconnect();
  };
}

// Play a simple tone beep
function playTone(frequency: number, duration: number, volume: number, type: string = 'sine'): void {
  if (!soundEnabled) return;
  var audioCtx = getAudioContext();
  if (!audioCtx) return;

  // Resume context if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(function() {
      // @ts-ignore: audioCtx is guaranteed non-null here since we checked above
      scheduleTone(audioCtx, frequency, duration, volume, type);
    });
  } else {
    scheduleTone(audioCtx, frequency, duration, volume, type);
  }
}

// Clock tick sound - short, soft click
function playTickSound(): void {
  if (!soundEnabled) return;
  playTone(800, 0.03, 0.06, 'square');
}

// Hourly chime - 3 pleasant ascending tones
function playHourlyChime(): void {
  if (!soundEnabled) return;
  playTone(523.25, 0.3, 0.15, 'sine');
  setTimeout(function() { playTone(659.25, 0.3, 0.15, 'sine'); }, 200);
  setTimeout(function() { playTone(783.99, 0.5, 0.15, 'sine'); }, 400);
}

// Countdown finish alarm - attention-grabbing sequence
function playCountdownAlarm(): void {
  if (!soundEnabled) return;
  for (var i = 0; i < 5; i++) {
    (function(index: number) {
      setTimeout(function() {
        playTone(1000, 0.15, 0.2, 'square');
      }, index * 200);
    })(i);
  }
  setTimeout(function() {
    playTone(880, 0.8, 0.2, 'sine');
  }, 1200);
}

// Stopwatch lap sound - short pleasant blip
function playLapSound(): void {
  if (!soundEnabled) return;
  playTone(600, 0.08, 0.1, 'sine');
}

// Track last second and last hour for sound triggers
let lastSecond: number = -1;
let lastHour: number = -2; // Start with invalid value to prevent hourly chime on page load

// ---- Compatibility: Polyfill for Map (very old browsers) ----
// @ts-ignore: Polyfill for old browsers
var MapPolyfill = typeof Map !== 'undefined' ? Map : function() {
  // @ts-ignore: Polyfill for old browsers
  var data: Record<string, any> = {};
  // @ts-ignore: Polyfill for old browsers
  this.has = function(k: string) { return Object.prototype.hasOwnProperty.call(data, k); };
  // @ts-ignore: Polyfill for old browsers
  this.get = function(k: string) { return this.has(k) ? data[k] : undefined; };
  // @ts-ignore: Polyfill for old browsers
  this.set = function(k: string, v: any) { data[k] = v; return this; };
  // @ts-ignore: Polyfill for old browsers
  this.clear = function() { for (var key in data) delete data[key]; };
};

// ---- Compatibility: Polyfill for String.padStart ----
if (!String.prototype.padStart) {
  String.prototype.padStart = function(targetLength, padString) {
    targetLength = targetLength >> 0;
    padString = String(padString !== undefined ? padString : ' ');
    if (this.length >= targetLength) return String(this);
    var padding = padString.repeat(Math.ceil((targetLength - this.length) / padString.length));
    return padding.slice(0, targetLength - this.length) + String(this);
  };
}

// Cached Intl formatters for performance (use polyfilled Map)
// @ts-ignore: Polyfill for old browsers
var intlFormatterCache = new MapPolyfill();
// @ts-ignore: Polyfill for old browsers
var timezoneListFormatterCache = new MapPolyfill();
// @ts-ignore: Polyfill for old browsers
var clockTimezoneFormatterCache = new MapPolyfill();

function getClockIntlFormatter(timezone: string): Intl.DateTimeFormat {
  var key = timezone + '_clock';
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
  return intlFormatterCache.get(key);
}

function getTimezoneListFormatter(timezone: string, hour12: boolean): Intl.DateTimeFormat {
  var key = timezone + '_list_' + (hour12 ? '12' : '24');
  if (!timezoneListFormatterCache.has(key)) {
    timezoneListFormatterCache.set(key, new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: hour12,
    }));
  }
  return timezoneListFormatterCache.get(key);
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

// ---- Compatibility: Safe DOM element retrieval ----
function getElementByIdSafe(id: string): HTMLElement | null {
  var el = document.getElementById(id);
  return el;
}

// DOM Elements
const canvas = getElementByIdSafe('clock-canvas') as HTMLCanvasElement | null;
const ctx = canvas ? canvas.getContext('2d') : null;
const themeBtn = getElementByIdSafe('theme-btn') as HTMLButtonElement | null;
const formatBtn = getElementByIdSafe('format-btn') as HTMLButtonElement | null;
const langBtn = getElementByIdSafe('lang-btn') as HTMLButtonElement | null;
const clockOnlyBtn = getElementByIdSafe('clock-only-btn') as HTMLButtonElement | null;
const soundBtn = getElementByIdSafe('sound-btn') as HTMLButtonElement | null;
const timezoneDisplay = getElementByIdSafe('timezone-display') as HTMLDivElement | null;
const clockOnlyHint = getElementByIdSafe('clock-only-hint') as HTMLDivElement | null;
const tabNav = getElementByIdSafe('tab-nav') as HTMLDivElement | null;
const digitalDatetime = getElementByIdSafe('digital-datetime') as HTMLDivElement | null;
const clockPanelDesc = getElementByIdSafe('clock-panel-desc') as HTMLParagraphElement | null;

// ---- Compatibility: querySelectorAll may return NodeList, iterate safely ----
const tabBtns = typeof document !== 'undefined' ? document.querySelectorAll('.tab-btn') : [];
const panels = typeof document !== 'undefined' ? document.querySelectorAll('.panel') : [];

const sizeSlider = getElementByIdSafe('clock-size-slider') as HTMLInputElement | null;

// Stopwatch elements
const swDisplay = getElementByIdSafe('stopwatch-display') as HTMLDivElement | null;
const swStartBtn = getElementByIdSafe('sw-start') as HTMLButtonElement | null;
const swLapBtn = getElementByIdSafe('sw-lap') as HTMLButtonElement | null;
const swResetBtn = getElementByIdSafe('sw-reset') as HTMLButtonElement | null;
const lapList = getElementByIdSafe('lap-list') as HTMLDivElement | null;

// Countdown elements
const cdDisplay = getElementByIdSafe('countdown-display') as HTMLDivElement | null;
const cdHoursInput = getElementByIdSafe('cd-hours') as HTMLInputElement | null;
const cdMinutesInput = getElementByIdSafe('cd-minutes') as HTMLInputElement | null;
const cdSecondsInput = getElementByIdSafe('cd-seconds') as HTMLInputElement | null;
const cdStartBtn = getElementByIdSafe('cd-start') as HTMLButtonElement | null;
const cdResetBtn = getElementByIdSafe('cd-reset') as HTMLButtonElement | null;

// Timezone data
const timezoneNames = {
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

const timezones = [
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
  var lang = getLanguage();
  // @ts-ignore: zone is a valid key
  var zoneNames = timezoneNames[zone];
  if (zoneNames) {
    if (zoneNames[lang]) return zoneNames[lang];
    if (zoneNames['zh']) return zoneNames['zh'];
  }
  return zone;
}

// ---- Forward declaration for switchTab (called before definition) ----
let switchTabFn: ((tab: string) => void) | null = null;

// Apply translations to all elements with data-i18n attribute
function applyLanguage(): void {
  var lang = getLanguage();
  var elements = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < elements.length; i++) {
    var key = elements[i].getAttribute('data-i18n');
    if (key) {
      var val = t(key as keyof Translations);
      if (val) {
        elements[i].textContent = val;
      }
    }
  }
  // Update page title
  document.title = t('pageTitle');
  // Update lang button icon
  if (langBtn) {
    var icons = languageIcons;
    langBtn.textContent = icons[lang] || '🌐';
    langBtn.title = t('languageToggleTitle');
  }
}

// Language toggle button
if (langBtn) {
  langBtn.addEventListener('click', function(): void {
    var nextLang = getNextLanguage();
    setLanguage(nextLang);
    applyLanguage();
    renderTimezones();
  });
}

// Load saved preferences from localStorage
function loadPreferences(): void {
  var savedTheme = localStorage.getItem('clock-theme');
  if (savedTheme) {
    currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme === 'dark' ? 'dark' : '');
    if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
  }

  var savedFormat = localStorage.getItem('clock-format');
  if (savedFormat) {
    is24Hour = savedFormat === '24';
    if (formatBtn) formatBtn.textContent = is24Hour ? '24H' : '12H';
  }

  var savedTimezone = localStorage.getItem('clock-timezone');
  if (savedTimezone) {
    selectedTimezone = savedTimezone;
  }

  var savedCountdown = localStorage.getItem('clock-countdown');
  if (savedCountdown) {
    var parts = savedCountdown.split(':');
    if (cdHoursInput) cdHoursInput.value = parseInt(parts[0], 10).toString();
    if (cdMinutesInput) cdMinutesInput.value = parseInt(parts[1], 10).toString();
    if (cdSecondsInput) cdSecondsInput.value = parseInt(parts[2], 10).toString();
  }

  var savedSize = localStorage.getItem('clock-size');
  if (savedSize) {
    clockSize = parseInt(savedSize, 10);
  }

  var savedTab = localStorage.getItem('clock-tab');
  if (savedTab && switchTabFn) {
    switchTabFn(savedTab);
  }

  var savedClockOnly = localStorage.getItem('clock-only-mode');
  if (savedClockOnly) {
    clockOnlyMode = savedClockOnly === 'true';
    applyClockOnlyMode();
  }

  // Load sound preference
  var savedSound = localStorage.getItem('clock-sound');
  if (savedSound) {
    soundEnabled = savedSound === 'true';
    if (soundBtn) {
      soundBtn.textContent = soundEnabled ? '\uD83D\uDD14' : '\uD83D\uDD07';
      soundBtn.title = t('soundToggleTitle');
    }
  }
}

// Get theme colors
function getThemeColors(): ThemeConfig {
  var isDark = currentTheme === 'dark';
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
  if (!canvas) return;
  var maxWidth = window.innerWidth - 40;
  var size = Math.min(clockSize, maxWidth);
  cachedCanvasSize = size;
  // ---- Compatibility: devicePixelRatio may not exist ----
  var dpr = (typeof window.devicePixelRatio !== 'undefined' && window.devicePixelRatio) || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// Cached timezone lookup
let cachedSelectedTz: TimezoneInfo | undefined;

function updateCachedTimezone(): void {
  cachedSelectedTz = undefined;
  for (var i = 0; i < timezones.length; i++) {
    if (timezones[i].zone === selectedTimezone) {
      cachedSelectedTz = timezones[i];
      break;
    }
  }
}

// Get a cached formatter for a specific timezone component
function getCachedTzFormatter(timezone: string, option: string): Intl.DateTimeFormat {
  var key = timezone + '_' + option;
  if (!clockTimezoneFormatterCache.has(key)) {
    var opts: Intl.DateTimeFormatOptions = { timeZone: timezone };
    if (option === 'year') opts.year = 'numeric';
    else if (option === 'month') opts.month = '2-digit';
    else if (option === 'day') opts.day = '2-digit';
    else if (option === 'weekday') opts.weekday = 'short';
    else if (option === 'hour') { opts.hour = '2-digit'; opts.hour12 = false; }
    else if (option === 'minute') opts.minute = '2-digit';
    else if (option === 'second') opts.second = '2-digit';
    clockTimezoneFormatterCache.set(key, new Intl.DateTimeFormat('en-US', opts));
  }
  return clockTimezoneFormatterCache.get(key);
}

// ---- Compatibility: Safe parse of timezone time without formatToParts ----
function getTimeInTimezone(date: Date, timezone: string) {
  var result = {
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    year: date.getFullYear(),
    month: date.getMonth(),
    date: date.getDate(),
    weekday: date.getDay(),
  };

  try {
    result.year = parseInt(getCachedTzFormatter(timezone, 'year').format(date), 10);
    result.month = parseInt(getCachedTzFormatter(timezone, 'month').format(date), 10) - 1;
    result.date = parseInt(getCachedTzFormatter(timezone, 'day').format(date), 10);
    result.hours = parseInt(getCachedTzFormatter(timezone, 'hour').format(date), 10);
    result.minutes = parseInt(getCachedTzFormatter(timezone, 'minute').format(date), 10);
    result.seconds = parseInt(getCachedTzFormatter(timezone, 'second').format(date), 10);

    var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    var weekdayStr = getCachedTzFormatter(timezone, 'weekday').format(date).toLowerCase().slice(0, 3);
    var weekdayIdx = days.indexOf(weekdayStr);
    if (weekdayIdx >= 0) {
      result.weekday = weekdayIdx;
    }
  } catch (e) {
    console.warn('Timezone conversion failed, using local time:', e);
  }

  return result;
}

// Draw the analog clock
function drawClock(date: Date): void {
  if (!ctx || !canvas) return;

  var size = cachedCanvasSize;
  var centerX = size / 2;
  var centerY = size / 2;
  var radius = size / 2 - 10;

  var colors = getThemeColors();

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
  for (var i = 0; i < 12; i++) {
    var angle = (i * Math.PI) / 6 - Math.PI / 2;
    var isQuarterHour = i % 3 === 0;
    var outerRadius = radius - 8;
    var innerRadius = isQuarterHour ? radius - 28 : radius - 18;

    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
    ctx.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
    ctx.strokeStyle = colors.tick;
    ctx.lineWidth = isQuarterHour ? 3 : 2;
    ctx.stroke();
  }

  // Draw minute markers
  for (i = 0; i < 60; i++) {
    if (i % 5 !== 0) {
      angle = (i * Math.PI) / 30 - Math.PI / 2;
      outerRadius = radius - 8;
      innerRadius = radius - 14;

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
  ctx.font = (size * 0.06) + 'px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (i = 1; i <= 12; i++) {
    angle = (i * Math.PI) / 6 - Math.PI / 2;
    var numRadius = radius - 42;
    var x = centerX + Math.cos(angle) * numRadius;
    var y = centerY + Math.sin(angle) * numRadius;
    ctx.fillText(i.toString(), x, y);
  }

  // Get time components
  var hours, minutes, seconds, ms;
  var displayYear, displayMonth, displayDate, displayWeekday;

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
    var tzTime = getTimeInTimezone(date, selectedTimezone);
    hours = tzTime.hours;
    minutes = tzTime.minutes;
    seconds = tzTime.seconds;
    displayYear = tzTime.year;
    displayMonth = tzTime.month;
    displayDate = tzTime.date;
    displayWeekday = tzTime.weekday;
    ms = date.getMilliseconds();
  }

  // ---- Sound: Tick on each new second ----
  if (seconds !== lastSecond) {
    lastSecond = seconds;
    playTickSound();

    // ---- Sound: Hourly chime when minute is 0 and second is 0 ----
    if (minutes === 0 && seconds === 0 && hours !== lastHour) {
      lastHour = hours;
      playHourlyChime();
    }
  }

  // Calculate angles
  var secondAngle = ((seconds + ms / 1000) * Math.PI) / 30 - Math.PI / 2;
  var minuteAngle = ((minutes + seconds / 60) * Math.PI) / 30 - Math.PI / 2;
  var hourAngle = (((hours % 12) + minutes / 60) * Math.PI) / 6 - Math.PI / 2;

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
  var monthNames = tArray('monthNames');
  var weekdayNames = tArray('weekdayNames');
  var monthStr = String(displayMonth + 1).padStart(2, '0');
  var dateStr = displayYear + '.' + monthStr + '.' + String(displayDate).padStart(2, '0') + ' ' + (weekdayNames[displayWeekday] || '');

  ctx.fillStyle = colors.number;
  ctx.font = (size * 0.035) + 'px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(dateStr, centerX, centerY + radius * 0.35);

  // Update timezone display using cached lookup
  if (selectedTimezone === 'local') {
    if (timezoneDisplay) timezoneDisplay.textContent = t('localTimeLabel');
    if (clockPanelDesc) clockPanelDesc.textContent = t('clockPanelInfo');
  } else {
    if (timezoneDisplay && cachedSelectedTz) {
      timezoneDisplay.textContent = t('timezoneDisplayLabel') + ' ' + getTimezoneName(cachedSelectedTz.name) + ' (' + cachedSelectedTz.offset + ')';
    }
    if (clockPanelDesc && cachedSelectedTz) {
      clockPanelDesc.textContent = t('timezoneDisplayLabel') + ' ' + getTimezoneName(cachedSelectedTz.name);
    }
  }

  // Update digital date/time display
  if (digitalDatetime) {
    monthNames = tArray('monthNames');
    weekdayNames = tArray('weekdayNames');
    var datePart = weekdayNames[displayWeekday] || '';
    var monthPart = monthNames[displayMonth] || String(displayMonth + 1);
    var timeStr;
    if (is24Hour) {
      timeStr = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else {
      var hour12 = hours % 12 || 12;
      var ampm = hours >= 12 ? 'PM' : 'AM';
      timeStr = String(hour12).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + ' ' + ampm;
    }
    digitalDatetime.textContent = displayYear + ' ' + monthPart + ' ' + displayDate + ' ' + datePart + '  ' + timeStr;
  }
}

// ---- Compatibility: requestAnimationFrame polyfill ----
(function(global) {
  if (!global.requestAnimationFrame) {
    var lastTime = 0;
    global.requestAnimationFrame = function(callback) {
      var now = Date.now();
      var delta = Math.max(0, 16 - (now - lastTime));
      var id = setTimeout(function() { callback(lastTime = now + delta); }, delta);
      return id;
    };
    if (!global.cancelAnimationFrame) {
      global.cancelAnimationFrame = function(id) {
        clearTimeout(id);
      };
    }
  }
})(window);

// Animation loop
function animate(): void {
  drawClock(new Date());
  requestAnimationFrame(animate);
}

// Format time for display
function formatTime(ms: number): string {
  var totalSeconds = Math.floor(ms / 1000);
  var hours = Math.floor(totalSeconds / 3600);
  var minutes = Math.floor((totalSeconds % 3600) / 60);
  var seconds = totalSeconds % 60;
  var centiseconds = Math.floor((ms % 1000) / 10);

  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '.' + String(centiseconds).padStart(2, '0');
}

// Format countdown time
function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  var totalSeconds = Math.floor(ms / 1000);
  var hours = Math.floor(totalSeconds / 3600);
  var minutes = Math.floor((totalSeconds % 3600) / 60);
  var seconds = totalSeconds % 60;

  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

// Toggle clock-only mode function
function applyClockOnlyMode(): void {
  var header = document.querySelector('header');
  if (clockOnlyMode) {
    if (header) header.style.display = 'none';
    if (timezoneDisplay) timezoneDisplay.style.display = 'none';
    if (tabNav) tabNav.style.display = 'none';
    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.remove('active');
    }
    if (clockOnlyBtn) clockOnlyBtn.textContent = '\u2B55';
    if (clockOnlyHint) {
      clockOnlyHint.textContent = t('clockOnlyExitHint');
      clockOnlyHint.style.display = 'block';
      setTimeout(function() {
        if (clockOnlyHint) clockOnlyHint.style.display = 'none';
      }, 3000);
    }
  } else {
    if (header) header.style.display = '';
    if (timezoneDisplay) timezoneDisplay.style.display = '';
    if (tabNav) tabNav.style.display = '';
    if (clockOnlyBtn) clockOnlyBtn.textContent = '\uD83D\uDD35';
    if (clockOnlyHint) clockOnlyHint.style.display = 'none';
  }
}

// Clock-only mode toggle
if (clockOnlyBtn) {
  clockOnlyBtn.addEventListener('click', function(): void {
    clockOnlyMode = !clockOnlyMode;
    localStorage.setItem('clock-only-mode', clockOnlyMode.toString());
    applyClockOnlyMode();
  });
}

// Press Escape or double-click canvas to exit clock-only mode
document.addEventListener('keydown', function(e): void {
  if (e.key === 'Escape' && clockOnlyMode) {
    clockOnlyMode = false;
    localStorage.setItem('clock-only-mode', 'false');
    applyClockOnlyMode();
  }
});

if (canvas) {
  canvas.addEventListener('dblclick', function(): void {
    if (clockOnlyMode) {
      clockOnlyMode = false;
      localStorage.setItem('clock-only-mode', 'false');
      applyClockOnlyMode();
    }
  });
}

// ---- Sound toggle button ----
if (soundBtn) {
  soundBtn.addEventListener('click', function(): void {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '\uD83D\uDD14' : '\uD83D\uDD07';
    localStorage.setItem('clock-sound', soundEnabled.toString());

    // Init and resume audio context on first click (browser autoplay policy)
    if (soundEnabled) {
      var ctx = getAudioContext();
      if (ctx) {
        ctx.resume().then(function() {
          // Audio context is now active - play a test tone to confirm
          playTone(440, 0.15, 0.1, 'sine');
        });
      }
    }

    // Show hint
    if (clockOnlyHint) {
      clockOnlyHint.textContent = soundEnabled ? t('soundEnabled') : t('soundDisabled');
      clockOnlyHint.style.display = 'block';
      setTimeout(function() {
        if (clockOnlyHint) clockOnlyHint.style.display = 'none';
      }, 1500);
    }
  });
}

// Resume AudioContext on first user interaction if sound is already enabled (from saved preferences)
// This solves the browser autoplay policy issue where AudioContext starts suspended
function initAudioOnFirstInteraction(): void {
  if (!soundEnabled) return;
  var events = ['click', 'keydown', 'touchstart', 'mousedown'];
  function handleInteraction(): void {
    var ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    for (var i = 0; i < events.length; i++) {
      document.removeEventListener(events[i], handleInteraction);
    }
  }
  for (var i = 0; i < events.length; i++) {
    document.addEventListener(events[i], handleInteraction);
  }
}

// Theme toggle
if (themeBtn) {
  themeBtn.addEventListener('click', function(): void {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    if (currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    themeBtn.textContent = currentTheme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
    localStorage.setItem('clock-theme', currentTheme);
  });
}

// Format toggle
if (formatBtn) {
  formatBtn.addEventListener('click', function(): void {
    is24Hour = !is24Hour;
    formatBtn.textContent = is24Hour ? '24H' : '12H';
    localStorage.setItem('clock-format', is24Hour ? '24' : '12');
    timezoneListFormatterCache.clear();
    renderTimezones();
  });
}

// Tab switching
function switchTab(tab: string): void {
  for (var i = 0; i < tabBtns.length; i++) {
    tabBtns[i].classList.remove('active');
  }
  for (var j = 0; j < panels.length; j++) {
    panels[j].classList.remove('active');
  }
  for (i = 0; i < tabBtns.length; i++) {
    if (tabBtns[i].getAttribute('data-tab') === tab) {
      tabBtns[i].classList.add('active');
      break;
    }
  }
  var panel = document.getElementById(tab + '-panel');
  if (panel) panel.classList.add('active');
}

// Assign switchTab to forward reference
switchTabFn = switchTab;

for (var btnIdx = 0; btnIdx < tabBtns.length; btnIdx++) {
  (function(btn) {
    btn.addEventListener('click', function(): void {
      var tab = btn.getAttribute('data-tab');
      if (!tab) return;
      switchTab(tab);
      localStorage.setItem('clock-tab', tab);
    });
  })(tabBtns[btnIdx]);
}

// Stopwatch functions
function updateStopwatch(): void {
  var now = Date.now();
  var elapsed = now - stopwatchStartTime + stopwatchElapsed;
  if (swDisplay) swDisplay.textContent = formatTime(elapsed);
}

function startStopwatch(): void {
  if (!stopwatchRunning) {
    stopwatchRunning = true;
    stopwatchStartTime = Date.now();
    stopwatchInterval = window.setInterval(updateStopwatch, 10);
    if (swStartBtn) swStartBtn.textContent = t('swPause');
  } else {
    stopwatchRunning = false;
    stopwatchElapsed += Date.now() - stopwatchStartTime;
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    if (swStartBtn) swStartBtn.textContent = t('swStart');
  }
}

function resetStopwatch(): void {
  stopwatchRunning = false;
  stopwatchElapsed = 0;
  stopwatchStartTime = 0;
  if (stopwatchInterval) clearInterval(stopwatchInterval);
  if (swDisplay) swDisplay.textContent = '00:00:00.00';
  if (swStartBtn) swStartBtn.textContent = t('swStart');
  lapCount = 0;
  if (lapList) lapList.innerHTML = '';
}

function recordLap(): void {
  if (!stopwatchRunning) return;

  // Play lap sound
  playLapSound();

  lapCount++;
  var elapsed = (Date.now() - stopwatchStartTime + stopwatchElapsed);
  var item = document.createElement('div');
  item.className = 'data-list-item';
  item.textContent = t('lapLabel') + ' ' + lapCount + ': ' + formatTime(elapsed);
  if (lapList) lapList.prepend(item);
}

if (swStartBtn) swStartBtn.addEventListener('click', startStopwatch);
if (swResetBtn) swResetBtn.addEventListener('click', resetStopwatch);
if (swLapBtn) swLapBtn.addEventListener('click', recordLap);

// Countdown functions
function updateCountdown(): void {
  countdownRemaining -= 100;
  if (countdownRemaining <= 0) {
    countdownRemaining = 0;
    countdownRunning = false;
    if (countdownInterval) clearInterval(countdownInterval);
    if (cdStartBtn) cdStartBtn.textContent = t('cdStart');
    if (cdDisplay) cdDisplay.textContent = '00:00:00';

    if (cdDisplay) cdDisplay.style.color = '#e74c3c';

    // Play countdown alarm sound
    playCountdownAlarm();

    // Wait for alarm to finish before showing alert (alarm takes ~2s total)
    setTimeout(function() {
      if (cdDisplay) cdDisplay.style.color = '';
      alert(t('cdAlert'));
    }, 2500);
  } else {
    if (cdDisplay) cdDisplay.textContent = formatCountdown(countdownRemaining);
  }
}

function startCountdown(): void {
  if (!countdownRunning) {
    if (countdownRemaining <= 0) {
      var h = cdHoursInput ? (parseInt(cdHoursInput.value, 10) || 0) : 0;
      var m = cdMinutesInput ? (parseInt(cdMinutesInput.value, 10) || 0) : 0;
      var s = cdSecondsInput ? (parseInt(cdSecondsInput.value, 10) || 0) : 0;
      countdownTotal = (h * 3600 + m * 60 + s) * 1000;
      countdownRemaining = countdownTotal;

      localStorage.setItem('clock-countdown', h + ':' + m + ':' + s);
    }

    if (countdownRemaining > 0) {
      countdownRunning = true;
      countdownInterval = window.setInterval(updateCountdown, 100);
      if (cdStartBtn) cdStartBtn.textContent = t('cdPause');
      if (cdHoursInput) cdHoursInput.disabled = true;
      if (cdMinutesInput) cdMinutesInput.disabled = true;
      if (cdSecondsInput) cdSecondsInput.disabled = true;
    }
  } else {
    countdownRunning = false;
    if (countdownInterval) clearInterval(countdownInterval);
    if (cdStartBtn) cdStartBtn.textContent = t('cdResume');
  }
}

function resetCountdown(): void {
  countdownRunning = false;
  if (countdownInterval) clearInterval(countdownInterval);
  countdownRemaining = countdownTotal;
  if (cdStartBtn) cdStartBtn.textContent = t('cdStart');
  if (cdHoursInput) cdHoursInput.disabled = false;
  if (cdMinutesInput) cdMinutesInput.disabled = false;
  if (cdSecondsInput) cdSecondsInput.disabled = false;
  if (cdDisplay) cdDisplay.textContent = countdownRemaining > 0 ? formatCountdown(countdownRemaining) : '00:00:00';
}

if (cdStartBtn) cdStartBtn.addEventListener('click', startCountdown);
if (cdResetBtn) cdResetBtn.addEventListener('click', resetCountdown);

// Render timezone list
function renderTimezones(): void {
  var list = document.getElementById('timezone-list');
  if (!list) return;
  list.innerHTML = '';

  var now = new Date();

  for (var i = 0; i < timezones.length; i++) {
    var tz = timezones[i];
    var item = document.createElement('div');
    var activeClass = selectedTimezone === tz.zone ? ' active' : '';
    item.className = 'timezone-item' + activeClass;

    var timeStr;
    if (tz.zone === 'local') {
      var h = now.getHours();
      var mn = now.getMinutes();
      var sc = now.getSeconds();
      if (is24Hour) {
        timeStr = String(h).padStart(2, '0') + ':' + String(mn).padStart(2, '0') + ':' + String(sc).padStart(2, '0');
      } else {
        var hour12 = h % 12 || 12;
        var ampm = h >= 12 ? 'PM' : 'AM';
        timeStr = String(hour12).padStart(2, '0') + ':' + String(mn).padStart(2, '0') + ':' + String(sc).padStart(2, '0') + ' ' + ampm;
      }
    } else {
      var formatter = getTimezoneListFormatter(tz.zone, !is24Hour);
      timeStr = formatter.format(now);
    }

    item.innerHTML =
      '<div>' +
        '<div class="timezone-name">' + getTimezoneName(tz.name) + '</div>' +
        '<div class="timezone-offset">' + tz.offset + '</div>' +
      '</div>' +
      '<div class="timezone-time">' + timeStr + '</div>';

    (function(timezoneData) {
      item.addEventListener('click', function(): void {
        selectedTimezone = timezoneData.zone;
        localStorage.setItem('clock-timezone', timezoneData.zone);
        updateCachedTimezone();
        renderTimezones();
      });
    })(tz);

    list.appendChild(item);
  }
}

// Initialize and start
loadLanguage();
loadPreferences();
applyLanguage();
initAudioOnFirstInteraction();
updateCachedTimezone();
initCanvas();
renderTimezones();
animate();

// Update timezone list every second
setInterval(renderTimezones, 1000);

// Handle window resize
window.addEventListener('resize', function(): void {
  if (sizeSlider) sizeSlider.value = cachedCanvasSize.toString();
  initCanvas();
});

// Size slider
if (sizeSlider) {
  sizeSlider.addEventListener('input', function(): void {
    clockSize = parseInt(sizeSlider.value, 10);
    localStorage.setItem('clock-size', clockSize.toString());
    initCanvas();
  });
}

