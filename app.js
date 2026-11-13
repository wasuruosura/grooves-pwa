// Grooves PWA, první verze: ověření, že mikrofon funguje na iPhonu i z plochy.

const $ = (id) => document.getElementById(id);

// Z plochy na iPhonu je navigator.standalone true, jinde pomůže display-mode.
const zPlochy = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
$("rezim").textContent = zPlochy ? "z plochy" : "v prohlížeči";
$("https").textContent = window.isSecureContext ? "ano" : "ne (mikrofon nepůjde)";

// Offline: service worker uloží soubory appky. "připraveno" až když je aktivní,
// tedy soubory jsou opravdu v cache.
if ("serviceWorker" in navigator) {
  const sw = navigator.serviceWorker;
  // updateViaCache: "none" = sw.js vždy ze sítě, ne z HTTP cache (GitHub Pages ji drží ~10 min).
  sw.register("sw.js", { updateViaCache: "none" }).catch(async (e) => {
    // Bez sítě registrace selže (nejde stáhnout sw.js), ale uložená verze dál funguje.
    // "nepřipraveno" jen když opravdu žádný aktivní service worker není.
    const reg = await sw.getRegistration();
    if (!reg || !reg.active) $("offline").textContent = `nepřipraveno (${e.message})`;
  });
  sw.ready.then(() => { $("offline").textContent = "připraveno"; });
} else {
  $("offline").textContent = "nepřipraveno (prohlížeč neumí)";
}

let ctx = null;

$("tlacitko").addEventListener("click", async () => {
  if (ctx) return;
  $("chyba").textContent = "";
  try {
    // Bez úprav zvuku: potlačení šumu a automatická hlasitost by hudbu zkreslily.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    // iOS pustí zvuk jen po ťuknutí, proto AudioContext vzniká až tady.
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    $("stav").textContent = `zapnutý (${ctx.sampleRate} Hz)`;
    $("tlacitko").textContent = "Mikrofon běží";
    sleduj(analyser);
  } catch (e) {
    ctx = null;
    $("stav").textContent = "nefunguje";
    $("chyba").textContent = popisChyby(e);
  }
});

function sleduj(analyser) {
  const data = new Float32Array(analyser.fftSize);
  let prumer = 0; // pomalu se měnící průměrná hlasitost
  let posledniUder = 0;

  const krok = (cas) => {
    analyser.getFloatTimeDomainData(data);
    // RMS = efektivní hlasitost úseku signálu
    let soucet = 0;
    for (const x of data) soucet += x * x;
    const rms = Math.sqrt(soucet / data.length);

    $("uroven").style.width = Math.min(100, rms * 400) + "%";

    // Hrubý odhad úderu: hlasitost výrazně nad průměrem, nejvýš ~4× za sekundu.
    // Skutečná detekce BPM přijde později, tohle je jen kontrola, že zvuk teče.
    prumer = prumer * 0.95 + rms * 0.05;
    if (rms > prumer * 1.6 && rms > 0.02 && cas - posledniUder > 250) {
      posledniUder = cas;
      $("uder").classList.add("zap");
      setTimeout(() => $("uder").classList.remove("zap"), 80);
    }
    requestAnimationFrame(krok);
  };
  requestAnimationFrame(krok);
}

function popisChyby(e) {
  if (!window.isSecureContext) return "Stránka neběží přes HTTPS, mikrofon je zakázaný.";
  if (!navigator.mediaDevices) return "Prohlížeč mikrofon nepodporuje.";
  if (e.name === "NotAllowedError") return "Mikrofon není povolený. Povol ho v Nastavení → Safari → Mikrofon a zkus znovu.";
  if (e.name === "NotFoundError") return "Nenašel jsem žádný mikrofon.";
  return `Chyba: ${e.name} ${e.message}`;
}
