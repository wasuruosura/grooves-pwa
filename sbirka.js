// Sbírka z Grooves, výběr tracku, měření BPM (mikrofonem, tapem nebo ručně) a export měření do Grooves.
// Formáty souborů jsou dané stranou Grooves (vinyl-hledac, mobile.py):
//   dovnitř: {"format":"grooves-sbirka","version":1,"exported":…,"releases":[…]}
//   ven:     {"format":"grooves-mereni","version":1,"measurements":[…]}

const el = (id) => document.getElementById(id);

let sbirka = null;          // načtený export z Grooves
const mereni = new Map();   // klíč tracku → měření z telefonu
const otevrene = new Set(); // id rozbalených desek v seznamu
let vybrany = null;         // {deska, track} právě měřený track
let fronta = null;          // režim Proměřit desku: {deska, tracky, i}
let tapy = [];              // časy ťuků v ms
let zdrojBpm = "manual";    // odkud je BPM v poli: manual / tap / detect
let detekce = null;         // běžící měření z mikrofonu: {detektor, uzel, odhady, dalsi}
let nasobek = 1;            // oprava ×2 / ÷2 pro vybraný track
let detekcePise = true;     // false, jakmile uživatel BPM sám ťukne nebo napíše

const MAX_DESEK = 40; // víc desek v seznamu najednou nekreslit, ať je hledání svižné

// ---------- Záložky ----------

function prepniZalozku(jmeno) {
  for (const b of document.querySelectorAll(".zalozky button")) {
    b.classList.toggle("vybrana", b.dataset.zalozka === jmeno);
  }
  for (const s of ["sbirka", "mereni", "mikrofon"]) el("z-" + s).hidden = s !== jmeno;
  if (jmeno !== "mereni" && detekce) vypniMikrofon(); // měření z mikrofonu jen na záložce Měření
  window.scrollTo(0, 0);
}
for (const b of document.querySelectorAll(".zalozky button")) {
  b.addEventListener("click", () => prepniZalozku(b.dataset.zalozka));
}

// ---------- Pomocné ----------

