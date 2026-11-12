# Grooves PWA – poznámka ke stavu práce

## Stav (2026-11-13)

- Kostra první verze: stránka s testem mikrofonu (hlasitost, hrubé blikání do rytmu, režim z plochy/v prohlížeči, HTTPS), manifest a ikony. Větev `prvni-verze`, zatím necommitnuté.
- Na GitHubu zatím nic. Uživatel má účet `wasuruosura` a je v prohlížeči přihlášený. Git na PC má Git Credential Manager (`credential.helper = manager`), při prvním pushi se přihlásí přes prohlížeč.

## Rozhodnutí

- PWA místo Flutteru, veřejný repozitář `grooves-pwa` na GitHub Pages, data jen v telefonu, přenos s Grooves souborem (JSON export/import). Kontext v `..\vinyl-hledac\POZNAMKA.md` (BPM) a `..\vinyl-hledac\ZAMITNUTO.md`.
- Pořadí: (1) test mikrofonu na iPhonu z plochy, (2) service worker a offline, (3) mobilní Sbírka a Trénink, (4) data v IndexedDB a výměna souborem s Grooves, (5) detekce BPM z mikrofonu.

## Další krok

1. Uživatel vyzkouší lokálně v Chromu.
2. Uživatel na github.com založí prázdný veřejný repozitář `grooves-pwa` (bez README). Claude přidá remote, commit a push až na pokyn, pak zapnout Pages (Settings → Pages → větev).
3. Test na iPhonu z plochy. Hlavní otázka: funguje mikrofon v režimu z plochy.
