// Test detekce BPM na syntetickém zvuku se známým tempem (bez mikrofonu).
// Spuštění: node testy/test-bpm.js
// Pro každé tempo: bicí (kopák, virbl, hi-hat) + šum + mírné kolísání otáček gramofonu,
// do detektoru po 4096 vzorcích (jako z mikrofonu), odhad každou sekundu.

const { DetektorBPM, ustaleni, MIN_JISTOTA } = require("../bpm.js");

const SR = 48000; // iPhone

// Jednoduchý pseudonáhodný generátor, ať test dává pokaždé stejné výsledky.
// (mulberry32; jednodušší generátor v plovoucí čárce měl vlastní periodu a dělal falešné „tempo“.)
let semeno = 12345;
function nahoda() {
  semeno = (semeno + 0x6d2b79f5) | 0;
  let t = Math.imul(semeno ^ (semeno >>> 15), 1 | semeno);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
}

// Vzorky: kde v taktu (v dobách, 0–4) hraje který nástroj.
const STYLY = {
  house:  { kopak: [0, 1, 2, 3], virbl: [1, 3], hihat: [0.5, 1.5, 2.5, 3.5] },
  hiphop: { kopak: [0, 1.75, 2.5], virbl: [1, 3], hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
  dnb:    { kopak: [0, 2.5], virbl: [1, 3], hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
};

function generuj(bpm, styl, sekund, { sum = 0.02, wow = 0.001 } = {}) {
  const n = Math.round(sekund * SR);
  const x = new Float32Array(n);
  const vzor = STYLY[styl];
  // Čas v dobách s kolísáním otáček (wow 0,1 %, 0,55 Hz = otáčka desky 33⅓).
  let doba = (nahoda() + 1) * 2; // náhodný začátek v taktu
  const zvuky = []; // [začátek ve vzorcích, nástroj]
  let posledni = Math.floor(doba * 4);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    doba += (bpm / 60 / SR) * (1 + wow * Math.sin(2 * Math.PI * 0.55 * t));
    const sestnactina = Math.floor(doba * 4);
    if (sestnactina !== posledni) {
      posledni = sestnactina;
      const vTaktu = (sestnactina % 16) / 4;
      for (const nastroj of ["kopak", "virbl", "hihat"]) {
        if (vzor[nastroj].includes(vTaktu)) zvuky.push([i, nastroj]);
      }
    }
  }
  let predchoziSum = 0;
  for (const [z, nastroj] of zvuky) {
    const delka = Math.round((nastroj === "hihat" ? 0.05 : 0.2) * SR);
    for (let j = 0; j < delka && z + j < n; j++) {
      const t = j / SR;
      if (nastroj === "kopak") {
        const f = 50 + 70 * Math.exp(-t * 30); // klesající tón
        x[z + j] += 0.8 * Math.exp(-t * 15) * Math.sin(2 * Math.PI * f * t);
      } else if (nastroj === "virbl") {
        x[z + j] += Math.exp(-t * 25) * (0.3 * nahoda() + 0.2 * Math.sin(2 * Math.PI * 190 * t));
      } else {
        const s = nahoda();
        x[z + j] += 0.15 * Math.exp(-t * 80) * (s - predchoziSum); // rozdíl = vysoké tóny
        predchoziSum = s;
      }
    }
  }
  // Basa (držený tón, mění se po taktu) a šum místnosti.
  for (let i = 0; i < n; i++) {
    x[i] += 0.1 * Math.sin(2 * Math.PI * 55 * i / SR) + sum * nahoda();
  }
  return x;
}

function zmer(x) {
  const d = new DetektorBPM(SR);
  const odhady = [];
  const vysledky = {};
  let prvniUstaleni = null;
  let dalsiOdhad = SR; // vzorků do dalšího odhadu (1 s)
  for (let i = 0; i < x.length; i += 4096) {
    const kus = x.subarray(i, i + 4096);
    d.pridej(kus);
    dalsiOdhad -= kus.length;
    if (dalsiOdhad <= 0) {
      dalsiOdhad += SR;
      const o = d.odhad();
      if (!o || o.jistota < MIN_JISTOTA) continue; // nejasný rytmus se do ustálení nepočítá
      odhady.push(o.bpm);
      const u = ustaleni(odhady);
      const s = Math.round(d.sekund());
      if (u.ustaleno && prvniUstaleni == null) prvniUstaleni = { s, bpm: u.bpm, jistota: o.jistota };
      if ([10, 15, 20, 30].includes(s)) vysledky[s] = u.bpm ?? o.bpm;
    }
  }
  return { vysledky, prvniUstaleni };
}

// [tempo, styl, šum]; šum 0,02 = tichá místnost, 0,3 = šum skoro stejně silný jako hudba.
const PRIPADY = [
  [122, "house", 0.02], [128.5, "house", 0.02], [135.2, "house", 0.02], [118.75, "house", 0.02],
  [90, "hiphop", 0.02], [96.4, "hiphop", 0.02], [174, "dnb", 0.02], [140, "dnb", 0.02],
  [124, "house", 0.3], [90, "hiphop", 0.3], [174, "dnb", 0.3],
];

let chyb = 0;
console.log("tempo   styl    šum    10 s     15 s     20 s     30 s   ustáleno (s / BPM / jistota)");
const t0 = Date.now();
for (const [bpm, styl, sum] of PRIPADY) {
  const { vysledky, prvniUstaleni: u } = zmer(generuj(bpm, styl, 30, { sum }));
  const f = (v) => (v == null ? "   —   " : v.toFixed(2).padStart(7));
  // Polovina tempa je u drum and bass přijatelná (opraví tlačítko ×2), proto porovnat i s ní.
  const blizko = (v, tol) => v != null && (Math.abs(v - bpm) <= tol || Math.abs(2 * v - bpm) <= tol);
  const ok = u && blizko(u.bpm, 0.3) && blizko(vysledky[30], 0.15);
  console.log(
    `${String(bpm).padEnd(7)} ${styl.padEnd(7)} ${sum.toFixed(2)} ${f(vysledky[10])}  ${f(vysledky[15])}  ${f(vysledky[20])}  ${f(vysledky[30])}   ` +
      (u ? `${u.s} s / ${u.bpm.toFixed(2)} / ${u.jistota.toFixed(2)}` : "neustálilo se") + (ok ? "" : "   ← CHYBA"),
  );
  if (!ok) chyb++;
}
// Samotný šum: nesmí se „ustálit“ na nějakém tempu.
{
  const x = new Float32Array(SR * 20);
  for (let i = 0; i < x.length; i++) x[i] = 0.05 * nahoda();
  const { prvniUstaleni: u } = zmer(x);
  console.log(`jen šum:  ${u ? `ustálilo se na ${u.bpm.toFixed(2)} (jistota ${u.jistota.toFixed(2)})` : "neustálilo se"}`);
}
console.log(`čas výpočtu: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(chyb ? `CHYBA: ${chyb} případů mimo toleranci` : "OK: všechna tempa v toleranci (ustálení ±0,3, po 30 s ±0,15; u poloviny tempa ×2)");
process.exitCode = chyb ? 1 : 0;
