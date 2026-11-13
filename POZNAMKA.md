# Grooves PWA – poznámka ke stavu práce

## Stav (2026-11-13)

- Kostra první verze: stránka s testem mikrofonu (hlasitost, hrubé blikání do rytmu, režim z plochy/v prohlížeči, HTTPS), manifest a ikony. Větev `prvni-verze`, zatím necommitnuté.
- Na GitHubu zatím nic. Uživatel má účet `wasuruosura` a je v prohlížeči přihlášený. Git na PC má Git Credential Manager (`credential.helper = manager`), při prvním pushi se přihlásí přes prohlížeč.

- 2026-11-13: repozitář `wasuruosura/grooves-pwa` založil uživatel (veřejný, prázdný). Lokálně commit `b7d1d14` ve větvi `prvni-verze`, remote `origin` nastavený, `http.sslBackend=schannel` jen pro tento repozitář (jinak chyba certifikátu). První pokusy o push neprošly (proces push už nečekal na přihlášení), pak **push prošel 2026-11-13**: větev `prvni-verze` je na GitHubu a sleduje `origin/prvni-verze`. Přihlášení drží Git Credential Manager ve Windows.
- Pravidla bezpečnosti: certifikáty a komunikaci s venkem vždy předem konzultovat (globální `CLAUDE.md`), pojistka `permissions.ask` v `~/.claude/settings.json`, ověřeno.

- 2026-11-13: Pages běží na https://wasuruosura.github.io/grooves-pwa/. **Uživatel hlásí, že mikrofon na iPhonu funguje** („vypadá že funguje“). Nepotvrzeno výslovně, že šlo o spuštění z plochy (řádek „Spuštěno: z plochy“). Ověřit při dalším kroku.

## Rozhodnutí

- PWA místo Flutteru, veřejný repozitář `grooves-pwa` na GitHub Pages, data jen v telefonu, přenos s Grooves souborem (JSON export/import). Kontext v `..\vinyl-hledac\POZNAMKA.md` (BPM) a `..\vinyl-hledac\ZAMITNUTO.md`.
- Pořadí: (1) test mikrofonu na iPhonu z plochy, (2) service worker a offline, (3) mobilní Sbírka a Trénink, (4) data v IndexedDB a výměna souborem s Grooves, (5) detekce BPM z mikrofonu.

## Další krok

**Krok (2) offline, 2026-11-13: commit `6ea6f7d` ve větvi `prvni-verze`, pushnutý na GitHub. Uživatel 2026-11-13 hlásí „Funguje“: na iPhonu přes Pages podle postupu (z plochy se sítí, pak režim Letadlo). Krok 2 hotový.** **Řádek „Spuštěno: z plochy“ uživatel neověřil**, ověřit při dalším testu na iPhonu.
- `sw.js`: cache `grooves-v1`, při instalaci uloží soubory appky, cache-first, v `activate` maže staré verze. **Při změně appky zvýšit `VERZE`.**
- `app.js`: registrace s `updateViaCache: "none"`, řádek „Offline: připraveno / nepřipraveno“ v `index.html`.
- `server.py`: lokální server místo `python -m http.server`, protože ten na Windows posílá `.js` jako `text/plain` a Chrome by SW odmítl (ověřeno přes curl; zapsáno v `postupy/prohlizec.md`).
- Ověřeno: všechny soubory ze `SOUBORY` server vrací 200, syntaxe JS v pořádku (`node --check`).
- **Uživatel ověřil v Chromu 2026-11-13:** test offline podle README prošel („Prošlo“). Rozšíření Claude in Chrome nebylo připojené, test dělal ručně.
- Pak uživatel hlásil „Offline: nepřipraveno (… An unknown error occurred when fetching the script)“. Požadavek na `sw.js` nedorazil na server, prohlížeč byl nejspíš offline. Chyba v UI: selhání registrace bez sítě přepsalo stav na „nepřipraveno“, i když SW běží. Opraveno v `app.js` (chyba se ukáže jen bez aktivního SW), `VERZE` → `grooves-v2`.
- **Hypotéza „offline“ byla špatně.** Test ve vestavěném prohlížeči (uživatel svolil, Chrome rozšíření nepřipojené): registrace selže stejně i se sítí, na `localhost` i na `127.0.0.1`. Požadavek od registrace SW na server nedorazí (není v logu). Běžný `fetch("sw.js")` ze stránky projde (200, `text/javascript`) a curl s hlavičkami SW (`Service-Worker: script`) taky. Systémová proxy vypnutá. Běží Avast (`AvastSvc`, `aswEngSrv`). **Podezření: Avast blokuje stahování skriptu SW v prohlížeči. Neověřeno**, nastavení Avastu je na uživateli. Lokálně tak SW na tomto PC nejspíš nepůjde otestovat. Uživatelovo dřívější „Prošlo“ tím pádem asi nebylo skutečné načtení ze SW.
- Návrh: ověřit na GitHub Pages (HTTPS) a na iPhonu, kde Avast není. Vyžaduje push (souhlas uživatele).
- **Neověřeno:** iPhone offline (režim Letadlo).
- Zadání odsouhlasené uživatelem. Artifact na claude.ai místo PWA: probráno, zůstáváme u PWA (nejde offline ani na plochu, data by nebyla jen v telefonu).

