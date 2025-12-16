# Astro App & API

Minimal FastAPI wrapper around the [Kerykeion](https://www.kerykeion.net/) library,
bundled with a tiny frontend to generate natal SVG charts.

- **No interpretations** – only raw astrological configurations (positions, houses, aspects, etc.).
- Designed for **personal / educational** use.
- Supports **Tropical** and **Sidereal** zodiacs (with configurable ayanamsa).
- Built on **FastAPI** + **Kerykeion 5.x**.
- Ships SVG chart generation with configurable **themes**.
- Provides a simple **web app** at `/home` on top of the JSON API.

> ⚠️ Kerykeion is licensed under **AGPL-3.0**. If you deploy this API as a public
> service, you are generally expected to open-source this project under a
> compatible license.

---

The FastAPI app is defined in `app.py` and served as `app:app`.

---

## Running locally

```bash
git clone https://github.com/jder7/astro.git
cd astro

python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt

uvicorn app:app --reload
```

Then open:

- Web app:   <http://127.0.0.1:8000/home>  (root `/` redirects here)
- Swagger:   <http://127.0.0.1:8000/docs>
- ReDoc:     <http://127.0.0.1:8000/redoc>

---

## Frontend (Svelte + Vite + Tailwind)

- Dev server: `cd frontend && npm install && npm run dev -- --host`
- Production build: `npm run build` (outputs to `frontend/dist`, served at `/static`)
- Legacy static pages live under `frontend/legacy` and are exposed at `/legacy/*`.

The FastAPI app falls back to the legacy HTML files if a fresh `dist` build is missing.

---

## Docker build & run

Build the image (from the repo root):

```bash
docker build -t astro-app .
```

Run the container, exposing the FastAPI server on port 8000:

```bash
docker run --rm -p 8000:8000 astro-app
```

Then visit <http://127.0.0.1:8000/home>. Swagger and ReDoc are available at `/docs` and `/redoc` as usual.

### Basic auth env vars

The API is protected with HTTP Basic Auth. Defaults are `demo` / `demo1234`. Override them in Docker with:

```bash
docker run --rm -p 8000:8000 \
  -e DEMO_USERNAME=youruser \
  -e DEMO_PASSWORD=yourpass \
  astro-app
```

--- 

## Endpoint reference

All JSON / SVG API endpoints are mounted under the `/api` prefix.

For a concise overview of paths and request/response shapes, see:

➡️ [`docs/ENDPOINTS.md`](docs/ENDPOINTS.md)

That file is the canonical API reference for this project and is kept in sync
with the FastAPI schemas.
