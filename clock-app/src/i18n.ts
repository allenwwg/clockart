// Internationalization (i18n) module

export interface Translations {
  // Page title
  title: string;
  appTitle: string;
  
  // Tab labels
  tabClock: string;
  tabStopwatch: string;
  tabCountdown: string;
  tabTimezone: string;
  
  // Clock panel
  clockPanelInfo: string;
  clockPanelDesc: string;
  localTimeLabel: string;
  timezoneDisplayLabel: string;
  clockSizeLabel: string;
  
  // Stopwatch
  swStart: string;
  swPause: string;
  swResume: string;
  swLap: string;
  swReset: string;
  lapLabel: string;
  
  // Countdown
  cdStart: string;
  cdPause: string;
  cdResume: string;
  cdReset: string;
  cdHours: string;
  cdMinutes: string;
  cdSeconds: string;
  cdHoursLabel: string;
  cdMinutesLabel: string;
  cdSecondsLabel: string;
  cdAlert: string;
  cdFinished: string;
  
  // Timezone
  localTimezone: string;
  localTimezoneName: string;
  
  // Button titles
  themeToggleTitle: string;
  formatToggleTitle: string;
  languageToggleTitle: string;

  // Date display
  monthNames: string[];
  weekdayNames: string[];
}

const translations: Record<string, Translations> = {
  zh: {
    title: '圆形时钟',
    appTitle: '圆形时钟',
    clockPanelDesc: '当前显示本地系统时间',
    clockSizeLabel: '时钟大小',
    cdHoursLabel: '时',
    cdMinutesLabel: '分',
    cdSecondsLabel: '秒',
    tabClock: '时钟',
    tabStopwatch: '秒表',
    tabCountdown: '倒计时',
    tabTimezone: '时区',
    clockPanelInfo: '当前显示本地系统时间',
    localTimeLabel: '当前显示本地时间',
    timezoneDisplayLabel: '当前显示',
    swStart: '启动',
    swPause: '暂停',
    swResume: '继续',
    swLap: '计次',
    swReset: '重置',
    lapLabel: '计次',
    cdStart: '开始',
    cdPause: '暂停',
    cdResume: '继续',
    cdReset: '重置',
    cdHours: '时',
    cdMinutes: '分',
    cdSeconds: '秒',
    cdAlert: '倒计时结束！',
    cdFinished: '倒计时结束！',
    localTimezone: '本地时间',
    localTimezoneName: '本地',
    themeToggleTitle: '切换主题',
    formatToggleTitle: '切换12/24小时制',
    languageToggleTitle: '切换语言',
    monthNames: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    weekdayNames: ['日','一','二','三','四','五','六'],
  },
  en: {
    title: 'Round Clock',
    appTitle: 'Round Clock',
    clockPanelDesc: 'Displaying local system time',
    clockSizeLabel: 'Clock Size',
    cdHoursLabel: 'H',
    cdMinutesLabel: 'M',
    cdSecondsLabel: 'S',
    tabClock: 'Clock',
    tabStopwatch: 'Stopwatch',
    tabCountdown: 'Countdown',
    tabTimezone: 'Timezone',
    clockPanelInfo: 'Displaying local system time',
    localTimeLabel: 'Displaying local time',
    timezoneDisplayLabel: 'Displaying',
    swStart: 'Start',
    swPause: 'Pause',
    swResume: 'Resume',
    swLap: 'Lap',
    swReset: 'Reset',
    lapLabel: 'Lap',
    cdStart: 'Start',
    cdPause: 'Pause',
    cdResume: 'Resume',
    cdReset: 'Reset',
    cdHours: 'H',
    cdMinutes: 'M',
    cdSeconds: 'S',
    cdAlert: 'Countdown finished!',
    cdFinished: 'Countdown finished!',
    localTimezone: 'Local Time',
    localTimezoneName: 'Local',
    themeToggleTitle: 'Toggle theme',
    formatToggleTitle: 'Toggle 12/24h format',
    languageToggleTitle: 'Toggle language',
    monthNames: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    weekdayNames: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  },
  ja: {
    title: '丸時計',
    appTitle: '丸時計',
    clockPanelDesc: 'ローカルシステム時刻を表示中',
    clockSizeLabel: '時計サイズ',
    cdHoursLabel: '時',
    cdMinutesLabel: '分',
    cdSecondsLabel: '秒',
    tabClock: '時計',
    tabStopwatch: 'ストップウォッチ',
    tabCountdown: 'カウントダウン',
    tabTimezone: 'タイムゾーン',
    clockPanelInfo: 'ローカルシステム時刻を表示中',
    localTimeLabel: 'ローカル時刻を表示中',
    timezoneDisplayLabel: '表示中',
    swStart: '開始',
    swPause: '一時停止',
    swResume: '再開',
    swLap: 'ラップ',
    swReset: 'リセット',
    lapLabel: 'ラップ',
    cdStart: '開始',
    cdPause: '一時停止',
    cdResume: '再開',
    cdReset: 'リセット',
    cdHours: '時',
    cdMinutes: '分',
    cdSeconds: '秒',
    cdAlert: 'カウントダウン終了！',
    cdFinished: 'カウントダウン終了！',
    localTimezone: 'ローカル時刻',
    localTimezoneName: 'ローカル',
    themeToggleTitle: 'テーマ切替',
    formatToggleTitle: '12/24時間切替',
    languageToggleTitle: '言語切替',
    monthNames: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    weekdayNames: ['日','月','火','水','木','金','土'],
  },
  ko: {
    title: '원형 시계',
    appTitle: '원형 시계',
    clockPanelDesc: '로컬 시스템 시간 표시 중',
    clockSizeLabel: '시계 크기',
    cdHoursLabel: '시',
    cdMinutesLabel: '분',
    cdSecondsLabel: '초',
    tabClock: '시계',
    tabStopwatch: '스톱워치',
    tabCountdown: '카운트다운',
    tabTimezone: '시간대',
    clockPanelInfo: '로컬 시스템 시간 표시 중',
    localTimeLabel: '로컬 시간 표시 중',
    timezoneDisplayLabel: '표시 중',
    swStart: '시작',
    swPause: '일시 정지',
    swResume: '계속',
    swLap: '랩',
    swReset: '초기화',
    lapLabel: '랩',
    cdStart: '시작',
    cdPause: '일시 정지',
    cdResume: '계속',
    cdReset: '초기화',
    cdHours: '시',
    cdMinutes: '분',
    cdSeconds: '초',
    cdAlert: '카운트다운 종료!',
    cdFinished: '카운트다운 종료!',
    localTimezone: '로컬 시간',
    localTimezoneName: '로컬',
    themeToggleTitle: '테마 전환',
    formatToggleTitle: '12/24시간 전환',
    languageToggleTitle: '언어 전환',
    monthNames: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    weekdayNames: ['일','월','화','수','목','금','토'],
  },
};

