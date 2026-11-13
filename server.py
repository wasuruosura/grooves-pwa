# Lokální server pro vývoj: jako `python -m http.server`, ale .js posílá jako JavaScript.
# Windows bere typy souborů z registru a .js tam bývá text/plain; Chrome pak odmítne service worker.
# Spuštění: uv run --no-project python server.py   → http://localhost:8780
import http.server


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }


http.server.test(HandlerClass=Handler, port=8780, bind="127.0.0.1")
