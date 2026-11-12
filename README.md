# Grooves PWA

Mobilní část Grooves pro iPhone. Zatím jen test mikrofonu: ukazatel hlasitosti a blikání do rytmu.

## Spuštění na PC

```
uv run --no-project python -m http.server 8780
```

Pak otevřít http://localhost:8780 v Chromu, kliknout na „Zapnout mikrofon“ a pustit hudbu.

## Na iPhonu

1. Otevřít adresu na GitHub Pages v Safari.
2. Sdílet → Přidat na plochu.
3. Spustit z plochy, ťuknout na „Zapnout mikrofon“ a povolit mikrofon.

Ověřit: řádek „Spuštěno“ ukazuje „z plochy“, ukazatel kmitá a kolečko bliká do rytmu.
