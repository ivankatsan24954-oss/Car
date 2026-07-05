/* script.js — главный экран (список автомобилей).
   Данные читаются из IndexedDB через storage.js. При первом запуске
   (если база пуста) создаётся демонстрационный набор данных. */

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
    : `<div class="empty">Автомобилей пока нет.<br>Нажмите «Добавить автомобиль», чтобы завести первую карточку.</div>`;

  list.querySelectorAll('.vehicle-card').forEach(card => {
    const open = () => { window.location.href = `car.html?id=${card.dataset.id}`; };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

// ---------- Демо-данные (создаются один раз, если база пуста) ----------
async function seedIfEmpty() {
  const existing = await getCars();
  if (existing.length > 0) return;

  const transit = await addCar({
    make: 'Ford', model: 'Transit', name: 'Ford Transit',
    plate: 'А 123 ВС 777', vin: 'WF0XXXTTGXKA12345',
    year: 2019, mileage: 120000, type: 'van', status: 'ok'
  });
  await addPhoto(transit.id, generateCarPhotoDataURL('van'), { setAsMain: true });
  await addExpense({ carId: transit.id, category: 'Топливо', amount: 3500, date: '2026-06-30', note: 'Полный бак' });
  await addExpense({ carId: transit.id, category: 'Ремонт', amount: 8200, date: '2026-05-14', note: 'Замена тормозных колодок' });
  await addExpense({ carId: transit.id, category: 'Обслуживание', amount: 6400, date: '2026-04-02', note: 'ТО-3' });
  await addReminder({ carId: transit.id, title: 'Замена масла', type: 'oil', dueDate: '2026-07-07' });

  const hilux = await addCar({
    make: 'Toyota', model: 'Hilux', name: 'Toyota Hilux',
    plate: 'В 456 ДЕ 777', vin: 'MR0FR22G701234567',
    year: 2021, mileage: 85000, type: 'pickup', status: 'ok'
  });
  await addPhoto(hilux.id, generateCarPhotoDataURL('pickup'), { setAsMain: true });
  await addExpense({ carId: hilux.id, category: 'Обслуживание', amount: 8800, date: '2026-06-10', note: 'ТО-4' });
  await addExpense({ carId: hilux.id, category: 'Топливо', amount: 4100, date: '2026-06-28' });
  await addReminder({ carId: hilux.id, title: 'Страховка', type: 'insurance', dueDate: '2026-07-22' });

  const jcb = await addCar({
    make: 'JCB', model: '3CX', name: 'JCB 3CX',
    plate: 'С 789 ФГ 777', vin: 'SLP3CXJZJ0E123456',
    year: 2018, mileage: 3200, unit: 'м/ч', type: 'excavator', status: 'repair'
  });
  await addPhoto(jcb.id, generateCarPhotoDataURL('excavator'), { setAsMain: true });
  await addExpense({ carId: jcb.id, category: 'Ремонт', amount: 224000, date: '2026-06-15', note: 'Ремонт гидравлики' });
  await addExpense({ carId: jcb.id, category: 'Ремонт', amount: 31500, date: '2026-03-02', note: 'Замена гидрошлангов' });
  await addReminder({ carId: jcb.id, title: 'Техосмотр', type: 'tech', dueDate: '2026-08-01' });

  const vesta = await addCar({
    make: 'Lada', model: 'Vesta', name: 'Lada Vesta',
    plate: 'Е 045 КХ 199', vin: 'XTAGFL110M0123456',
    year: 2022, mileage: 61200, type: 'car', status: 'ok'
  });
  await addPhoto(vesta.id, generateCarPhotoDataURL('car'), { setAsMain: true });
  await addExpense({ carId: vesta.id, category: 'Топливо', amount: 2600, date: '2026-06-25' });
  await addReminder({ carId: vesta.id, title: 'Замена шин', type: 'tires', dueDate: '2026-09-01' });

  const gazelle = await addCar({
    make: 'ГАЗ', model: 'ГАЗель NEXT', name: 'ГАЗель NEXT',
    plate: 'М 512 АА 777', vin: 'X96A3902RH0123456',
    year: 2016, mileage: 156000, type: 'van', status: 'sold'
  });
  await addPhoto(gazelle.id, generateCarPhotoDataURL('van'), { setAsMain: true });
  await addExpense({ carId: gazelle.id, category: 'Ремонт', amount: 12000, date: '2025-11-20', note: 'Ремонт подвески' });
}

(async function init() {
  try {
    await seedIfEmpty();
  } catch (err) {
    console.error('Не удалось создать демо-данные:', err);
  }
  await renderVehicles();
})();

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
