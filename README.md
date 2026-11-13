# Grooves PWA

Mobilní část Grooves pro iPhone. Zatím test mikrofonu (ukazatel hlasitosti a blikání do rytmu) a offline režim (service worker `sw.js`).

## Spuštění na PC

```
uv run --no-project python server.py
```

Pak otevřít http://localhost:8780 v Chromu, kliknout na „Zapnout mikrofon“ a pustit hudbu.

`server.py` je obyčejný `http.server`, jen posílá `.js` jako JavaScript. Windows jinak posílá `text/plain` a Chrome service worker odmítne.

### Test offline

1. Otevřít http://localhost:8780. Řádek „Offline“ má ukazovat „připraveno“.
2. DevTools (F12) → Application → Service Workers: `sw.js` je „activated and is running“. Cache Storage → `grooves-v2` obsahuje soubory appky.
3. Network → zaškrtnout Offline (nebo zastavit server) → obnovit stránku. Appka se musí načíst.

### Nová verze

Při každé změně souborů appky zvýšit `VERZE` v `sw.js` (např. `grooves-v2` → `grooves-v3`), jinak telefon dál ukazuje starou verzi z cache. V telefonu se nová verze projeví až při dalším spuštění.

## Na iPhonu

1. Otevřít adresu na GitHub Pages v Safari.
2. Sdílet → Přidat na plochu.
3. Spustit z plochy, ťuknout na „Zapnout mikrofon“ a povolit mikrofon.

Ověřit: řádek „Spuštěno“ ukazuje „z plochy“, ukazatel kmitá a kolečko bliká do rytmu.

Offline: jednou spustit z plochy se sítí (řádek „Offline: připraveno“), appku zavřít, zapnout režim Letadlo a spustit znovu z plochy.
