// Úložiště v telefonu (IndexedDB). Data žijí jen tady, nikam se neposílají.
// Dva „šuplíky“:
//   kv     – jednoduché hodnoty podle klíče, např. "sbirka" = celý export z Grooves
//   mereni – měření BPM, klíč "release_id|pozice" (stejný track = jedno měření, novější přepíše)

const DB_JMENO = "grooves";
const DB_VERZE = 1;
let _db = null;

function otevriDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((ok, chyba) => {
    const req = indexedDB.open(DB_JMENO, DB_VERZE);
    // Volá se jen při prvním otevření nebo po zvýšení DB_VERZE: tady vznikají šuplíky.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("mereni")) db.createObjectStore("mereni");
    };
    req.onsuccess = () => { _db = req.result; ok(_db); };
    req.onerror = () => chyba(req.error);
  });
}

// Jedna operace nad šuplíkem. `prace` dostane objectStore a vrátí IDBRequest.
async function dbOperace(suplik, rezim, prace) {
  const db = await otevriDb();
  return new Promise((ok, chyba) => {
    const tx = db.transaction(suplik, rezim);
    const req = prace(tx.objectStore(suplik));
    // Hotovo až po dokončení transakce: teprve pak je zápis opravdu uložený.
    tx.oncomplete = () => ok(req.result);
    tx.onerror = () => chyba(tx.error);
    tx.onabort = () => chyba(tx.error);
  });
}

const dbNacti = (suplik, klic) => dbOperace(suplik, "readonly", (s) => s.get(klic));
const dbUloz = (suplik, klic, hodnota) => dbOperace(suplik, "readwrite", (s) => s.put(hodnota, klic));
const dbVse = (suplik) => dbOperace(suplik, "readonly", (s) => s.getAll());

// Klíč tracku: stejný jako v Grooves (release_id + pozice), nikdy podle názvu.
const klicTracku = (releaseId, pozice) => `${releaseId}|${pozice}`;
