/* script.js — главный экран (список автомобилей).
   Данные читаются из IndexedDB через storage.js. При пустой базе
   показывается пустое состояние — никакие демо-машины не создаются. */

function vehicleCardHTML(car, photo) {
  const photoInner = photo
    ? `<img src="${photoSrc(photo)}" alt="" class="vehicle-photo-img">`
    : (VEHICLE_ICONS[car.type] || VEHICLE_ICONS.car);
  return `
    <article class="vehicle-card ${car.status === 'sold' ? 'is-sold' : ''}" data-id="${car.id}" tabindex="0" role="button" aria-label="Открыть ${escapeHTML(car.name)}">
      <div class="vehicle-photo">${photoInner}</div>
      <div class="vehicle-info">
        <h2 class="vehicle-name">${escapeHTML(car.name)}</h2>
        <div class="vehicle-meta-row">
          ${plateBadgeHTML(car.plate)}
          <span class="mileage-dot">•</span>
          <span class="mileage">${formatMileage(car.mileage, car.unit)}</span>
        </div>
      </div>
      <span class="status-chip status-${car.status}">
        <span class="dot"></span>${STATUS_LABEL[car.status] || STATUS_LABEL.ok}
      </span>
    </article>
  `;
}

function pluralVehicles(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'автомобиль';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'автомобиля';
  return 'автомобилей';
}

// Blob URL-ы, созданные для фото в списке на предыдущем рендере — освобождаем
// перед следующим рендером, чтобы не копить память при частом обновлении списка.
let vehicleListBlobURLs = [];

function revokeVehicleListBlobURLs() {
  vehicleListBlobURLs.forEach(url => URL.revokeObjectURL(url));
  vehicleListBlobURLs = [];
}

