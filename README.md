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

## Project layout

```text
astro/
  app.py               # FastAPI app, router wiring, static/frontend integration
  enums.py             # Perspective, ZodiacType, SiderealMode, HouseSystem, Theme, etc.
  schemas.py           # Pydantic models (requests & responses)
  utils.py             # Shared helpers (subjects, ranges, SVG rendering, reports)
  endpoints/
    __init__.py
    health.py          # GET /api/health
    natal.py           # POST /api/natal
    natal_svg.py       # POST /api/svg/natal
    transit.py         # POST /api/transit
    transit_range.py   # POST /api/transit-range
    transit_svg.py     # POST /api/svg/transit
    report.py          # POST /api/report
    relationship.py    # POST /api/relationship
    synastry_svg.py    # POST /api/svg/synastry
  frontend/
    home.html          # Home page – natal SVG generator UI
    js/
      home.js          # Frontend logic (calls /api/svg/natal)
    css/
      home.css         # Simple styling for home.html
  docs/
    ENDPOINTS.md       # Short endpoint reference (linked below)
  samples/
    natal.json         # example natal response
    transit-range.json # example transit-range response
  requirements.txt
  README.md
```

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

Static assets (JS and CSS) are served from:

- `/static/js/home.js`
- `/static/css/home.css`

---

## Configuration model

Most endpoints accept a nested `config` object of type `ChartConfig`:

```jsonc
{
  "perspective": "TOPOCENTRIC",       // enum Perspective
  "zodiac_type": "SIDEREAL",          // enum ZodiacType ("TROPIC" or "SIDEREAL")
  "sidereal_mode": "KRISHNAMURTI",    // enum SiderealMode (for sidereal only)
  "house_system": "WHOLE_SIGN",       // enum HouseSystem (default Whole Sign / "W")
  "theme": "classic"                  // enum Theme (SVG visual style)
}
```

Defaults (when `config` is omitted) are:

- `perspective` → `TOPOCENTRIC`
- `zodiac_type` → `SIDEREAL`
- `sidereal_mode` → `KRISHNAMURTI`
- `house_system` → `WHOLE_SIGN`
- `theme` → `classic`

### Themes

Themes are passed directly to Kerykeion’s `ChartDrawer(theme=...)` and control
the SVG appearance:

- `classic` (default)
- `dark`
- `dark-high-contrast`
- `light`
- `strawberry`
- `black-and-white`

---

## Birth / event data

Astrological inputs are based on `BirthData` with sensible defaults so Swagger
is always pre-filled:

```jsonc
{
  "name": "Subject",
  "year": 1990,
  "month": 1,
  "day": 1,
  "hour": 12,
  "minute": 0,
  "lng": 4.8952,
  "lat": 52.3702,
  "tz_str": "Europe/Amsterdam",
  "city": "Amsterdam",
  "nation": "NL"
}
```

For **transits**, the API uses a lighter `TransitMomentInput` that omits the
`name` field entirely – you only provide date, time, and location.

---

## Web app home page

The home page at `/home` (also reachable from `/`) is a small single page app:

- Built with plain HTML + JS + CSS in `frontend/`.
- Sends a `POST` to `/api/svg/natal` with a JSON payload:

  ```jsonc
  {
    "birth": {
      "name": "Subject",
      "year": 1990,
      "month": 1,
      "day": 1,
      "hour": 12,
      "minute": 0,
      "lng": 4.8952,
      "lat": 52.3702,
      "tz_str": "Europe/Amsterdam",
      "city": "Amsterdam",
      "nation": "NL"
    },
    "config": {
      "theme": "classic"
    }
  }
  ```

- Injects the returned SVG from `/api/svg/natal` directly into the page.

You can extend `frontend/js/home.js` to expose more configuration fields
(perspective, zodiac type, house system, etc.) if desired.

---

## Endpoint reference

All JSON / SVG API endpoints are mounted under the `/api` prefix.

For a concise overview of paths and request/response shapes, see:

➡️ [`docs/ENDPOINTS.md`](docs/ENDPOINTS.md)

That file is the canonical API reference for this project and is kept in sync
with the FastAPI schemas.