// Hledání bez ohledu na velikost písmen a diakritiku („dezo“ najde „Dežo“).
const normal = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Desetinné číslo z pole, české „127,5“ i „127.5“. Prázdné nebo nesmysl → null.
function cislo(s) {
  const t = String(s).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const strana = (pozice) => (String(pozice).match(/^[A-Za-z]+/) || [""])[0].toUpperCase();

function bpmTracku(deska, track) {
  const m = mereni.get(klicTracku(deska.id, track.position));
  return m ? m.bpm : track.bpm;
}

function novyPrvek(tag, trida, text) {
  const e = document.createElement(tag);
  if (trida) e.className = trida;
  if (text != null) e.textContent = text; // textContent, ne innerHTML: názvy z Discogs nejsou kód
  return e;
}

const datum = (sekundy) => new Date(sekundy * 1000).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" });

// ---------- Start: načíst uložená data z telefonu ----------

async function start() {
  try {
    sbirka = (await dbNacti("kv", "sbirka")) || null;
    for (const m of await dbVse("mereni")) mereni.set(klicTracku(m.release_id, m.position), m);
  } catch (e) {
    el("sb-chyba").textContent = `Úložiště v telefonu nejde otevřít: ${e.message || e}`;
  }
  ukazSbirku();
  ukazExport();
}

// ---------- Načtení souboru ze Grooves ----------

el("sb-soubor").addEventListener("change", async (ev) => {
  const soubor = ev.target.files[0];
  ev.target.value = ""; // ať jde stejný soubor vybrat znovu
  if (!soubor) return;
  el("sb-chyba").textContent = "";
  try {
    const data = JSON.parse(await soubor.text());
    if (!data || data.format !== "grooves-sbirka") throw new Error("Tohle není export sbírky z Grooves.");
    if (data.version !== 1) throw new Error(`Neznámá verze souboru (${data.version}), umím 1.`);
    if (!Array.isArray(data.releases)) throw new Error("V souboru chybí seznam desek.");
    await dbUloz("kv", "sbirka", data);
    sbirka = data;
    otevrene.clear();
    // Požádat prohlížeč, ať data nemaže při nedostatku místa (když to umí).
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    ukazSbirku();
  } catch (e) {
    el("sb-chyba").textContent = e instanceof SyntaxError ? "Soubor není platný JSON." : e.message;
  }
});

// ---------- Seznam desek ----------

el("sb-hledat").addEventListener("input", () => ukazSeznam());
el("sb-jen-bez").addEventListener("change", () => ukazSeznam());

function ukazSbirku() {
  const ma = !!sbirka;
  el("sb-hledat").hidden = !ma;
  el("sb-jen-bez-obal").hidden = !ma;
  if (!ma) {
    el("sb-info").textContent = "Sbírka zatím není načtená. V Grooves na PC: Sbírka → Export do mobilu, soubor pošli přes Signal a tady ho vyber.";
    el("sb-seznam").replaceChildren();
    return;
  }
  const tracku = sbirka.releases.reduce((n, d) => n + d.tracks.length, 0);
  const sBpm = sbirka.releases.reduce((n, d) => n + d.tracks.filter((t) => bpmTracku(d, t) != null).length, 0);
  el("sb-info").textContent = `${sbirka.releases.length} desek, ${tracku} tracků, s BPM ${sBpm}. Export z ${datum(sbirka.exported)}.`;
  ukazSeznam();
}

function ukazSeznam() {
  if (!sbirka) return;
  const slova = normal(el("sb-hledat").value).split(/\s+/).filter(Boolean);
  const jenBez = el("sb-jen-bez").checked;
  const nalezene = sbirka.releases.filter((d) => {
    if (jenBez && !d.tracks.some((t) => bpmTracku(d, t) == null)) return false;
    if (!slova.length) return true;
    const text = normal([d.artist, d.title, d.catno, d.label, ...d.tracks.flatMap((t) => [t.artist, t.title])].join(" "));
    return slova.every((s) => text.includes(s));
  });
  el("sb-seznam").replaceChildren(...nalezene.slice(0, MAX_DESEK).map(prvekDesky));
  const zbyva = nalezene.length - MAX_DESEK;
  el("sb-vic").textContent = !nalezene.length ? "Nic nenalezeno." : zbyva > 0 ? `A dalších ${zbyva} desek, upřesni hledání.` : "";
}

function prvekDesky(d) {
  const li = novyPrvek("li", "deska");
  const bez = d.tracks.filter((t) => bpmTracku(d, t) == null).length;
  const hlava = novyPrvek("button", "hlava");
  hlava.append(
    novyPrvek("div", "nazev", `${d.artist} – ${d.title}`),
    novyPrvek("div", "mut mensi", [d.catno, d.label, d.rpm && `${d.rpm} ot.`, bez ? `bez BPM ${bez}/${d.tracks.length}` : "vše s BPM"].filter(Boolean).join(" · ")),
  );
  hlava.addEventListener("click", () => {
    otevrene.has(d.id) ? otevrene.delete(d.id) : otevrene.add(d.id);
    li.replaceWith(prvekDesky(d));
  });
  li.append(hlava);
  if (!otevrene.has(d.id)) return li;

  if (bez) {
    const prom = novyPrvek("button", "promerit", `Proměřit desku (${bez} bez BPM)`);
    prom.addEventListener("click", () => promeritDesku(d));
    li.append(prom);
  }
  const ul = novyPrvek("ul", "tracky");
  for (const t of d.tracks) {
    const b = novyPrvek("button", "track");
    const bpm = bpmTracku(d, t);
    const jmeno = t.artist && t.artist !== d.artist ? `${t.artist} – ${t.title}` : t.title;
    b.append(
      novyPrvek("span", "poz", t.position),
      novyPrvek("span", "tnazev", jmeno),
      novyPrvek("span", bpm == null ? "tbpm mut" : "tbpm", bpm == null ? "bez BPM" : bpm.toFixed(2)),
    );
    b.addEventListener("click", () => { fronta = null; vyberTrack(d, t); });
    const li2 = novyPrvek("li");
    li2.append(b);
    ul.append(li2);
  }
  li.append(ul);
  return li;
}

// ---------- Výběr tracku a režim Proměřit desku ----------

function promeritDesku(d) {
  const tracky = d.tracks.filter((t) => bpmTracku(d, t) == null);
  if (!tracky.length) return;
  fronta = { deska: d, tracky, i: 0 };
  vyberTrack(d, tracky[0]);
}

function vyberTrack(deska, track) {
  vybrany = { deska, track };
  el("me-zadny").hidden = true;
  el("me-panel").hidden = false;
  el("me-deska").textContent = `${deska.artist} – ${deska.title}${deska.catno ? " · " + deska.catno : ""}`;
  el("me-track").textContent = `${track.position}  ${track.artist && track.artist !== deska.artist ? track.artist + " – " : ""}${track.title}`;

  const m = mereni.get(klicTracku(deska.id, track.position));
  el("me-ted").textContent = m
    ? `Změřeno v telefonu: ${m.bpm.toFixed(2)} BPM${m.odeslano ? "" : " (neodesláno)"}`
    : track.bpm != null ? `V Grooves: ${track.bpm.toFixed(2)} BPM` : "Zatím bez BPM";

  const rpm = String(track.rpm || deska.rpm || "33");
  el("me-rpm").value = ["33", "45", "78"].includes(rpm) ? rpm : "33";
  // Pitch zůstává z minula: při proměřování desky se fader obvykle nemění.
  el("me-bpm").value = "";
  tapy = [];
  zdrojBpm = "manual";
  if (detekce) vypniMikrofon();
  nasobek = 1;
  detekcePise = true;
  el("me-det").hidden = true;
  el("me-tap-info").textContent = "Ťukej do rytmu. Víc ťuků = přesnější. Pauza 2 s začne znovu.";
  el("me-chyba").textContent = "";

  if (fronta) {
    const { tracky, i } = fronta;
    el("me-fronta").textContent = `Proměřuješ desku: track ${i + 1} z ${tracky.length}`;
    const otoc = i > 0 && strana(tracky[i].position) !== strana(tracky[i - 1].position);
    el("me-otoc").hidden = !otoc;
    el("me-otoc").textContent = otoc ? `Otoč desku: strana ${strana(tracky[i].position) || "?"}` : "";
  } else {
    el("me-fronta").textContent = "";
    el("me-otoc").hidden = true;
  }
  el("me-fronta").hidden = !fronta;
  el("me-preskocit").hidden = !fronta;
  prepocitej();
  prepniZalozku("mereni");
}

function dalsiVeFronte() {
  fronta.i += 1;
  if (fronta.i < fronta.tracky.length) {
    vyberTrack(fronta.deska, fronta.tracky[fronta.i]);
    return;
  }
  fronta = null;
  vybrany = null;
  el("me-panel").hidden = true;
  el("me-zadny").hidden = false;
  el("me-zadny").textContent = "Deska proměřená. Další track vyber ve Sbírce.";
}

el("me-preskocit").addEventListener("click", () => fronta && dalsiVeFronte());

// ---------- Měření: přepočet na 0 % a tap ----------

// BPM při 0 % pitche: na gramofonu hraje rychlostí základ × (1 + pitch/100).
function bpmNaNule() {
  const bpm = cislo(el("me-bpm").value);
  const pitch = cislo(el("me-pitch").value);
  if (bpm == null || pitch == null) return null;
  return bpm / (1 + pitch / 100);
}

function prepocitej() {
  const n = bpmNaNule();
  el("me-nula").textContent = n == null ? "—" : n.toFixed(2);
}

el("me-bpm").addEventListener("input", () => { zdrojBpm = "manual"; detekcePise = false; prepocitej(); });
el("me-pitch").addEventListener("input", prepocitej);

// pointerdown místo click: reaguje hned při dotyku, ne až po zvednutí prstu.
el("me-tap").addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  const t = performance.now();
  if (tapy.length && t - tapy[tapy.length - 1] > 2000) tapy = [];
  tapy.push(t);
  el("me-tap").classList.add("zap");
  setTimeout(() => el("me-tap").classList.remove("zap"), 80);
  if (tapy.length < 2) {
    el("me-tap-info").textContent = "1 ťuk…";
    return;
  }
  // Přímka časů ťuků proložená metodou nejmenších čtverců: sklon = ms na dobu.
  // Přesnější než průměr intervalů, chyba jednoho ťuku se rozloží.
  const n = tapy.length;
  const mx = (n - 1) / 2;
  const my = tapy.reduce((a, b) => a + b, 0) / n;
  let cit = 0, jm = 0;
  tapy.forEach((y, x) => { cit += (x - mx) * (y - my); jm += (x - mx) ** 2; });
  const bpm = 60000 / (cit / jm);
  el("me-bpm").value = bpm.toFixed(2);
  zdrojBpm = "tap";
  detekcePise = false; // ťuknuté BPM detekce nepřepíše
  el("me-tap-info").textContent = `${n} ťuků${n < 8 ? ", ťukej dál" : ""}`;
  prepocitej();
});

