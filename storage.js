/* storage.js — CRUD-операции над данными приложения (поверх db.js).
   Никакого UI здесь нет: только функции для чтения/записи в IndexedDB. */

// ---------- Вспомогательные утилиты ----------

function generateId() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function nowISO() {
  return new Date().toISOString();
}

/** Конвертирует Blob/File в base64-строку (data URL). */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Конвертирует base64 data URL обратно в Blob. */
function base64ToBlob(base64) {
  const [meta, data] = base64.split(',');
  const mimeMatch = meta.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// =========================================================
//                        АВТОМОБИЛИ
// =========================================================

/**
 * Добавляет новый автомобиль.
 * @param {{name:string, plate?:string, type?:string, year?:number,
 *          mileage?:number, unit?:string, status?:string}} data
 * @returns {Promise<object>} созданная запись автомобиля
 */
async function addCar(data) {
  if (!data || !data.name || !String(data.name).trim()) {
    if (!data || !((data.make && data.make.trim()) || (data.model && data.model.trim()))) {
      throw new Error('У автомобиля должно быть название');
    }
  }
  const make = (data.make || '').trim();
  const model = (data.model || '').trim();
  const name = (data.name && String(data.name).trim()) || [make, model].filter(Boolean).join(' ');

  const car = {
    id: generateId(),
    name,
    make,
    model,
    vin: (data.vin || '').trim(),
    plate: (data.plate || '').trim(),
    type: data.type || 'car',
    year: data.year != null ? Number(data.year) : null,
    mileage: Number(data.mileage) || 0,
    unit: data.unit || 'км',
    status: data.status || 'ok', // 'ok' | 'repair' | 'sold'
    mainPhotoId: data.mainPhotoId || null,
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
  await DB.put(DB.STORES.cars, car);
  return car;
}

/**
 * Возвращает список автомобилей.
 * @param {{status?:string}} [filter] опциональный фильтр по статусу
 * @returns {Promise<object[]>}
 */
async function getCars(filter) {
  const list = filter && filter.status
    ? await DB.getAllByIndex(DB.STORES.cars, 'status', filter.status)
    : await DB.getAll(DB.STORES.cars);
  return list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

/** Возвращает один автомобиль по id (или undefined, если не найден). */
async function getCar(id) {
  return DB.get(DB.STORES.cars, id);
}

/**
 * Обновляет автомобиль. Принимает частичный набор полей.
 * @param {string} id
 * @param {object} patch
 * @returns {Promise<object>} обновлённая запись
 */
async function updateCar(id, patch) {
  const existing = await DB.get(DB.STORES.cars, id);
  if (!existing) throw new Error(`Автомобиль с id="${id}" не найден`);
  const updated = { ...existing, ...patch, id: existing.id, updatedAt: nowISO() };
  await DB.put(DB.STORES.cars, updated);
  return updated;
}

/**
 * Удаляет автомобиль и каскадно все связанные с ним расходы,
 * напоминания и фотографии.
 * @param {string} id
 */
async function deleteCar(id) {
  await DB.deleteByIndex(DB.STORES.expenses, 'carId', id);
  await DB.deleteByIndex(DB.STORES.reminders, 'carId', id);
  await DB.deleteByIndex(DB.STORES.photos, 'carId', id);
  await DB.delete(DB.STORES.cars, id);
}

// =========================================================
//                         РАСХОДЫ
// =========================================================

/**
 * Добавляет запись о расходе.
 * @param {{carId:string, category?:string, amount:number, date?:string, note?:string}} data
 */
async function addExpense(data) {
  if (!data || !data.carId) throw new Error('Расход должен быть привязан к автомобилю (carId)');
  const expense = {
    id: generateId(),
    carId: data.carId,
    category: data.category || 'Прочее',
    amount: Number(data.amount) || 0,
    date: data.date || nowISO().slice(0, 10),
    note: (data.note || '').trim(),
    createdAt: nowISO()
  };

  // Расширенные поля ремонта — заполняются сразу (если переданы) либо донаполняются
  // позже через updateExpense. Хранятся только у записей категории «Ремонт».
  if (expense.category === 'Ремонт') {
    expense.repairShop = (data.repairShop || '').trim();
    expense.repairWork = (data.repairWork || '').trim();
    expense.repairMileage = (data.repairMileage !== undefined && data.repairMileage !== null && data.repairMileage !== '')
      ? Number(data.repairMileage) : null;
    expense.repairPhotoId = data.repairPhotoId || null;
    expense.repairStatus = data.repairStatus || 'done'; // 'in_progress' | 'done'
  }

  await DB.put(DB.STORES.expenses, expense);
  return expense;
}

/**
 * Возвращает расходы. Если передан carId — только по этому автомобилю.
 * @param {{carId?:string}} [filter]
 */
async function getExpenses(filter) {
  const list = filter && filter.carId
    ? await DB.getAllByIndex(DB.STORES.expenses, 'carId', filter.carId)
    : await DB.getAll(DB.STORES.expenses);
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function getExpense(id) {
  return DB.get(DB.STORES.expenses, id);
}

async function updateExpense(id, patch) {
  const existing = await DB.get(DB.STORES.expenses, id);
  if (!existing) throw new Error(`Расход с id="${id}" не найден`);
  const updated = { ...existing, ...patch, id: existing.id };
  await DB.put(DB.STORES.expenses, updated);
  return updated;
}

async function deleteExpense(id) {
  return DB.delete(DB.STORES.expenses, id);
}

// =========================================================
//                       НАПОМИНАНИЯ
// =========================================================

/**
 * Добавляет напоминание.
 * @param {{carId:string, title:string, type?:string, dueDate:string, note?:string}} data
 */
async function addReminder(data) {
  if (!data || !data.carId) throw new Error('Напоминание должно быть привязано к автомобилю (carId)');
  if (!data.title || !String(data.title).trim()) throw new Error('У напоминания должно быть название');
  if (!data.dueDate) throw new Error('У напоминания должна быть дата (dueDate)');

  const reminder = {
    id: generateId(),
    carId: data.carId,
    title: String(data.title).trim(),
    type: data.type || 'other',
    dueDate: data.dueDate,
    done: !!data.done,
    note: (data.note || '').trim(),
    createdAt: nowISO()
  };
  await DB.put(DB.STORES.reminders, reminder);
  return reminder;
}

/**
 * Возвращает напоминания. Если передан carId — только по этому автомобилю.
 * @param {{carId?:string, done?:boolean}} [filter]
 */
async function getReminders(filter) {
  let list = filter && filter.carId
    ? await DB.getAllByIndex(DB.STORES.reminders, 'carId', filter.carId)
    : await DB.getAll(DB.STORES.reminders);
  if (filter && typeof filter.done === 'boolean') {
    list = list.filter(r => r.done === filter.done);
  }
  return list.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
}

async function getReminder(id) {
  return DB.get(DB.STORES.reminders, id);
}

async function updateReminder(id, patch) {
  const existing = await DB.get(DB.STORES.reminders, id);
  if (!existing) throw new Error(`Напоминание с id="${id}" не найдено`);
  const updated = { ...existing, ...patch, id: existing.id };
  await DB.put(DB.STORES.reminders, updated);
  return updated;
}

async function deleteReminder(id) {
  return DB.delete(DB.STORES.reminders, id);
}

// =========================================================
//                        ФОТОГРАФИИ
// =========================================================

/**
 * Сохраняет фотографию автомобиля.
 * @param {string} carId
 * @param {Blob|File|string} fileOrBase64 — Blob/File либо готовая base64 data URL
 * @param {{setAsMain?:boolean}} [options]
 * @returns {Promise<object>} созданная запись фотографии
 */
async function addPhoto(carId, fileOrBase64, options = {}) {
  if (!carId) throw new Error('Фотография должна быть привязана к автомобилю (carId)');
  if (!fileOrBase64) throw new Error('Не передан файл или base64-данные фотографии');

  let data, mimeType;
  if (typeof fileOrBase64 === 'string') {
    data = fileOrBase64; // храним как base64 data URL
    const mimeMatch = fileOrBase64.match(/data:(.*);base64/);
    mimeType = mimeMatch ? mimeMatch[1] : 'unknown';
  } else {
    data = fileOrBase64; // храним как Blob напрямую (IndexedDB поддерживает Blob нативно)
    mimeType = fileOrBase64.type || 'unknown';
  }

  const photo = {
    id: generateId(),
    carId,
    data,
    mimeType,
    createdAt: nowISO()
  };
  await DB.put(DB.STORES.photos, photo);

  if (options.setAsMain) {
    await updateCar(carId, { mainPhotoId: photo.id });
  }
  return photo;
}

/** Возвращает все фотографии указанного автомобиля. */
async function getPhotos(carId) {
  const list = await DB.getAllByIndex(DB.STORES.photos, 'carId', carId);
  return list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

async function getPhoto(id) {
  return DB.get(DB.STORES.photos, id);
}

async function deletePhoto(id) {
  const photo = await DB.get(DB.STORES.photos, id);
  await DB.delete(DB.STORES.photos, id);
  if (photo) {
    const car = await getCar(photo.carId);
    if (car && car.mainPhotoId === id) {
      await updateCar(car.id, { mainPhotoId: null });
    }
  }
  return photo;
}

/** Удаляет все фотографии автомобиля (используется при удалении автомобиля). */
async function deletePhotosByCar(carId) {
  return DB.deleteByIndex(DB.STORES.photos, 'carId', carId);
}

// =========================================================
//                 ПОЛЬЗОВАТЕЛЬСКИЕ КАТЕГОРИИ РАСХОДОВ
// =========================================================

// Базовые категории всегда доступны и не хранятся в БД — пользователь может
// только добавлять к ним свои, не переопределяя и не удаляя базовые.
const BUILTIN_EXPENSE_CATEGORIES = ['Топливо', 'Ремонт', 'Обслуживание', 'Страховка', 'Штрафы', 'Прочее'];

/**
 * Добавляет пользовательскую категорию расходов.
 * @param {string} name
 * @param {string} [icon] эмодзи-иконка; если не указана — используется значок по умолчанию
 */
async function addCategory(name, icon) {
  const clean = (name || '').trim();
  if (!clean) throw new Error('Укажите название категории');
  if (BUILTIN_EXPENSE_CATEGORIES.some(c => c.toLowerCase() === clean.toLowerCase())) {
    throw new Error('Такая категория уже есть среди стандартных');
  }
  const existing = await getCategories();
  const dup = existing.find(c => c.name.toLowerCase() === clean.toLowerCase());
  if (dup) return dup;

  const category = {
    id: generateId(),
    name: clean,
    icon: (icon || '').trim() || '🏷️',
    createdAt: nowISO()
  };
  await DB.put(DB.STORES.categories, category);
  return category;
}

/** Возвращает пользовательские категории расходов (без стандартных). */
async function getCategories() {
  const list = await DB.getAll(DB.STORES.categories);
  return list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

async function deleteCategory(id) {
  return DB.delete(DB.STORES.categories, id);
}

// =========================================================
//                    НАСТРОЙКИ ПРИЛОЖЕНИЯ
// =========================================================

/** Возвращает значение настройки по ключу (или undefined, если не задано). */
async function getSetting(key) {
  const row = await DB.get(DB.STORES.settings, key);
  return row ? row.value : undefined;
}

/** Сохраняет значение настройки по ключу. */
async function setSetting(key, value) {
  await DB.put(DB.STORES.settings, { key, value });
  return value;
}

// =========================================================
//                    ЭКСПОРТ / ИМПОРТ (бэкап)
// =========================================================

/**
 * Выгружает все данные приложения в один JSON-объект — удобно для бэкапа
 * перед переустановкой приложения или сменой телефона.
 */
async function exportAllData() {
  const [cars, expenses, reminders, photos, categories] = await Promise.all([
    DB.getAll(DB.STORES.cars),
    DB.getAll(DB.STORES.expenses),
    DB.getAll(DB.STORES.reminders),
    DB.getAll(DB.STORES.photos),
    DB.getAll(DB.STORES.categories)
  ]);

  // Blob нельзя сериализовать в JSON — конвертируем фото в base64.
  const safePhotos = await Promise.all(photos.map(async p => ({
    ...p,
    data: typeof p.data === 'string' ? p.data : await blobToBase64(p.data)
  })));

  return {
    exportedAt: nowISO(),
    version: 2,
    cars, expenses, reminders, categories,
    photos: safePhotos
  };
}

/**
 * Восстанавливает данные из объекта, созданного exportAllData().
 * По умолчанию дополняет текущие данные (не удаляя существующее).
 */
async function importAllData(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Некорректный файл резервной копии');
  const { cars = [], expenses = [], reminders = [], photos = [], categories = [] } = payload;

  for (const car of cars) await DB.put(DB.STORES.cars, car);
  for (const expense of expenses) await DB.put(DB.STORES.expenses, expense);
  for (const reminder of reminders) await DB.put(DB.STORES.reminders, reminder);
  for (const photo of photos) await DB.put(DB.STORES.photos, photo);
  for (const category of categories) await DB.put(DB.STORES.categories, category);

  return {
    cars: cars.length, expenses: expenses.length, reminders: reminders.length,
    photos: photos.length, categories: categories.length
  };
}

// ---------- Экспорт в глобальную область ----------

window.addCar = addCar;
window.getCars = getCars;
window.getCar = getCar;
window.updateCar = updateCar;
window.deleteCar = deleteCar;

window.addExpense = addExpense;
window.getExpenses = getExpenses;
window.getExpense = getExpense;
window.updateExpense = updateExpense;
window.deleteExpense = deleteExpense;

window.addReminder = addReminder;
window.getReminders = getReminders;
window.getReminder = getReminder;
window.updateReminder = updateReminder;
window.deleteReminder = deleteReminder;

window.addPhoto = addPhoto;
window.getPhotos = getPhotos;
window.getPhoto = getPhoto;
window.deletePhoto = deletePhoto;
window.deletePhotosByCar = deletePhotosByCar;

window.blobToBase64 = blobToBase64;
window.base64ToBlob = base64ToBlob;

window.exportAllData = exportAllData;
window.importAllData = importAllData;

window.BUILTIN_EXPENSE_CATEGORIES = BUILTIN_EXPENSE_CATEGORIES;
window.addCategory = addCategory;
window.getCategories = getCategories;
window.deleteCategory = deleteCategory;

window.getSetting = getSetting;
window.setSetting = setSetting;

// Также группируем всё в один объект — удобно для импорта одним именем
window.Storage = {
  addCar, getCars, getCar, updateCar, deleteCar,
  addExpense, getExpenses, getExpense, updateExpense, deleteExpense,
  addReminder, getReminders, getReminder, updateReminder, deleteReminder,
  addPhoto, getPhotos, getPhoto, deletePhoto, deletePhotosByCar,
  blobToBase64, base64ToBlob,
  exportAllData, importAllData,
  addCategory, getCategories, deleteCategory,
  getSetting, setSetting
};
