// Detekce tempa (BPM) ze zvuku, bez knihoven. Čistý výpočet, nic o mikrofonu ani o stránce,
// takže jde testovat i v Node (test-bpm.js).
//
// Postup:
//  1. Zvuk po krocích 10 ms → spektrum (FFT 1024 vzorků s Hannovým oknem).
//  2. Spectral flux: o kolik v každém z ~20 frekvenčních pásem přibyla (logaritmická) síla oproti
//     minulému kroku. Úbytky se nepočítají. Součet = „křivka nástupů“, vyskočí při každém úderu.
//  3. Autokorelace křivky (posledních až 24 s): jak moc se křivka podobá sama sobě posunuté o L kroků.
//     Při posunu o jednu dobu (a o 2, 3, … doby) je podobnost velká.
//  4. Pro každé tempo 70–180 BPM (krok 0,02) průměr autokorelace přes všechny násobky doby,
//     které se do okna vejdou. Díky mnoha násobkům je výsledek přesný na setiny až desetiny BPM.
//  5. Preference temp kolem 125 BPM rozhodne mezi tempem a jeho polovinou/dvojnásobkem
//     (obojí sedí stejně dobře). Když se splete, opraví se tlačítky ×2 / ÷2.

const BPM_MIN = 70;
const BPM_MAX = 180;
// Pod touto jistotou je rytmus nejasný (šum, mluvení). Samotný šum v testu dává ~0,03,
// hudba i se silným šumem 0,09 a víc.
const MIN_JISTOTA = 0.08;

class DetektorBPM {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.N = 1024;                              // délka úseku pro FFT
    this.hop = Math.round(sampleRate / 100);    // krok ~10 ms
    this.fps = sampleRate / this.hop;           // kroků za sekundu (přesně)
    this.maxDelka = Math.round(24 * this.fps);  // křivka nástupů nejvýš za 24 s

    this.okno = new Float64Array(this.N);
    for (let i = 0; i < this.N; i++) this.okno[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / this.N);
    this.kruh = new Float32Array(this.N); // posledních N vzorků dokola
    this.poz = 0;
    this.doKroku = this.N;                // první úsek až po naplnění
    this.re = new Float64Array(this.N);
    this.im = new Float64Array(this.N);
    this.priprvFFT();