el("me-ulozit").addEventListener("click", async () => {
  if (!vybrany) return;
  el("me-chyba").textContent = "";
  const n = bpmNaNule();
  if (n == null) { el("me-chyba").textContent = "Vyplň BPM a pitch (číslo)."; return; }
  if (!(n > 20 && n < 400)) { el("me-chyba").textContent = "BPM musí být mezi 20 a 400."; return; }
  if (detekce) vypniMikrofon();
  const { deska, track } = vybrany;
  const zaznam = {
    release_id: deska.id,
    position: track.position,
    bpm: Math.round(n * 100) / 100,
    rpm: el("me-rpm").value,
    pitch: cislo(el("me-pitch").value),
    source: zdrojBpm,
    ts: Date.now() / 1000,
    odeslano: false,
  };
  try {
    await dbUloz("mereni", klicTracku(deska.id, track.position), zaznam);
  } catch (e) {
    el("me-chyba").textContent = `Uložení selhalo: ${e.message || e}`;
    return;
  }
  mereni.set(klicTracku(deska.id, track.position), zaznam);
  ukazSbirku();
  ukazExport();
  if (fronta) dalsiVeFronte();
  else el("me-ted").textContent = `Uloženo: ${zaznam.bpm.toFixed(2)} BPM (neodesláno)`;
});