async function renderVehicles() {
  const list = document.getElementById('vehicle-list');
  const count = document.getElementById('fleet-count');
  const cars = await getCars();

  count.textContent = `${cars.length} ${pluralVehicles(cars.length)} в парке`;

  const photos = await Promise.all(
    cars.map(car => (car.mainPhotoId ? getPhoto(car.mainPhotoId) : null))
  );

  revokeVehicleListBlobURLs();

  list.innerHTML = cars.length
    ? cars.map((car, i) => vehicleCardHTML(car, photos[i] || null)).join('')
    : `<div class="empty">Кажется, вы ещё не добавили автомобиль.<br>Нажмите «Добавить автомобиль», чтобы завести первую карточку.</div>`;

  vehicleListBlobURLs = Array.from(list.querySelectorAll('.vehicle-photo-img'))
    .map(img => img.src)
    .filter(src => src.startsWith('blob:'));

  list.querySelectorAll('.vehicle-card').forEach(card => {
    const open = () => { window.location.href = `car.html?id=${card.dataset.id}`; };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

(async function init() {
  await renderVehicles();
  await checkUpcomingRemindersOnLoad();
})();

// ---------- Напоминания: кнопка-колокольчик + автопоказ при открытии ----------

const REMINDER_ALERT_THRESHOLD_DAYS = 2; // "срочные": просроченные + сегодня/завтра/через 2 дня

function reminderAlertRowHTML(reminder, car) {
  const icon = REMINDER_ICONS[reminder.type] || REMINDER_ICONS.other;
  const label = REMINDER_TYPE_LABEL[reminder.type] || 'Напоминание';
  const status = reminderStatus(reminder.dueDate);
  return `
    <div class="list-row">
      <div class="row-icon">${icon}</div>
      <div class="row-main">
        <div class="row-title">${escapeHTML(label)} — ${escapeHTML(car ? car.name : 'Автомобиль удалён')}</div>
        <div class="row-sub">${reminderDueText(reminder.dueDate)}${reminder.note ? ' • ' + escapeHTML(reminder.note) : ''}</div>
      </div>
      <span class="status-pill status-pill-${status.key}">${status.label}</span>
    </div>
  `;
}

/** Возвращает срочные напоминания (просроченные и близкие) по всем машинам сразу. */
async function getUrgentReminders() {
  const [reminders, cars] = await Promise.all([getReminders(), getCars()]);
  const carsById = Object.fromEntries(cars.map(c => [c.id, c]));
  const relevant = reminders
    .filter(r => !r.done && daysUntil(r.dueDate) <= REMINDER_ALERT_THRESHOLD_DAYS)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  return { relevant, carsById };
}

function renderRemindersModal(relevant, carsById) {
  document.getElementById('reminders-modal-list').innerHTML = relevant.length
    ? relevant.map(r => reminderAlertRowHTML(r, carsById[r.carId])).join('')
    : `<div class="empty small">Срочных напоминаний нет 👍</div>`;
}

/** Открыть окно напоминаний по нажатию на колокольчик — показывает и пустое состояние. */
async function openRemindersModal() {
  const { relevant, carsById } = await getUrgentReminders();
  renderRemindersModal(relevant, carsById);
  document.getElementById('reminders-overlay').hidden = false;
}

/** Автопоказ при открытии приложения — если срочных напоминаний нет, окно не появляется.
 *  Само окно показывается автоматически не чаще одного раза в день: бейдж на колокольчике
 *  при этом всегда отражает актуальное наличие срочных напоминаний. */
async function checkUpcomingRemindersOnLoad() {
  const { relevant, carsById } = await getUrgentReminders();
  document.getElementById('reminders-badge').hidden = relevant.length === 0;
  if (!relevant.length) return;

  const today = todayStamp();
  const lastShown = await getSetting('lastReminderAutoShow');
  if (lastShown === today) return;

  renderRemindersModal(relevant, carsById);
  document.getElementById('reminders-overlay').hidden = false;
  await setSetting('lastReminderAutoShow', today);
}

document.getElementById('reminders-btn').addEventListener('click', openRemindersModal);

const remindersOverlay = document.getElementById('reminders-overlay');
document.getElementById('close-reminders-modal').addEventListener('click', () => { remindersOverlay.hidden = true; });
remindersOverlay.addEventListener('click', (e) => { if (e.target === remindersOverlay) remindersOverlay.hidden = true; });

// ---------- Модалка «Добавить автомобиль» ----------

const addOverlay = document.getElementById('add-vehicle-overlay');
const addForm = document.getElementById('add-vehicle-form');

// ---------- Маска гос. номера с подсказкой (только форма добавления) ----------

const PLATE_ALLOWED_LETTERS = new Set(['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']);
const PLATE_HINT_CHARS = ['А', '1', '2', '3', 'В', 'С'];
const PLATE_REGION_HINT_CHARS = ['7', '7'];

/** Оставляет только цифры и разрешённые по ГОСТу буквы, приводит к верхнему регистру. */
function filterPlateValue(raw) {
  return Array.from(raw.toUpperCase()).filter(ch => /[0-9]/.test(ch) || PLATE_ALLOWED_LETTERS.has(ch)).join('');
}

/** Для поля региона допустимы только цифры. */
function filterRegionValue(raw) {
  return raw.replace(/\D/g, '');
}

/** Рисует уже введённые символы обычным цветом, а оставшиеся по образцу — серым. */
function renderPlateGhost(ghostEl, value, hintChars) {
  let html = '';
  for (let i = 0; i < hintChars.length; i++) {
    html += i < value.length
      ? `<span class="plate-ghost-typed">${escapeHTML(value[i])}</span>`
      : `<span class="plate-ghost-hint">${escapeHTML(hintChars[i])}</span>`;
  }
  ghostEl.innerHTML = html;
}

/** Привязывает фильтрацию ввода + подсказку-образец к полю номера/региона. Возвращает функцию сброса.
 *  Если элемент не найден (например, index.html и script.js разошлись по версии),
 *  просто ничего не делает — это не должно ронять остальную часть скрипта. */
function attachPlateMask(inputEl, ghostEl, hintChars, filterFn, maxLen) {
  if (!inputEl || !ghostEl) return () => {};
  function handleInput() {
    const caret = inputEl.selectionStart;
    const before = inputEl.value;
    const caretAfterFilter = filterFn(before.slice(0, caret)).length;
    const filtered = filterFn(before).slice(0, maxLen);
    inputEl.value = filtered;
    const newCaret = Math.min(caretAfterFilter, filtered.length);
    inputEl.setSelectionRange(newCaret, newCaret);
    renderPlateGhost(ghostEl, filtered, hintChars);
  }
  inputEl.addEventListener('input', handleInput);
  renderPlateGhost(ghostEl, inputEl.value, hintChars);
  return () => renderPlateGhost(ghostEl, inputEl.value, hintChars);
}

const plateInput = document.getElementById('add-plate-input');
const plateRegionInput = document.getElementById('add-plate-region-input');
const refreshPlateGhost = attachPlateMask(
  plateInput, document.getElementById('add-plate-ghost'), PLATE_HINT_CHARS, filterPlateValue, PLATE_HINT_CHARS.length
);
const refreshPlateRegionGhost = attachPlateMask(
  plateRegionInput, document.getElementById('add-plate-region-ghost'), PLATE_REGION_HINT_CHARS, filterRegionValue, 3
);

function openAddVehicle() {
  addOverlay.hidden = false;
  addForm.querySelector('input[name="make"]').focus();
}

function closeAddVehicle() {
  addOverlay.hidden = true;
  addForm.reset();
  refreshPlateGhost();
  refreshPlateRegionGhost();
}

document.getElementById('add-vehicle-btn').addEventListener('click', openAddVehicle);
document.getElementById('close-add-vehicle').addEventListener('click', closeAddVehicle);
document.getElementById('cancel-add-vehicle').addEventListener('click', closeAddVehicle);
addOverlay.addEventListener('click', (e) => { if (e.target === addOverlay) closeAddVehicle(); });

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(addForm);
  const data = Object.fromEntries(fd.entries());
  const photoFile = fd.get('photo');
  const plate = [data.plate, data.plateRegion].filter(Boolean).join(' ').trim();

  if (!data.make?.trim() && !data.model?.trim() && !data.name?.trim()) {
    alert('Укажите хотя бы марку, модель или название автомобиля');
    return;
  }

  const submitBtn = addForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const car = await addCar({
      make: data.make, model: data.model, name: data.name,
      type: data.type, year: data.year ? Number(data.year) : null,
      plate, vin: data.vin,
      mileage: data.mileage, unit: data.unit, status: data.status
    });

    if (photoFile && photoFile.size > 0) {
      await addPhoto(car.id, photoFile, { setAsMain: true });
    } else {
      await addPhoto(car.id, generateCarPhotoDataURL(car.type), { setAsMain: true });
    }

    closeAddVehicle();
    await renderVehicles();
  } catch (err) {
    console.error(err);
    alert('Не удалось добавить автомобиль: ' + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Меню: резервная копия данных ----------

const menuOverlay = document.getElementById('menu-overlay');

document.getElementById('menu-btn').addEventListener('click', () => { menuOverlay.hidden = false; });
document.getElementById('close-menu').addEventListener('click', () => { menuOverlay.hidden = true; });
menuOverlay.addEventListener('click', (e) => { if (e.target === menuOverlay) menuOverlay.hidden = true; });

document.getElementById('export-data-btn').addEventListener('click', async () => {
  try {
    const payload = await exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moy-transport-backup-${todayStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert('Не удалось создать резервную копию: ' + err.message);
  }
});

document.getElementById('import-data-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const result = await importAllData(payload);
    alert(`Восстановлено: ${result.cars} авто, ${result.expenses} расходов, ${result.reminders} напоминаний, ${result.photos} фото, ${result.categories} категорий`);
    menuOverlay.hidden = true;
    await renderVehicles();
  } catch (err) {
    console.error(err);
    alert('Не удалось восстановить данные: файл повреждён или имеет неверный формат');
  } finally {
    e.target.value = '';
  }
});

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- PWA: регистрация service worker ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}
