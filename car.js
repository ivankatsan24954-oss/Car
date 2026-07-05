/* car.js — экран подробной информации об автомобиле.
   Все данные читаются/пишутся в IndexedDB (db.js + storage.js), ничего не мокается. */

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

let CURRENT_CAR_ID = null;

// ---------- Форматирование ----------

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('ru-RU') + ' ₽';
}

function formatMileage(km, unit = 'км') {
  return Number(km || 0).toLocaleString('ru-RU') + ' ' + unit;
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

function daysUntil(iso) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

/** Статус напоминания — ровно два состояния, как просили: активно / просрочено. */
function reminderStatus(iso) {
  return daysUntil(iso) < 0
    ? { key: 'overdue', label: 'Просрочено' }
    : { key: 'active', label: 'Активно' };
}

function emptyRow(text) {
  return `<div class="empty small">${text}</div>`;
}

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- Разметка строк ----------

function expenseRowHTML(expense) {
  const icon = EXPENSE_ICONS[expense.category] || EXPENSE_ICONS['Прочее'];
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

function repairRowHTML(expense) {
  return `
    <div class="list-row" data-expense-id="${expense.id}">
      <div class="row-icon">🔧</div>
      <div class="row-main">
        <div class="row-title">${escapeHTML(expense.note) || 'Ремонт'}</div>
        <div class="row-sub">${formatDateRu(expense.date)}</div>
      </div>
      <div class="row-amount">${formatMoney(expense.amount)}</div>
      <button class="row-delete" data-action="delete-expense" data-id="${expense.id}" title="Удалить" aria-label="Удалить запись ремонта">✕</button>
    </div>
  `;
}

const REMINDER_TYPE_LABEL = { tech: 'ТО', insurance: 'Страховка', oil: 'Масло', tires: 'Шины', other: 'Другое' };

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

  document.title = `${car.name} — Мой транспорт`;
  document.getElementById('car-title').textContent = car.name;
  document.getElementById('car-name').textContent = car.name;

  const statusEl = document.getElementById('car-status');
  statusEl.className = `status-chip status-${car.status}`;
  statusEl.innerHTML = `<span class="dot"></span>${STATUS_LABEL[car.status] || STATUS_LABEL.ok}`;

  const photoFrame = document.getElementById('photo-frame');
  if (car.mainPhotoId) {
    const photo = await getPhoto(car.mainPhotoId);
    photoFrame.innerHTML = photo
      ? `<img src="${typeof photo.data === 'string' ? photo.data : URL.createObjectURL(photo.data)}" alt="Фото ${escapeHTML(car.name)}" class="photo-img">`
      : fallbackPhotoHTML(car.type);
  } else {
    photoFrame.innerHTML = fallbackPhotoHTML(car.type);
  }

  document.getElementById('info-make').textContent = car.make || '—';
  document.getElementById('info-model').textContent = car.model || '—';
  document.getElementById('info-year').textContent = car.year || '—';
  document.getElementById('info-vin').textContent = car.vin || '—';
  document.getElementById('info-plate').textContent = car.plate || '—';
  document.getElementById('info-mileage').textContent = formatMileage(car.mileage, car.unit);

  await renderExpensesAndRepairs();
  await renderReminders();
}

// ---------- Форма «Добавить расход» ----------

const expenseForm = document.getElementById('expense-form');
const toggleExpenseBtn = document.getElementById('toggle-expense-form');

toggleExpenseBtn.addEventListener('click', () => {
  const hidden = expenseForm.hasAttribute('hidden');
  if (hidden) {
    expenseForm.removeAttribute('hidden');
    expenseForm.querySelector('input[name="date"]').value = todayISO();
    expenseForm.querySelector('input[name="date"]').focus();
    toggleExpenseBtn.textContent = '− Скрыть форму';
  } else {
    expenseForm.setAttribute('hidden', '');
    toggleExpenseBtn.textContent = '+ Добавить расход';
  }
});

document.getElementById('cancel-expense-form').addEventListener('click', () => {
  expenseForm.reset();
  expenseForm.setAttribute('hidden', '');
  toggleExpenseBtn.textContent = '+ Добавить расход';
});

expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(expenseForm).entries());

  if (!data.amount || Number(data.amount) <= 0) {
    alert('Укажите сумму расхода больше нуля');
    return;
  }

  try {
    await addExpense({
      carId: CURRENT_CAR_ID,
      category: data.category,
      amount: Number(data.amount),
      date: data.date || todayISO(),
      note: data.note || ''
    });
    expenseForm.reset();
    expenseForm.setAttribute('hidden', '');
    toggleExpenseBtn.textContent = '+ Добавить расход';
    await renderExpensesAndRepairs();
  } catch (err) {
    console.error(err);
    alert('Не удалось добавить расход: ' + err.message);
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
});

// ---------- Навигация назад ----------

document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = 'index.html';
});

// ---------- Инициализация ----------

renderCarDetail().catch(err => {
  console.error(err);
  document.getElementById('car-detail').innerHTML = `<div class="empty">Не удалось загрузить данные автомобиля</div>`;
});
