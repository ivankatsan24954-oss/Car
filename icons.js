/* icons.js — общие иконки для списка автомобилей и экрана деталей.
   Вынесено в отдельный файл, чтобы не дублировать код между страницами. */

// Силуэты типов транспорта (Material outline style)
const VEHICLE_ICONS = {
  car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.5 16.5 4.7 11a2 2 0 0 1 1.9-1.4h10.8a2 2 0 0 1 1.9 1.4l1.2 5.5"/>
    <rect x="2.7" y="14.5" width="18.6" height="4.6" rx="1.6"/>
    <circle cx="7" cy="19.4" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="19.4" r="1.6" fill="currentColor" stroke="none"/>
  </svg>`,
  van: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.5" y="7" width="14" height="9.5" rx="1.4"/>
    <path d="M16.5 10h3.2L21.5 13v3.5a1 1 0 0 1-1 1h-4"/>
    <circle cx="7" cy="19.2" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="17.5" cy="19.2" r="1.6" fill="currentColor" stroke="none"/>
  </svg>`,
  pickup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.7 15.5V11a1.4 1.4 0 0 1 1.4-1.4h4.4V15.5"/>
    <path d="M8.5 9.6h4.3l2.6 3v2.9"/>
    <rect x="2.7" y="14.5" width="18.6" height="4.5" rx="1.5"/>
    <circle cx="7" cy="19.3" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="19.3" r="1.6" fill="currentColor" stroke="none"/>
  </svg>`,
  excavator: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="12" width="8" height="5" rx="1"/>
    <path d="M11 13.5 16 8l4-1-1.4 4-4.6 3.5"/>
    <path d="M18.6 11 21 13.4l-2.6 1.6"/>
    <circle cx="5.5" cy="19" r="1.7" fill="currentColor" stroke="none"/>
    <circle cx="9.5" cy="19" r="1.7" fill="currentColor" stroke="none"/>
  </svg>`,
  moto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="5.5" cy="17" r="3"/>
    <circle cx="18.5" cy="17" r="3"/>
    <path d="M5.5 17 9 10.5h5L17 14M9 10.5 7.5 8h3"/>
  </svg>`
};

// Иконки категорий расходов
const EXPENSE_ICONS = {
  'Топливо': '⛽',
  'Ремонт': '🔧',
  'Обслуживание': '🧰',
  'Страховка': '🛡️',
  'Штрафы': '📋',
  'Прочее': '💳'
};

// Иконки типов напоминаний
const REMINDER_ICONS = {
  oil: '🛢️',
  insurance: '🛡️',
  tech: '🔧',
  tires: '🛞',
  other: '🔔'
};

const STATUS_LABEL = { ok: 'На ходу', repair: 'Ремонт', sold: 'Продан' };

// Статус самой записи о ремонте (не путать со статусом автомобиля выше)
const REPAIR_STATUS_LABEL = { in_progress: 'В процессе', done: 'Завершён' };

/** Иконка для категории расхода — сперва встроенные, затем пользовательские. */
function expenseIcon(category, customCategories = []) {
  if (EXPENSE_ICONS[category]) return EXPENSE_ICONS[category];
  const custom = customCategories.find(c => c.name === category);
  return (custom && custom.icon) || '🏷️';
}

/** Экранирует пользовательский текст перед вставкой в innerHTML. */
function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function formatMileage(km, unit = 'км') {
  return Number(km || 0).toLocaleString('ru-RU') + ' ' + unit;
}

// Эмодзи-силуэты для генерации "фотографии" автомобиля (канвас -> base64 PNG).
// Используется как запасной вариант, если у автомобиля ещё нет реального фото.
const VEHICLE_EMOJI = { car: '🚗', van: '🚐', pickup: '🛻', excavator: '🚜', moto: '🏍️' };

// ---------- Напоминания: общие метки и подсчёт дней (используется и в списке машин, и в карточке) ----------

const REMINDER_TYPE_LABEL = { tech: 'ТО', insurance: 'Страховка', oil: 'Замена масла', tires: 'Замена шин', other: 'Напоминание' };

function daysUntil(iso) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function pluralDays(n) {
  const abs = Math.abs(n);
  const mod10 = abs % 10, mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня';
  return 'дней';
}

/** Человекочитаемый срок: "Через 2 дня", "Завтра", "Сегодня", "Просрочено на 3 дня". */
function reminderDueText(iso) {
  const d = daysUntil(iso);
  if (d < 0) return `Просрочено на ${Math.abs(d)} ${pluralDays(d)}`;
  if (d === 0) return 'Сегодня';
  if (d === 1) return 'Завтра';
  return `Через ${d} ${pluralDays(d)}`;
}

/** Статус напоминания — ровно два состояния: активно / просрочено. */
function reminderStatus(iso) {
  return daysUntil(iso) < 0
    ? { key: 'overdue', label: 'Просрочено' }
    : { key: 'active', label: 'Активно' };
}

/** Возвращает src для <img> из записи фото (base64-строка или Blob). */
function photoSrc(photo) {
  return typeof photo.data === 'string' ? photo.data : URL.createObjectURL(photo.data);
}

/** Рендерит бейдж гос. номера в стиле настоящего знака (или пустую заглушку). */
function plateBadgeHTML(plate) {
  const clean = (plate || '').trim();
  if (!clean) {
    return `<span class="plate-badge is-empty"><span class="plate-badge-text">—</span></span>`;
  }
  return `
    <span class="plate-badge">
      <span class="plate-badge-text">${escapeHTML(clean)}</span>
      <span class="plate-badge-region">RUS</span>
    </span>
  `;
}

function generateCarPhotoDataURL(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#1c1c20');
  gradient.addColorStop(1, '#0b0b0d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2 - 10, 190, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 204, 51, 0.14)';
  ctx.fill();

  ctx.font = '230px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(VEHICLE_EMOJI[type] || VEHICLE_EMOJI.car, canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL('image/png');
}
