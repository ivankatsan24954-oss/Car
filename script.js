/* script.js — главный экран (список автомобилей).
   Данные читаются из IndexedDB через storage.js. При первом запуске
   (если база пуста) создаётся демонстрационный набор данных. */

function formatMileage(km, unit = 'км') {
  return Number(km || 0).toLocaleString('ru-RU') + ' ' + unit;
}

function vehicleCardHTML(car) {
  const icon = VEHICLE_ICONS[car.type] || VEHICLE_ICONS.car;
  return `
    <article class="vehicle-card ${car.status === 'sold' ? 'is-sold' : ''}" data-id="${car.id}" tabindex="0" role="button" aria-label="Открыть ${car.name}">
      <div class="vehicle-photo">${icon}</div>
      <div class="vehicle-info">
        <h2 class="vehicle-name">${car.name}</h2>
        <div class="vehicle-meta-row">
          <span class="plate">${car.plate || '—'}</span>
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
    : `<div class="empty">Автомобилей пока нет</div>`;

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

// ---------- Кнопка добавления (демо-заглушка — форма не входит в это ТЗ) ----------
document.getElementById('add-vehicle-btn').addEventListener('click', () => {
  alert('Экран добавления автомобиля будет реализован отдельно.');
});
