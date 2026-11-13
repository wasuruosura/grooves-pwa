// Grooves PWA: test mikrofonu (záložka Mikrofon) a stav offline. Sbírka a měření jsou v sbirka.js.

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

// Test mikrofonu: ukazatel hlasitosti a hrubé blikání do rytmu. Mikrofon sám je v mikrofon.js.
let zapnuto = false;
let snimek = 0; // id requestAnimationFrame, aby šlo měření zastavit
let zapinani = false; // brání dvojímu ťuknutí během čekání na povolení

$("tlacitko").addEventListener("click", () => (zapnuto ? vypniMikrofon() : zapni()));

async function zapni() {
  if (zapinani) return;
  zapinani = true;
  $("chyba").textContent = "";
  try {
    const { ctx, zdroj } = await zapniMikrofon(poVypnuti);
    zapnuto = true;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    zdroj.connect(analyser);
    $("stav").textContent = `zapnutý (${ctx.sampleRate} Hz)`;
    $("tlacitko").textContent = "Vypnout mikrofon";
    sleduj(analyser);
  } catch (e) {
    poVypnuti();
    $("stav").textContent = "nefunguje";
    $("chyba").textContent = popisChybyMikrofonu(e);
  } finally {
    zapinani = false;
  }
}

// Zavolá mikrofon.js při vypnutí (tlačítkem tady, nebo když mikrofon převezme měření BPM).
function poVypnuti() {
  zapnuto = false;
  cancelAnimationFrame(snimek);
  $("stav").textContent = "vypnutý";
  $("tlacitko").textContent = "Zapnout mikrofon";
  $("uroven").style.width = "0%";
  $("uder").classList.remove("zap");
}

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
    snimek = requestAnimationFrame(krok);
  };
  snimek = requestAnimationFrame(krok);
}