let currentLanguage: string = 'zh';

export function setLanguage(lang: string): void {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('clock-language', lang);
  }
}

export function getLanguage(): string {
  return currentLanguage;
}

export function t(key: keyof Translations): string {
  const val = translations[currentLanguage]?.[key] || translations['zh'][key];
  if (Array.isArray(val)) {
    return JSON.stringify(val);
  }
  return val;
}

export function tArray(key: keyof Translations): string[] {
  const val = translations[currentLanguage]?.[key] || translations['zh'][key];
  if (Array.isArray(val)) {
    return val;
  }
  return [val as string];
}

export function loadLanguage(): void {
  const saved = localStorage.getItem('clock-language');
  if (saved && translations[saved]) {
    currentLanguage = saved;
  }
}

// Language display names
export const languageNames: Record<string, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
};

// Language toggle icons
export const languageIcons: Record<string, string> = {
  zh: '🇨🇳',
  en: '🇺🇸',
  ja: '🇯🇵',
  ko: '🇰🇷',
};

export const languageOrder: string[] = ['zh', 'en', 'ja', 'ko'];

export function getNextLanguage(): string {
  const idx = languageOrder.indexOf(currentLanguage);
  const nextIdx = (idx + 1) % languageOrder.length;
  return languageOrder[nextIdx];
}