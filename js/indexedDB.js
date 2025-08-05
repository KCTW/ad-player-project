// IndexedDB 相關工具函數
const DB_NAME = 'AdPlayerDB';
const DB_VERSION = 2;
const STORE_NAME = 'settings';
const LOG_STORE_NAME = 'logs';

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
                const logStore = db.createObjectStore(LOG_STORE_NAME, { autoIncrement: true });
                logStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

async function saveSetting(key, value) {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(value, key);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.errorCode);
    });
}

async function loadSetting(key) {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.errorCode);
    });
}

const LOG_LIMIT = 5000; // 日誌數量上限

async function saveLog(logData) {
    try {
        const db = await openDatabase();
        const transaction = db.transaction([LOG_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(LOG_STORE_NAME);
        store.add({ ...logData, timestamp: new Date().toISOString() });

        // 自動修剪日誌
        const countRequest = store.count();
        countRequest.onsuccess = () => {
            if (countRequest.result > LOG_LIMIT) {
                const deleteTransaction = db.transaction([LOG_STORE_NAME], 'readwrite');
                const deleteStore = deleteTransaction.objectStore(LOG_STORE_NAME);
                const index = deleteStore.index('timestamp');
                const oldestLogsRequest = index.openCursor(null, 'next');
                let logsToDelete = countRequest.result - LOG_LIMIT;

                oldestLogsRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor && logsToDelete > 0) {
                        cursor.delete();
                        logsToDelete--;
                        cursor.continue();
                    }
                };
            }
        };
    } catch (error) {
        console.error('Failed to save log to IndexedDB', error);
    }
}

async function getLogs(limit = 100) {
    const db = await openDatabase();
    const transaction = db.transaction([LOG_STORE_NAME], 'readonly');
    const store = transaction.objectStore(LOG_STORE_NAME);
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev');
    const logs = [];

    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && logs.length < limit) {
                logs.push(cursor.value);
                cursor.continue();
            } else {
                resolve(logs);
            }
        };
        request.onerror = (event) => {
            console.error('Failed to get logs from IndexedDB', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

async function clearLogs() {
    try {
        const db = await openDatabase();
        const transaction = db.transaction([LOG_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(LOG_STORE_NAME);
        store.clear();
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.errorCode);
        });
    } catch (error) {
        console.error('Failed to clear logs from IndexedDB', error);
        throw error;
    }
}

export { saveSetting, loadSetting, saveLog, getLogs, clearLogs };
