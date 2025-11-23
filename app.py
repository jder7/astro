from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from endpoints.health import router as health_router
from endpoints.natal import router as natal_router
from endpoints.transit import router as transit_router
from endpoints.transit_range import router as transit_range_router
from endpoints.natal_svg import router as natal_svg_router
from endpoints.transit_svg import router as transit_svg_router
from endpoints.report import router as report_router
from endpoints.relationship import router as relationship_router
from endpoints.synastry_svg import router as synastry_svg_router

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(
    title="Astro API",
    version="0.4.0",
    description=(
        "Astro API + minimal web app on top of the Kerykeion library.\n\n"
        "- JSON endpoints under the `/api` prefix (natal, transits, reports, relationship, synastry).\n"
        "- A small web UI at `/home` for generating natal SVG charts.\n"
        "- Static assets served from `/static`."
    ),
)

# CORS – permissive for development / simple cloud deployments.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static assets (CSS/JS) from the `frontend` folder under `/static`.
app.mount(
    "/static",
    StaticFiles(directory=str(FRONTEND_DIR), html=False),
    name="static",
)


@app.get("/", include_in_schema=False)
async def root_redirect() -> RedirectResponse:
    """
    Redirect the bare root path `/` to the home page `/home`.
    """
    return RedirectResponse(url="/home", status_code=307)


@app.get("/home", include_in_schema=False)
async def home() -> FileResponse:
    """
    Serve the simple frontend used to generate natal SVG charts.

    The page loads `frontend/home.html`, which in turn loads its JS/CSS
    from `/static/js/home.js` and `/static/css/home.css`.
    """
    return FileResponse(FRONTEND_DIR / "home.html")


# API routers – all mounted under `/api`
API_PREFIX = "/api"

app.include_router(health_router, prefix=API_PREFIX)
app.include_router(natal_router, prefix=API_PREFIX)
app.include_router(transit_router, prefix=API_PREFIX)
app.include_router(transit_range_router, prefix=API_PREFIX)
app.include_router(report_router, prefix=API_PREFIX)
app.include_router(relationship_router, prefix=API_PREFIX)
app.include_router(natal_svg_router, prefix=API_PREFIX)
app.include_router(transit_svg_router, prefix=API_PREFIX)
app.include_router(synastry_svg_router, prefix=API_PREFIX)
