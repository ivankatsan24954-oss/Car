/* car.js — экран подробной информации об автомобиле.
   Все данные читаются/пишутся в IndexedDB (db.js + storage.js), ничего не мокается. */

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

let CURRENT_CAR_ID = null;
let CUSTOM_CATEGORIES = [];

// ---------- Форматирование ----------

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('ru-RU') + ' ₽';
}

function formatDateRu(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyRow(text) {
  return `<div class="empty small">${text}</div>`;
}

// ---------- Разметка строк ----------

function expenseRowHTML(expense) {
  const icon = expenseIcon(expense.category, CUSTOM_CATEGORIES);
  return `
    <div class="list-row" data-expense-id="${expense.id}">
      <div class="row-icon">${icon}</div>
      <div class="row-main">
        <div class="row-title">${escapeHTML(expense.category)}</div>
        <div class="row-sub">${formatDateRu(expense.date)}${expense.note ? ' • ' + escapeHTML(expense.note) : ''}</div>
      </div>
      <div class="row-amount">${formatMoney(expense.amount)}</div>
      <button class="row-delete" data-action="delete-expense" data-id="${expense.id}" title="Удалить" aria-label="Удалить расход">✕</button>
    </div>
  `;
}

function repairSubtitle(expense) {
  const parts = [formatDateRu(expense.date)];
  if (expense.repairShop) parts.push(escapeHTML(expense.repairShop));
  if (expense.repairMileage != null) parts.push(formatMileage(expense.repairMileage, 'км'));
  return parts.join(' • ');
}

function repairRowHTML(expense) {
  const status = expense.repairStatus === 'in_progress' ? 'in-progress' : 'done';
  const statusLabel = REPAIR_STATUS_LABEL[expense.repairStatus] || REPAIR_STATUS_LABEL.done;
  const title = escapeHTML(expense.repairWork || expense.note || 'Ремонт');
  return `
    <div class="list-row" data-expense-id="${expense.id}">
      <div class="row-icon">🔧</div>
      <div class="row-main">
        <div class="row-title">${title}</div>
        <div class="row-sub">${repairSubtitle(expense)}</div>
      </div>
      <div class="row-end row-end-stacked">
        <div class="row-amount">${formatMoney(expense.amount)}</div>
        <span class="status-pill status-pill-${status}">${statusLabel}</span>
      </div>
      <button class="row-edit" data-action="edit-repair" data-id="${expense.id}" title="Детали ремонта" aria-label="Редактировать детали ремонта">✏️</button>
      <button class="row-delete" data-action="delete-expense" data-id="${expense.id}" title="Удалить" aria-label="Удалить запись ремонта">✕</button>
    </div>
  `;
}



function reminderRowHTML(reminder) {
  const status = reminderStatus(reminder.dueDate);
  return `
    <div class="list-row" data-reminder-id="${reminder.id}">
      <div class="row-icon">${REMINDER_ICONS[reminder.type] || REMINDER_ICONS.other}</div>
      <div class="row-main">
        <div class="row-title">${REMINDER_TYPE_LABEL[reminder.type] || 'Напоминание'}${reminder.note ? ' • ' + escapeHTML(reminder.note) : ''}</div>
        <div class="row-sub">${formatDateRu(reminder.dueDate)}</div>
      </div>
      <div class="row-end">
        <span class="status-pill status-pill-${status.key}">${status.label}</span>
      </div>
      <button class="row-delete" data-action="delete-reminder" data-id="${reminder.id}" title="Удалить" aria-label="Удалить напоминание">✕</button>
    </div>
  `;
}

function fallbackPhotoHTML(type) {
  const icon = VEHICLE_ICONS[type] || VEHICLE_ICONS.car;
  return `<div class="photo-fallback">${icon}</div>`;
}

// ---------- Загрузка и рендер секций ----------

async function renderExpensesAndRepairs() {
  const expenses = await getExpenses({ carId: CURRENT_CAR_ID });
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  document.getElementById('expenses-total').textContent = formatMoney(total);
  document.getElementById('expenses-list').innerHTML = expenses.length
    ? expenses.map(expenseRowHTML).join('')
    : emptyRow('Расходов пока нет');

  const repairs = expenses.filter(e => e.category === 'Ремонт');
  document.getElementById('repairs-list').innerHTML = repairs.length
    ? repairs.map(repairRowHTML).join('')
    : emptyRow('Ремонтов пока не было');
}

async function renderReminders() {
  const reminders = await getReminders({ carId: CURRENT_CAR_ID });
  document.getElementById('reminders-list').innerHTML = reminders.length
    ? reminders.map(reminderRowHTML).join('')
    : emptyRow('Напоминаний нет');
}

async function renderPhoto(car) {
  const photoFrame = document.getElementById('photo-frame');
  if (car.mainPhotoId) {
    const photo = await getPhoto(car.mainPhotoId);
    photoFrame.innerHTML = photo
      ? `<img src="${photoSrc(photo)}" alt="Фото ${escapeHTML(car.name)}" class="photo-img">`
      : fallbackPhotoHTML(car.type);
  } else {
    photoFrame.innerHTML = fallbackPhotoHTML(car.type);
  }
}

function renderCarHeaderAndInfo(car) {
  document.title = `${car.name} — Мой транспорт`;
  document.getElementById('car-title').textContent = car.name;
  document.getElementById('car-name').textContent = car.name;

  const statusEl = document.getElementById('car-status');
  statusEl.className = `status-chip is-tappable status-${car.status}`;
  statusEl.innerHTML = `<span class="dot"></span>${STATUS_LABEL[car.status] || STATUS_LABEL.ok}`;

  document.getElementById('info-make').textContent = car.make || '—';
  document.getElementById('info-model').textContent = car.model || '—';
  document.getElementById('info-year').textContent = car.year || '—';
  document.getElementById('info-vin').textContent = car.vin || '—';
  document.getElementById('info-plate').innerHTML = plateBadgeHTML(car.plate);
  document.getElementById('info-mileage').textContent = formatMileage(car.mileage, car.unit);
}

async function renderCarDetail() {
  const params = new URLSearchParams(window.location.search);
  const carId = params.get('id');
  const main = document.getElementById('car-detail');

  if (!carId) {
    main.innerHTML = `<div class="empty">Автомобиль не выбран</div>`;
    return;
  }

  const car = await getCar(carId);
  if (!car) {
    main.innerHTML = `<div class="empty">Автомобиль не найден.<br>Возможно, он был удалён.</div>`;
    return;
  }

  CURRENT_CAR_ID = car.id;

  renderCarHeaderAndInfo(car);
  await renderPhoto(car);
  await renderExpensesAndRepairs();
  await renderReminders();
}

// ---------- Форма «Добавить расход» ----------

const expenseForm = document.getElementById('expense-form');
const toggleExpenseBtn = document.getElementById('toggle-expense-form');
const categorySelect = document.getElementById('expense-category-select');
const customCategoryWrap = document.getElementById('custom-category-wrap');
const repairFields = document.getElementById('repair-fields');

/** Подгружает пользовательские категории из БД и добавляет их в select
 *  (перед пунктом «+ Своя категория…», не трогая стандартные). */
async function refreshCategoryOptions() {
  CUSTOM_CATEGORIES = await getCategories();
  const customTrigger = categorySelect.querySelector('option[value="__custom__"]');
  categorySelect.querySelectorAll('option[data-custom="1"]').forEach(o => o.remove());
  CUSTOM_CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = `${cat.icon} ${cat.name}`;
    opt.dataset.custom = '1';
    categorySelect.insertBefore(opt, customTrigger);
  });
}

