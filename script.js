/* script.js — главный экран (список автомобилей).
   Данные читаются из IndexedDB через storage.js. При пустой базе
   показывается пустое состояние — никакие демо-машины не создаются. */

function vehicleCardHTML(car) {
  const icon = VEHICLE_ICONS[car.type] || VEHICLE_ICONS.car;
  return `
    <article class="vehicle-card ${car.status === 'sold' ? 'is-sold' : ''}" data-id="${car.id}" tabindex="0" role="button" aria-label="Открыть ${escapeHTML(car.name)}">
      <div class="vehicle-photo">${icon}</div>
      <div class="vehicle-info">
        <h2 class="vehicle-name">${escapeHTML(car.name)}</h2>
        <div class="vehicle-meta-row">
          <span class="plate">${escapeHTML(car.plate) || '—'}</span>
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

async function renderVehicles() {
  const list = document.getElementById('vehicle-list');
  const count = document.getElementById('fleet-count');
  const cars = await getCars();

  count.textContent = `${cars.length} ${pluralVehicles(cars.length)} в парке`;

  list.innerHTML = cars.length
    ? cars.map(vehicleCardHTML).join('')
    : `<div class="empty">Кажется, вы ещё не добавили автомобиль.<br>Нажмите «Добавить автомобиль», чтобы завести первую карточку.</div>`;

  list.querySelectorAll('.vehicle-card').forEach(card => {
    const open = () => { window.location.href = `car.html?id=${card.dataset.id}`; };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

(async function init() {
  await renderVehicles();
  await checkUpcomingReminders();
})();

// ---------- Уведомление: скорые и просроченные напоминания по всем машинам ----------

const REMINDER_ALERT_THRESHOLD_DAYS = 2; // показывать: просроченные + сегодня/завтра/через 2 дня

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

async function checkUpcomingReminders() {
  const [reminders, cars] = await Promise.all([getReminders(), getCars()]);
  const carsById = Object.fromEntries(cars.map(c => [c.id, c]));

  const relevant = reminders
    .filter(r => !r.done && daysUntil(r.dueDate) <= REMINDER_ALERT_THRESHOLD_DAYS)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  if (!relevant.length) return;

  document.getElementById('reminders-modal-list').innerHTML = relevant
    .map(r => reminderAlertRowHTML(r, carsById[r.carId]))
    .join('');
  document.getElementById('reminders-overlay').hidden = false;
}

const remindersOverlay = document.getElementById('reminders-overlay');
document.getElementById('close-reminders-modal').addEventListener('click', () => { remindersOverlay.hidden = true; });
remindersOverlay.addEventListener('click', (e) => { if (e.target === remindersOverlay) remindersOverlay.hidden = true; });

// ---------- Модалка «Добавить автомобиль» ----------

const addOverlay = document.getElementById('add-vehicle-overlay');
const addForm = document.getElementById('add-vehicle-form');

function openAddVehicle() {
  addOverlay.hidden = false;
  addForm.querySelector('input[name="make"]').focus();
}

function closeAddVehicle() {
  addOverlay.hidden = true;
  addForm.reset();
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
      plate: data.plate, vin: data.vin,
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
    alert(`Восстановлено: ${result.cars} авто, ${result.expenses} расходов, ${result.reminders} напоминаний, ${result.photos} фото`);
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
