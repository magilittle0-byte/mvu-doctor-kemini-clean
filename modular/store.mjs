// Minimal adaptation of profile-engine.js openDoctorDurableDb /
// durableWorldStoreBatch: actual transactions, independent readback, no mirror.
import { canonical, clone, fault } from './variables/core.mjs';
export function createStore(indexedDB = globalThis.indexedDB) {
  let opening;
  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!indexedDB) return reject(fault('store_unavailable', '浏览器持久化不可用'));
      const req = indexedDB.open('mvu_doctor_modular', 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); opening = null; }; resolve(req.result); };
      req.onerror = () => reject(fault('store_open', '医生存档打开失败'));
      req.onblocked = () => reject(fault('store_blocked', '医生存档正在被其他页面占用'));
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  async function read(key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly'); let value;
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => { value = req.result; };
      tx.oncomplete = () => { try { resolve(value === undefined ? null : JSON.parse(value)); } catch { reject(fault('store_corrupt', '医生存档内容损坏，未用空记录冒充成功')); } };
      tx.onerror = tx.onabort = () => reject(fault('store_read', '医生存档读回失败'));
    });
  }
  async function write(key, value) {
    const stored = canonical(clone(value)); const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(stored, key);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(fault('store_write', '医生存档写入失败'));
    });
    if (canonical(await read(key)) !== stored) throw fault('store_readback', '医生存档写后读回不一致');
    return clone(value);
  }
  return Object.freeze({ read, write });
}
