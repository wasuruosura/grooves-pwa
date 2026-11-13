// Sdílený mikrofon: používá ho test v záložce Mikrofon (app.js) i měření BPM (sbirka.js).
// Zapnutý je vždy nejvýš jednou. Kdo ho zapne, předá funkci, která se zavolá při vypnutí
// (i když ho vypne někdo jiný), ať si uklidí své tlačítko a ukazatele.

let mic = null; // {ctx, stream, zdroj, priVypnuti}

async function zapniMikrofon(priVypnuti) {
  vypniMikrofon();
  // Bez úprav zvuku: potlačení šumu a automatická hlasitost by hudbu zkreslily.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  let ctx;
  try {
    // iOS pustí zvuk jen po ťuknutí, proto AudioContext vzniká až tady (volá se z ťuknutí).
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    if (ctx) ctx.close();
    throw e;
  }
  mic = { ctx, stream, zdroj: ctx.createMediaStreamSource(stream), priVypnuti };
  return mic;
}

function vypniMikrofon() {
  if (!mic) return;
  const m = mic;
  mic = null;
  // Zastavit stopy mikrofonu: teprve pak telefon mikrofon opravdu pustí (zmizí indikátor).
  m.stream.getTracks().forEach((t) => t.stop());
  m.ctx.close();
  if (m.priVypnuti) m.priVypnuti();
}

function popisChybyMikrofonu(e) {
  if (!window.isSecureContext) return "Stránka neběží přes HTTPS, mikrofon je zakázaný.";
  if (!navigator.mediaDevices) return "Prohlížeč mikrofon nepodporuje.";
  if (e.name === "NotAllowedError") return "Mikrofon není povolený. Povol ho v Nastavení → Safari → Mikrofon a zkus znovu.";
  if (e.name === "NotFoundError") return "Nenašel jsem žádný mikrofon.";
  return `Chyba: ${e.name} ${e.message}`;
}