- 2026-11-13: přidáno tlačítko **Vypnout mikrofon** (jedno tlačítko přepíná Zapnout/Vypnout, při vypnutí `track.stop()` a `ctx.close()`, na iPhonu má zmizet indikátor mikrofonu). `VERZE` → `grooves-v3`. Ověřeno ve vestavěném prohlížeči s podstrčeným tónem místo mikrofonu (skutečný mikrofon tam blokovaný): přepínání tam a zpět, stopa `ended`. Na iPhonu neověřeno. **Commit `b243fac`, pushnutý 2026-11-13** (uživatel předtím viděl na telefonu starou verzi, protože změna nebyla na Pages).
- 2026-11-13: Grooves (PC) má hotový export sbírky a import měření, commit `874b084` ve `vinyl-hledac`. Formát a postup: `..\vinyl-hledac\POZNAMKA.md` (sekce BPM, „Strana Grooves hotová“). Přenos souborů přes Signal, Poznámka pro sebe.

- **2026-11-13: výměna dat s Grooves (strana telefonu), kód hotový, commit `5182f7b` (2026-11-13). Pushnuto 2026-11-13 (předtím dočasně nešlo DNS kvůli změnám v jiné session).** Zadání odsouhlasené uživatelem („Ano, začni“). `VERZE` → `grooves-v4`.
  - Záložky Sbírka / Měření / Mikrofon (`index.html`). Nové soubory `db.js` (IndexedDB `grooves`: šuplík `kv` s exportem pod klíčem `sbirka`, šuplík `mereni` s klíčem `release_id|pozice`) a `sbirka.js` (Sbírka, Měření, export). Oba v `SOUBORY` v `sw.js`.
  - Sbírka: výběr souboru `grooves-sbirka` v1, kontrola formátu, hledání bez diakritiky (interpret, název, katalogové číslo, label, tracky), max 40 desek v seznamu, přepínač „Jen desky s tracky bez BPM“. Deska se rozbalí na tracky, BPM z měření v telefonu přebíjí BPM z exportu.
  - Proměřit desku: fronta tracků bez BPM, po Uložit další, tlačítko Přeskočit, upozornění „Otoč desku: strana B“ při změně písmene strany.
  - Měření: otáčky (z exportu), pitch % (zůstává mezi tracky), BPM ručně nebo Tap (regrese časů ťuků, pauza 2 s = nová série). Ukládá `bpm` při 0 % = BPM / (1 + pitch/100), `rpm`, `pitch` **v procentech** (rozhodnuto výchozím způsobem), `source` manual/tap, `ts` v sekundách, `odeslano`.
  - Export: jen neodeslaná (nebo zaškrtnout „Poslat všechna znovu“), `navigator.share` se souborem (`application/json`, jinak `text/plain`), jinak stažení. Po sdílení/stažení označí jako odeslané, při zrušení sdílení ne.
  - **Ověřeno 2026-11-13 ve vestavěném prohlížeči** na skutečném exportu z běžícího Grooves (116 desek, 557 tracků, 166 s BPM): načtení, hledání, fronta 9 tracků dvojalba s upozorněním B/C/D, tap (9 ťuků), ruční zadání s čárkou a záporným pitchem (127,5 při −1,5 % → 129,44), data po reloadu zůstanou, mobilní šířka 375 px vypadá v pořádku. Export (cesta se stažením) má správný formát a **Grooves `/api/mobile/preview` ho přijal** (stavy new / unknown, nic se neuložilo).
  - **Neověřeno:** Sdílet do Signalu na iPhonu (z plochy), výběr souboru ze Souborů/Signalu na iPhonu, data v IndexedDB po zavření appky na iPhonu, skutečný import v Grooves přes UI.
  - Testovací kopie exportu byla v `test-data/` (v `.gitignore`, smazaná). Ve vestavěném prohlížeči appky zůstala testovací sbírka a 1 měření v IndexedDB pro `localhost:8780`.

Uživatel 2026-11-13: nová verze na iPhonu z plochy se ukázala až po úplném zavření appky (Pages posílaly v4 hned), „už se zdá že funguje“. Výměna souborů přes Signal zatím neověřená.

