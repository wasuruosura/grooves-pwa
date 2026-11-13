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

**Krok (2) offline, 2026-11-13: kód napsaný, necommitnutý (větev `prvni-verze`).**
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

Další: commit (s ním i starší záznam o testu mikrofonu) → push na pokyn → test na iPhonu z plochy v režimu Letadlo (a při tom ověřit řádek „Spuštěno: z plochy“). Pak krok (3) mobilní Sbírka a Trénink.

Historie kroku 1:
1. Uživatel vyzkouší lokálně v Chromu.
2. Uživatel zapne Pages: Settings → Pages → Deploy from a branch → `prvni-verze`, složka `/ (root)` → Save. Adresa: https://wasuruosura.github.io/grooves-pwa/
3. Test na iPhonu z plochy. Hlavní otázka: funguje mikrofon v režimu z plochy.
