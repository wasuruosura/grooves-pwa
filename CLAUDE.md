# Grooves PWA

Webová appka pro iPhone (přidaná na plochu), mobilní část Grooves: sbírka s BPM, trénink beatmatchingu, měření tempa z mikrofonu. Hlavní aplikace Grooves (Discogs, data, token) je v `..\vinyl-hledac`.

Aktuální stav, rozhodnutí a další krok: `POZNAMKA.md`. Přečíst na začátku každé session. Proč PWA a ne Flutter, je v `..\vinyl-hledac\ZAMITNUTO.md`.

## Spuštění

- Lokálně: `uv run --no-project python -m http.server 8780` v kořeni projektu, pak http://localhost:8780 v Chromu. Na `localhost` mikrofon funguje i bez HTTPS.
- Na iPhonu: přes GitHub Pages (HTTPS), pak Safari → Sdílet → Přidat na plochu.

## Struktura

- `index.html`, `style.css`, `app.js`: statická stránka, vanilla JS bez frameworku a bez build kroku.
- `manifest.webmanifest`, `icons/`: instalace na plochu. iPhone bere ikonu z `apple-touch-icon` (PNG 180×180), SVG neumí.

## Konvence a pravidla

- **Repozitář je veřejný.** Nikdy sem nedávat data uživatele (sbírka, BPM), token Discogs ani `.env`. Data žijí jen v telefonu.
- **Do telefonu nic, co mění důvěru** (certifikáty, profily, VPN). Uživatel má v telefonu banku, investice a soukromé fotky.
- Texty v UI česky.
- Mikrofon: `getUserMedia` bez `echoCancellation`, `noiseSuppression`, `autoGainControl`, jinak se hudba zkreslí. `AudioContext` vytvářet až po ťuknutí, iOS ho jinak nepustí.