- **2026-11-13: krok (5) detekce BPM z mikrofonu, kód hotový, necommitnuto.** Zadání odsouhlasené uživatelem („Ano, začni“). `VERZE` → `grooves-v5`.
  - `mikrofon.js` (nový): `zapniMikrofon(priVypnuti)` / `vypniMikrofon()` / `popisChybyMikrofonu`, mikrofon zapnutý vždy nejvýš jednou. Používá ho test v záložce Mikrofon (`app.js`) i měření (`sbirka.js`); kdo ho převezme, tomu druhému se zavolá `priVypnuti`.
  - `bpm.js` (nový, bez knihoven, testovatelný v Node): FFT 1024, krok 10 ms, spectral flux ve 20 log pásmech 30 Hz – 8 kHz, okno až 24 s, autokorelace, skóre tempa 70–180 BPM po 0,02 = průměr přes všechny násobky doby, doladění parabolou. Polovina/dvojnásobek: preference kolem 125 BPM. `jistota` < 0,08 = „rytmus nejasný“ (šum ~0,03). Ustálení: posledních 5 odhadů (1 za s) v rozpětí ≤ 0,3 BPM, hodnota = medián.
  - UI v Měření: Měřit z mikrofonu / Zastavit měření, ukazatel hlasitosti, „14 s · 126,33 BPM · kolísá ±0,05 · ustáleno“, tlačítka ÷2 a ×2. Po ustálení se BPM píše do pole se zdrojem `detect` a dál zpřesňuje; když uživatel ťukne Tap nebo napíše BPM, detekce pole už nepřepisuje. Mikrofon se vypne při Uložit, výběru jiného tracku (i Přeskočit) a odchodu ze záložky Měření. Zvuk přes `ScriptProcessorNode` (4096).
  - **Ověřeno 2026-11-13:** `node testy/test-bpm.js`: 11 případů (house 118,75–135,2, hip hop 90/96,4, dnb 140/174, i se šumem 0,3), ustálení za 10–14 s, odchylka po 30 s ≤ 0,02 BPM, po ustálení ≤ 0,06. Samotný šum se neustálí. 174 BPM dnb vyjde jako 86,96 (polovina, opraví ×2). Ve vestavěném prohlížeči s podstrčeným signálem 126,3 BPM místo mikrofonu: ustálení za ~11–14 s na 126,31–126,33, `getUserMedia` dostal všechna tři `false`, ÷2/×2, ruční zápis se nepřepíše, Uložit uloží `source: detect` s přepočtem pitche (126,32 při +1 % → 125,07) a zastaví stopu (`ended`), přepnutí záložky stopu zastaví, test v záložce Mikrofon po přesunu kódu zapne/vypne. Mobilní šířka 375 px v pořádku.
  - **Neověřeno:** skutečný mikrofon a deska (reproduktor, ozvěna místnosti, šum gramofonu), iPhone (ScriptProcessor, výkon: odhad na PC ~10 ms), skutečné tempo mimo syntetiku (swing, breaky, ambient bez bicích). Ukazatel hlasitosti v testu Mikrofon ve vestavěném prohlížeči zůstal prázdný (nejspíš skrytý panel brzdí `requestAnimationFrame`, kód kreslení se neměnil).
  - Ve vestavěném prohlížeči přibylo v testovací IndexedDB měření tracku A1 „Acid Marathon 1“ (125,07, detect), jen lokální testovací data.

Další krok: uživatel rozhodne o commitu a pushi (`mikrofon.js`, `bpm.js`, `testy/test-bpm.js`, úpravy `app.js`, `sbirka.js`, `index.html`, `style.css`, `sw.js`, `README.md`, tato poznámka). Pak na iPhonu z plochy: několik desek změřit mikrofonem a porovnat s tapem nebo BPM z VirtualDJ; zapsat přesnost a dobu ustálení. Možná vylepšení podle zkušenosti: v Proměřit desku nechat mikrofon zapnutý mezi tracky (teď se po Uložit vypne, jak bylo v zadání), posunout preferenci tempa podle žánrů ve sbírce. Souběžně stále neověřená výměna přes Signal. Mobilní Trénink (kalkulačka pitche) zatím není.

Historie kroku 1:
1. Uživatel vyzkouší lokálně v Chromu.
2. Uživatel zapne Pages: Settings → Pages → Deploy from a branch → `prvni-verze`, složka `/ (root)` → Save. Adresa: https://wasuruosura.github.io/grooves-pwa/
3. Test na iPhonu z plochy. Hlavní otázka: funguje mikrofon v režimu z plochy.
