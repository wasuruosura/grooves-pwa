# Grooves PWA

Mobilní část Grooves pro iPhone. Záložky:

- **Sbírka**: načtení exportu z Grooves (soubor `grooves-sbirka`, v Grooves Sbírka → Export do mobilu), hledání podle interpreta, názvu a katalogového čísla, výběr tracku, režim „Proměřit desku“.
- **Měření**: BPM ručně nebo tapem, uloží se přepočtené na 0 % pitche. Export měření (`grooves-mereni`) přes Sdílet (Signal), jinak stažením souboru. V Grooves pak Sbírka → Import z mobilu.
- **Mikrofon**: test mikrofonu (ukazatel hlasitosti, blikání do rytmu) a stav offline režimu.

Data (sbírka a měření) jsou jen v telefonu, v IndexedDB (`db.js`). Kód: `sbirka.js` (Sbírka, Měření, export), `app.js` (mikrofon, service worker).

## Spuštění na PC

```
uv run --no-project python server.py
```

Pak otevřít http://localhost:8780 v Chromu, kliknout na „Zapnout mikrofon“ a pustit hudbu.

`server.py` je obyčejný `http.server`, jen posílá `.js` jako JavaScript. Windows jinak posílá `text/plain` a Chrome service worker odmítne.

### Test offline

1. Otevřít http://localhost:8780. Řádek „Offline“ má ukazovat „připraveno“.
2. DevTools (F12) → Application → Service Workers: `sw.js` je „activated and is running“. Cache Storage → `grooves-v4` obsahuje soubory appky.
3. Network → zaškrtnout Offline (nebo zastavit server) → obnovit stránku. Appka se musí načíst.

### Nová verze

Při každé změně souborů appky zvýšit `VERZE` v `sw.js` (např. `grooves-v2` → `grooves-v3`), jinak telefon dál ukazuje starou verzi z cache. V telefonu se nová verze projeví až při dalším spuštění.

### Test sbírky a měření na PC

Export sbírky stáhnout z běžícího Grooves (http://127.0.0.1:8765/api/mobile/export) a v záložce Sbírka ho vybrat. Export obsahuje data sbírky: **nedávat do repozitáře** (je veřejný). Soubor ve složce `test-data/` git ignoruje.

## Na iPhonu

1. Otevřít adresu na GitHub Pages v Safari.
2. Sdílet → Přidat na plochu.
3. Spustit z plochy, ťuknout na „Zapnout mikrofon“ a povolit mikrofon.

Ověřit: řádek „Spuštěno“ ukazuje „z plochy“, ukazatel kmitá a kolečko bliká do rytmu.

Sbírka: v Grooves na PC Export do mobilu, soubor poslat přes Signal (Poznámka pro sebe), v telefonu uložit do Souborů a v appce Sbírka → Načíst sbírku z Grooves. Měření zpátky: Měření → Poslat do Grooves → Signal.

Offline: jednou spustit z plochy se sítí (řádek „Offline: připraveno“), appku zavřít, zapnout režim Letadlo a spustit znovu z plochy.