function syncCategoryDependentFields() {
  repairFields.hidden = categorySelect.value !== 'Ремонт';
  customCategoryWrap.hidden = categorySelect.value !== '__custom__';
}

categorySelect.addEventListener('change', syncCategoryDependentFields);

function resetExpenseForm() {
  expenseForm.reset();
  expenseForm.setAttribute('hidden', '');
  toggleExpenseBtn.textContent = '+ Добавить расход';
  syncCategoryDependentFields();
}

toggleExpenseBtn.addEventListener('click', () => {
  const hidden = expenseForm.hasAttribute('hidden');
  if (hidden) {
    expenseForm.removeAttribute('hidden');
    expenseForm.querySelector('input[name="date"]').value = todayISO();
    expenseForm.querySelector('input[name="date"]').focus();
    toggleExpenseBtn.textContent = '− Скрыть форму';
  } else {
    resetExpenseForm();
  }
});

document.getElementById('cancel-expense-form').addEventListener('click', resetExpenseForm);

expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(expenseForm);
  const data = Object.fromEntries(fd.entries());

  if (!data.amount || Number(data.amount) <= 0) {
    alert('Укажите сумму расхода больше нуля');
    return;
  }

  let category = data.category;

  if (category === '__custom__') {
    const customName = (data.customCategory || '').trim();
    if (!customName) {
      alert('Укажите название новой категории');
      return;
    }
    try {
      const cat = await addCategory(customName);
      category = cat.name;
      await refreshCategoryOptions();
    } catch (err) {
      console.error(err);
      alert('Не удалось создать категорию: ' + err.message);
      return;
    }
  }

  const submitBtn = expenseForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const expense = await addExpense({
      carId: CURRENT_CAR_ID,
      category,
      amount: Number(data.amount),
      date: data.date || todayISO(),
      note: data.note || '',
      repairShop: data.repairShop,
      repairWork: data.repairWork,
      repairMileage: data.repairMileage,
      repairStatus: data.repairStatus
    });

    const repairPhoto = fd.get('repairPhoto');
    if (category === 'Ремонт' && repairPhoto && repairPhoto.size > 0) {
      const photo = await addPhoto(CURRENT_CAR_ID, repairPhoto, { setAsMain: false });
      await updateExpense(expense.id, { repairPhotoId: photo.id });
    }

    resetExpenseForm();
    await renderExpensesAndRepairs();
  } catch (err) {
    console.error(err);
    alert('Не удалось добавить расход: ' + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Форма «Добавить напоминание» ----------

const reminderForm = document.getElementById('reminder-form');
const toggleReminderBtn = document.getElementById('toggle-reminder-form');

toggleReminderBtn.addEventListener('click', () => {
  const hidden = reminderForm.hasAttribute('hidden');
  if (hidden) {
    reminderForm.removeAttribute('hidden');
    reminderForm.querySelector('input[name="dueDate"]').value = todayISO();
    toggleReminderBtn.textContent = '− Скрыть форму';
  } else {
    reminderForm.setAttribute('hidden', '');
    toggleReminderBtn.textContent = '+ Добавить напоминание';
  }
});

document.getElementById('cancel-reminder-form').addEventListener('click', () => {
  reminderForm.reset();
  reminderForm.setAttribute('hidden', '');
  toggleReminderBtn.textContent = '+ Добавить напоминание';
});

reminderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(reminderForm).entries());

  if (!data.dueDate) {
    alert('Укажите дату напоминания');
    return;
  }

  try {
    await addReminder({
      carId: CURRENT_CAR_ID,
      title: REMINDER_TYPE_LABEL[data.type] || 'Напоминание',
      type: data.type,
      dueDate: data.dueDate,
      note: data.note || ''
    });
    reminderForm.reset();
    reminderForm.setAttribute('hidden', '');
    toggleReminderBtn.textContent = '+ Добавить напоминание';
    await renderReminders();
  } catch (err) {
    console.error(err);
    alert('Не удалось добавить напоминание: ' + err.message);
  }
});