// ---------- Měření z mikrofonu (výpočet v bpm.js, mikrofon v mikrofon.js) ----------

let zapinaniDetekce = false; // brání dvojímu ťuknutí během čekání na povolení

el("me-mic").addEventListener("click", () => (detekce ? vypniMikrofon() : zapniDetekci()));

async function zapniDetekci() {
  if (zapinaniDetekce) return;
  zapinaniDetekce = true;
  el("me-chyba").textContent = "";
  try {
    const { ctx, zdroj } = await zapniMikrofon(konecDetekce);
    // ScriptProcessor: zastaralý, ale na iPhonu spolehlivý. Dává zvuk po 4096 vzorcích (~85 ms).
    const uzel = ctx.createScriptProcessor(4096, 1, 1);
    detekce = { detektor: new DetektorBPM(ctx.sampleRate), uzel, odhady: [], dalsi: ctx.sampleRate };
    uzel.onaudioprocess = (ev) => {
      ev.outputBuffer.getChannelData(0).fill(0); // do reproduktoru ticho
      zpracuj(ev.inputBuffer.getChannelData(0));
    };
    zdroj.connect(uzel);
    uzel.connect(ctx.destination); // bez připojení na výstup prohlížeč uzel nespouští
    detekcePise = true;
    el("me-mic").textContent = "Zastavit měření";
    el("me-mic").classList.add("bezi");
    el("me-det").hidden = false;
    el("me-det-info").textContent = "Poslouchám…";
  } catch (e) {
    konecDetekce();
    el("me-chyba").textContent = popisChybyMikrofonu(e);
  } finally {
    zapinaniDetekce = false;
  }
}

// Zavolá mikrofon.js při vypnutí (tlačítkem, Uložit, jiný track, jiná záložka, test mikrofonu).
// Poslední odhad a ×2 / ÷2 zůstanou vidět.
function konecDetekce() {
  if (detekce) {
    detekce.uzel.onaudioprocess = null;
    detekce.uzel.disconnect();
  }
  detekce = null;
  el("me-mic").textContent = "Měřit z mikrofonu";
  el("me-mic").classList.remove("bezi");
  el("me-uroven").style.width = "0%";
}

function zpracuj(data) {
  const d = detekce;
  if (!d) return;
  d.detektor.pridej(data);
  let soucet = 0;
  for (const x of data) soucet += x * x;
  el("me-uroven").style.width = Math.min(100, Math.sqrt(soucet / data.length) * 400) + "%";
  d.dalsi -= data.length;
  if (d.dalsi > 0) return;
  d.dalsi += d.detektor.sr; // odhad jednou za sekundu zvuku
  ukazOdhad(d);
}

