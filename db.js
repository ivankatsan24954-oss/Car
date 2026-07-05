/* db.js — инициализация IndexedDB и низкоуровневые операции над хранилищами.
   Никакой бизнес-логики и никакого UI — только доступ к базе. */

const DB_NAME = 'transportDB';
const DB_VERSION = 1;

const STORES = {
  cars: 'cars',
  expenses: 'expenses',
  reminders: 'reminders',
  photos: 'photos'
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Автомобили
      if (!db.objectStoreNames.contains(STORES.cars)) {
        const cars = db.createObjectStore(STORES.cars, { keyPath: 'id' });
        cars.createIndex('status', 'status', { unique: false });
        cars.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Расходы
      if (!db.objectStoreNames.contains(STORES.expenses)) {
        const expenses = db.createObjectStore(STORES.expenses, { keyPath: 'id' });
        expenses.createIndex('carId', 'carId', { unique: false });
        expenses.createIndex('date', 'date', { unique: false });
      }

      // Напоминания
      if (!db.objectStoreNames.contains(STORES.reminders)) {
        const reminders = db.createObjectStore(STORES.reminders, { keyPath: 'id' });
        reminders.createIndex('carId', 'carId', { unique: false });
        reminders.createIndex('dueDate', 'dueDate', { unique: false });
        reminders.createIndex('done', 'done', { unique: false });
      }

      // Фотографии (хранятся как Blob либо base64-строка в поле data)
      if (!db.objectStoreNames.contains(STORES.photos)) {
        const photos = db.createObjectStore(STORES.photos, { keyPath: 'id' });
        photos.createIndex('carId', 'carId', { unique: false });
        photos.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
    request.onblocked = () => console.warn('Обновление IndexedDB заблокировано — закройте другие вкладки приложения.');
  });

  return dbPromise;
}

function withStore(storeName, mode, callback) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;

    Promise.resolve(callback(store))
      .then(r => { result = r; })
      .catch(reject);

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DB = {
  STORES,
  openDB,

  getAll(storeName) {
    return withStore(storeName, 'readonly', store => reqToPromise(store.getAll()));
  },

  getAllByIndex(storeName, indexName, value) {
    return withStore(storeName, 'readonly', store => reqToPromise(store.index(indexName).getAll(value)));
  },

  get(storeName, id) {
    return withStore(storeName, 'readonly', store => reqToPromise(store.get(id)));
  },

  put(storeName, value) {
    return withStore(storeName, 'readwrite', store => reqToPromise(store.put(value))).then(() => value);
  },

  delete(storeName, id) {
    return withStore(storeName, 'readwrite', store => reqToPromise(store.delete(id)));
  },

  deleteByIndex(storeName, indexName, value) {
    return withStore(storeName, 'readwrite', store => new Promise((resolve, reject) => {
      const index = store.index(indexName);
      const request = index.openCursor(IDBKeyRange.only(value));
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    }));
  },

  clear(storeName) {
    return withStore(storeName, 'readwrite', store => reqToPromise(store.clear()));
  },

  count(storeName) {
    return withStore(storeName, 'readonly', store => reqToPromise(store.count()));
  }
};

window.DB = DB;