// ---------- Фото автомобиля (загрузка из галереи) ----------

document.getElementById('photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Выберите файл изображения');
    e.target.value = '';
    return;
  }

  try {
    await addPhoto(CURRENT_CAR_ID, file, { setAsMain: true });
    const car = await getCar(CURRENT_CAR_ID);
    await renderPhoto(car);
  } catch (err) {
    console.error(err);
    alert('Не удалось сохранить фото: ' + err.message);
  } finally {
    e.target.value = '';
  }
});

// ---------- Удаление записей (делегирование кликов) ----------

document.getElementById('car-detail').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === 'delete-expense') {
    if (!confirm('Удалить эту запись о расходе?')) return;
    try {
      await deleteExpense(id);
      await renderExpensesAndRepairs();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить расход: ' + err.message);
    }
  }

  if (btn.dataset.action === 'delete-reminder') {
    if (!confirm('Удалить это напоминание?')) return;
    try {
      await deleteReminder(id);
      await renderReminders();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить напоминание: ' + err.message);
    }
  }

  if (btn.dataset.action === 'edit-repair') {
    openEditRepairModal(id);
  }
});

// ---------- Детали ремонта (донаполнение после быстрого добавления) ----------

const editRepairOverlay = document.getElementById('edit-repair-overlay');
const editRepairForm = document.getElementById('edit-repair-form');
let EDITING_EXPENSE_ID = null;