    // Pásma 30 Hz – 8 kHz, logaritmicky rozložená (jako sluch). Síla se sčítá přes celé pásmo,
    // takže náhodné kolísání šumu se zprůměruje a údery vyniknou. Nad 8 kHz už je hlavně šum.
    const hzNaBin = sampleRate / this.N;
    const PASEM = 20;
    this.hranice = [];
    for (let p = 0; p <= PASEM; p++) {
      const b = Math.round((30 * (8000 / 30) ** (p / PASEM)) / hzNaBin);
      const posledni = this.hranice[this.hranice.length - 1];
      if (posledni == null || b > posledni) this.hranice.push(Math.max(1, b));
    }
    this.minule = new Float64Array(this.hranice.length);
    this.obalka = new Float32Array(this.maxDelka); // křivka nástupů, kruhově
    this.pocet = 0;                                // kolik kroků celkem
  }

  // Kolik sekund zvuku už detektor zpracoval.
  sekund() {
    return this.pocet / this.fps;
  }

  // Přidat vzorky zvuku (Float32Array, hodnoty −1…1).
  pridej(vzorky) {
    for (let i = 0; i < vzorky.length; i++) {
      this.kruh[this.poz] = vzorky[i];
      this.poz = (this.poz + 1) % this.N;
      if (--this.doKroku === 0) {
        this.doKroku = this.hop;
        this.krok();
      }
    }
  }

  krok() {
    const { N, re, im, okno, kruh } = this;
    for (let i = 0; i < N; i++) {
      re[i] = kruh[(this.poz + i) % N] * okno[i]; // poz = nejstarší vzorek
      im[i] = 0;
    }
    this.fft();
    let flux = 0;
    const h = this.hranice;
    for (let p = 0; p + 1 < h.length; p++) {
      let sila = 0;
      for (let b = h[p]; b < h[p + 1]; b++) sila += re[b] * re[b] + im[b] * im[b];
      // Logaritmus: tiché i hlasité údery přispějí podobně (nezáleží na hlasitosti mikrofonu).
      const lm = Math.log(1e-6 + sila / (h[p + 1] - h[p]));
      const rozdil = lm - this.minule[p];
      if (rozdil > 0) flux += rozdil;
      this.minule[p] = lm;
    }
    this.obalka[this.pocet % this.maxDelka] = flux;
    this.pocet++;
  }

  // Odhad tempa z dosavadního zvuku. null, dokud není aspoň 6 s nebo když je ticho / bez rytmu.
  // Vrací {bpm, jistota}; jistota 0–1 = jak výrazně se rytmus opakuje.
  odhad() {
    const M = Math.min(this.pocet, this.maxDelka);
    if (M < 6 * this.fps) return null;

    // Křivka v časovém pořadí, bez pomalých změn hlasitosti (odečíst klouzavý průměr ~0,5 s),
    // záporné části pryč. Zůstanou jen špičky úderů.
    const surova = new Float64Array(M);
    const zacatek = this.pocet - M;
    for (let i = 0; i < M; i++) surova[i] = this.obalka[(zacatek + i) % this.maxDelka];
    const pul = Math.round(0.25 * this.fps);
    const e = new Float64Array(M);
    let soucet = 0;
    for (let i = 0; i < Math.min(M, pul); i++) soucet += surova[i];
    for (let i = 0; i < M; i++) {
      const pridat = i + pul, ubrat = i - pul - 1;
      if (pridat < M) soucet += surova[pridat];
      if (ubrat >= 0) soucet -= surova[ubrat];
      const n = Math.min(M - 1, i + pul) - Math.max(0, i - pul) + 1;
      e[i] = Math.max(0, surova[i] - soucet / n);
    }

    // Odečíst průměr: u šumu pak autokorelace kolísá kolem nuly a „jistota“ vyjde malá.
    let prumer = 0;
    for (let i = 0; i < M; i++) prumer += e[i];
    prumer /= M;
    for (let i = 0; i < M; i++) e[i] -= prumer;

    // Autokorelace do posunu poloviny okna (normovaná počtem překrývajících se kroků).
    const maxLag = Math.floor(M / 2);
    const r = new Float64Array(maxLag + 2);
    for (let L = 0; L <= maxLag + 1; L++) {
      let s = 0;
      for (let i = 0; i + L < M; i++) s += e[i] * e[i + L];
      r[L] = s / (M - L);
    }
    if (!(r[0] > 1e-9)) return null; // ticho

    const rAt = (x) => { // autokorelace v necelém posunu (lineární interpolace)
      const i = Math.floor(x), f = x - i;
      return r[i] * (1 - f) + r[i + 1] * f;
    };
    const skore = (bpm) => {
      const P = (60 * this.fps) / bpm; // délka doby v krocích
      let s = 0, k = 1;
      for (; k * P <= maxLag; k++) s += rAt(k * P);
      return s / (k - 1);
    };
    // Nejlepší tempo na mřížce 0,02 BPM.
    let nej = null, nejHodnota = -Infinity;
    for (let bpm = BPM_MIN; bpm <= BPM_MAX + 1e-9; bpm += 0.02) {
      const h = skore(bpm);
      if (h > nejHodnota) { nejHodnota = h; nej = bpm; }
    }
    // Polovina a dvojnásobek sedí skoro stejně dobře (každá druhá doba / doba a půl).
    // Rozhodne preference temp kolem 125 BPM, aby vyhrálo to, co DJ obvykle počítá.
    const preference = (bpm) => Math.exp(-0.5 * (Math.log2(bpm / 125) / 0.5) ** 2);
    let vyber = nej, vyberHodnota = nejHodnota * preference(nej);
    for (const kandidat of [nej / 2, nej * 2]) {
      if (kandidat < BPM_MIN || kandidat > BPM_MAX) continue;
      // jemně dohledat vrchol kolem kandidáta (±0,1 BPM)
      for (let bpm = kandidat - 0.1; bpm <= kandidat + 0.1; bpm += 0.02) {
        const h = skore(bpm) * preference(bpm);
        if (h > vyberHodnota) { vyberHodnota = h; vyber = bpm; }
      }
    }
    nej = vyber;
    // Doladění vrcholu parabolou přes sousední body mřížky.
    const d = 0.02;
    const a = skore(nej - d), b = skore(nej), c = skore(nej + d);
    const jm = a - 2 * b + c;
    const posun = jm < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / jm)) : 0;
    return { bpm: nej + posun * d, jistota: Math.max(0, Math.min(1, b / r[0])) };
  }

  // ---------- FFT (radix-2, na místě) ----------
  priprvFFT() {
    const N = this.N;
    this.obrat = new Uint32Array(N);
    const bity = Math.log2(N);
    for (let i = 0; i < N; i++) {
      let x = i, y = 0;
      for (let k = 0; k < bity; k++) { y = (y << 1) | (x & 1); x >>= 1; }
      this.obrat[i] = y;
    }
    this.cos = new Float64Array(N / 2);
    this.sin = new Float64Array(N / 2);
    for (let i = 0; i < N / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / N);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / N);
    }
  }

  fft() {
    const { N, re, im, obrat } = this;
    for (let i = 0; i < N; i++) {
      const j = obrat[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let vel = 2; vel <= N; vel <<= 1) {
      const pul = vel >> 1, krok = N / vel;
      for (let z = 0; z < N; z += vel) {
        for (let k = 0; k < pul; k++) {
          const wr = this.cos[k * krok], wi = this.sin[k * krok];
          const i = z + k, j = i + pul;
          const tr = re[j] * wr - im[j] * wi;
          const ti = re[j] * wi + im[j] * wr;
          re[j] = re[i] - tr; im[j] = im[i] - ti;
          re[i] += tr; im[i] += ti;
        }
      }
    }
  }
}

// Ustálení: z posledních odhadů (jeden za sekundu) medián a rozptyl.
// Ustálené = posledních 5 odhadů se liší nejvýš o 0,3 BPM.
function ustaleni(odhady) {
  const posl = odhady.slice(-5);
  if (posl.length < 5) return { bpm: null, rozptyl: null, ustaleno: false };
  const serazene = [...posl].sort((a, b) => a - b);
  const rozptyl = serazene[4] - serazene[0];
  return { bpm: serazene[2], rozptyl, ustaleno: rozptyl <= 0.3 };
}

if (typeof module !== "undefined") module.exports = { DetektorBPM, ustaleni, BPM_MIN, BPM_MAX, MIN_JISTOTA };