function ukazOdhad(d) {
  const info = el("me-det-info");
  const sek = Math.round(d.detektor.sekund());
  const o = d.detektor.odhad();
  if (!o) { info.textContent = `Poslouchám ${sek} s…`; return; }
  if (o.jistota < MIN_JISTOTA) {
    info.textContent = `Poslouchám ${sek} s · rytmus nejasný, dej telefon blíž k reproduktoru`;
    return;
  }
  d.odhady.push(o.bpm);
  const u = ustaleni(d.odhady);
  const bpm = (u.bpm ?? o.bpm) * nasobek;
  const stav = u.rozptyl == null ? "ustaluje se…"
    : `kolísá ±${((u.rozptyl * nasobek) / 2).toFixed(2)}${u.ustaleno ? " · ustáleno" : ""}`;
  info.replaceChildren(`${sek} s · `, novyPrvek("b", null, bpm.toFixed(2)), ` BPM · ${stav}`);
  if (u.ustaleno && detekcePise) {
    el("me-bpm").value = bpm.toFixed(2);
    zdrojBpm = "detect";
    prepocitej();
  }
}

// Detekce se může splést o polovinu/dvojnásobek (typicky 87 ↔ 174). Oprava platí pro pole
// i pro další odhady u tohoto tracku.
function opravNasobek(k) {
  nasobek *= k;
  let odhad = null; // nezaokrouhlený poslední odhad detekce, ať ÷2 a ×2 nesčítají zaokrouhlení
  if (detekce && detekce.odhady.length) {
    odhad = (ustaleni(detekce.odhady).bpm ?? detekce.odhady[detekce.odhady.length - 1]) * nasobek;
    const b = el("me-det-info").querySelector("b");
    if (b) b.textContent = odhad.toFixed(2);
  }
  const bpm = cislo(el("me-bpm").value);
  if (bpm != null) {
    el("me-bpm").value = (zdrojBpm === "detect" && odhad != null ? odhad : bpm * k).toFixed(2);
    prepocitej();
  }
}
el("me-dvakrat").addEventListener("click", () => opravNasobek(2));
el("me-pul").addEventListener("click", () => opravNasobek(0.5));

// ---------- Export do Grooves ----------

const kOdeslani = () => [...mereni.values()].filter((m) => el("ex-vse").checked || !m.odeslano);

function ukazExport() {
  const neodeslana = [...mereni.values()].filter((m) => !m.odeslano).length;
  el("ex-pocet").textContent = neodeslana;
  el("ex-celkem").textContent = mereni.size ? `(celkem ${mereni.size})` : "";
  el("ex-poslat").disabled = !kOdeslani().length;
}
el("ex-vse").addEventListener("change", ukazExport);

el("ex-poslat").addEventListener("click", async () => {
  const seznam = kOdeslani();
  if (!seznam.length) return;
  const obsah = JSON.stringify({
    format: "grooves-mereni",
    version: 1,
    measurements: seznam.map(({ release_id, position, bpm, rpm, pitch, source, ts }) =>
      ({ release_id, position, bpm, rpm, pitch, source, ts })),
  }, null, 1);
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const jmeno = `grooves-mereni-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;

  // Systémové Sdílet (→ Signal, Poznámka pro sebe). navigator.share se musí zavolat
  // hned po ťuknutí, proto se před ním na nic nečeká (data jsou už v paměti).
  // Některé prohlížeče JSON sdílet nedovolí, pak zkusit totéž jako text/plain.
  const soubor = ["application/json", "text/plain"]
    .map((typ) => new File([obsah], jmeno, { type: typ }))
    .find((f) => navigator.canShare && navigator.canShare({ files: [f] }));

  if (soubor) {
    try {
      await navigator.share({ files: [soubor] });
      await oznacOdeslano(seznam, `Odesláno ${seznam.length} měření (${jmeno}).`);
      return;
    } catch (e) {
      if (e.name === "AbortError") { el("ex-info").textContent = "Sdílení zrušeno, nic se neoznačilo jako odeslané."; return; }
      // Jiná chyba: zkusit aspoň stažení souboru.
    }
  }
  const url = URL.createObjectURL(new Blob([obsah], { type: "application/json" }));
  const a = novyPrvek("a");
  a.href = url;
  a.download = jmeno;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await oznacOdeslano(seznam, `Sdílení nejde, soubor ${jmeno} se stáhl. Kdyby se ztratil, zaškrtni „Poslat všechna měření znovu“.`);
});

async function oznacOdeslano(seznam, zprava) {
  for (const m of seznam) {
    m.odeslano = true;
    await dbUloz("mereni", klicTracku(m.release_id, m.position), m);
  }
  el("ex-vse").checked = false;
  el("ex-info").textContent = zprava;
  ukazExport();
}

start();