async function openEditRepairModal(expenseId) {
  const expense = await getExpense(expenseId);
  if (!expense) return;
  EDITING_EXPENSE_ID = expenseId;
  editRepairForm.elements['repairShop'].value = expense.repairShop || '';
  editRepairForm.elements['repairMileage'].value = expense.repairMileage != null ? expense.repairMileage : '';
  editRepairForm.elements['repairWork'].value = expense.repairWork || '';
  editRepairForm.elements['note'].value = expense.note || '';
  editRepairForm.elements['repairStatus'].value = expense.repairStatus || 'done';
  editRepairForm.querySelector('input[name="repairPhoto"]').value = '';
  editRepairOverlay.hidden = false;
}

function closeEditRepairModal() {
  editRepairOverlay.hidden = true;
  EDITING_EXPENSE_ID = null;
}

document.getElementById('close-edit-repair').addEventListener('click', closeEditRepairModal);
document.getElementById('cancel-edit-repair').addEventListener('click', closeEditRepairModal);
editRepairOverlay.addEventListener('click', (e) => { if (e.target === editRepairOverlay) closeEditRepairModal(); });

editRepairForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!EDITING_EXPENSE_ID) return;
  const fd = new FormData(editRepairForm);
  const data = Object.fromEntries(fd.entries());

  const submitBtn = editRepairForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const patch = {
      repairShop: (data.repairShop || '').trim(),
      repairWork: (data.repairWork || '').trim(),
      repairMileage: data.repairMileage !== '' ? Number(data.repairMileage) : null,
      repairStatus: data.repairStatus || 'done',
      note: (data.note || '').trim()
    };

    const photoFile = fd.get('repairPhoto');
    if (photoFile && photoFile.size > 0) {
      const photo = await addPhoto(CURRENT_CAR_ID, photoFile, { setAsMain: false });
      patch.repairPhotoId = photo.id;
    }

    await updateExpense(EDITING_EXPENSE_ID, patch);
    closeEditRepairModal();
    await renderExpensesAndRepairs();
  } catch (err) {
    console.error(err);
    alert('Не удалось сохранить детали ремонта: ' + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Быстрая смена статуса (тап по чипу) ----------

const statusPickerOverlay = document.getElementById('status-picker-overlay');

document.getElementById('car-status').addEventListener('click', () => {
  statusPickerOverlay.hidden = false;
});

document.getElementById('close-status-picker').addEventListener('click', () => {
  statusPickerOverlay.hidden = true;
});

statusPickerOverlay.addEventListener('click', (e) => {
  if (e.target === statusPickerOverlay) statusPickerOverlay.hidden = true;
});

document.getElementById('status-options').addEventListener('click', async (e) => {
  const btn = e.target.closest('.status-option');
  if (!btn) return;
  try {
    const car = await updateCar(CURRENT_CAR_ID, { status: btn.dataset.status });
    renderCarHeaderAndInfo(car);
    statusPickerOverlay.hidden = true;
  } catch (err) {
    console.error(err);
    alert('Не удалось изменить статус: ' + err.message);
  }
});

// ---------- Редактирование данных автомобиля ----------

const editCarOverlay = document.getElementById('edit-car-overlay');
const editCarForm = document.getElementById('edit-car-form');

async function openEditCarModal() {
  const car = await getCar(CURRENT_CAR_ID);
  if (!car) return;
  editCarForm.elements['type'].value = car.type || 'car';
  editCarForm.elements['make'].value = car.make || '';
  editCarForm.elements['model'].value = car.model || '';
  editCarForm.elements['name'].value = car.name || '';
  editCarForm.elements['year'].value = car.year || '';
  editCarForm.elements['plate'].value = car.plate || '';
  editCarForm.elements['vin'].value = car.vin || '';
  editCarForm.elements['mileage'].value = car.mileage || '';
  editCarForm.elements['unit'].value = car.unit || 'км';
  editCarForm.elements['status'].value = car.status || 'ok';
  editCarOverlay.hidden = false;
}

function closeEditCarModal() {
  editCarOverlay.hidden = true;
}

document.getElementById('edit-car-btn').addEventListener('click', openEditCarModal);
document.getElementById('close-edit-car').addEventListener('click', closeEditCarModal);
document.getElementById('cancel-edit-car').addEventListener('click', closeEditCarModal);
editCarOverlay.addEventListener('click', (e) => { if (e.target === editCarOverlay) closeEditCarModal(); });

editCarForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(editCarForm).entries());

  if (!data.make?.trim() && !data.model?.trim() && !data.name?.trim()) {
    alert('Укажите хотя бы марку, модель или название автомобиля');
    return;
  }

  const submitBtn = editCarForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const make = (data.make || '').trim();
    const model = (data.model || '').trim();
    const name = (data.name && data.name.trim()) || [make, model].filter(Boolean).join(' ');

    const car = await updateCar(CURRENT_CAR_ID, {
      type: data.type,
      make,
      model,
      name,
      year: data.year ? Number(data.year) : null,
      plate: (data.plate || '').trim(),
      vin: (data.vin || '').trim(),
      mileage: Number(data.mileage) || 0,
      unit: data.unit,
      status: data.status
    });

    renderCarHeaderAndInfo(car);
    await renderPhoto(car);
    closeEditCarModal();
  } catch (err) {
    console.error(err);
    alert('Не удалось сохранить изменения: ' + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Удаление автомобиля насовсем ----------

document.getElementById('delete-car-btn').addEventListener('click', async () => {
  const car = await getCar(CURRENT_CAR_ID);
  const name = car ? car.name : 'этот автомобиль';
  if (!confirm(`Удалить «${name}» насовсем?\nБудут удалены все расходы, напоминания и фото. Это действие нельзя отменить.`)) return;

  try {
    await deleteCar(CURRENT_CAR_ID);
    window.location.href = 'index.html';
  } catch (err) {
    console.error(err);
    alert('Не удалось удалить автомобиль: ' + err.message);
  }
});

// ---------- Навигация назад ----------

document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = 'index.html';
});

// ---------- PWA: регистрация service worker ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}

// ---------- Инициализация ----------

(async function initCarPage() {
  try {
    await refreshCategoryOptions();
  } catch (err) {
    console.error('Не удалось загрузить категории:', err);
  }
  try {
    await renderCarDetail();
  } catch (err) {
    console.error(err);
    document.getElementById('car-detail').innerHTML = `<div class="empty">Не удалось загрузить данные автомобиля</div>`;
  }
})();
