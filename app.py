from pathlib import Path

import secrets
import os

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from endpoints.health import router as health_router
from endpoints.natal import router as natal_router
from endpoints.transit import router as transit_router
from endpoints.transit_range import router as transit_range_router
from endpoints.svg_chart import router as svg_chart_router
from endpoints.report import router as report_router
from endpoints.relationship import router as relationship_router

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"
FRONTEND_LEGACY = FRONTEND_DIR / "legacy"
FRONTEND_DIST.mkdir(parents=True, exist_ok=True)
FRONTEND_LEGACY.mkdir(parents=True, exist_ok=True)


security = HTTPBasic()

# 🔐 Credentials
DEMO_USERNAME = os.getenv("DEMO_USERNAME", "demo")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "demo1234")


def get_current_username(credentials: HTTPBasicCredentials = Depends(security)):
    # Use compare_digest to avoid timing attacks
    correct_username = secrets.compare_digest(credentials.username, DEMO_USERNAME)
    correct_password = secrets.compare_digest(credentials.password, DEMO_PASSWORD)

    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )

    return credentials.username

app = FastAPI(
    title="Astro API",
    version="0.4.0",
    description=(
        "Astro API + minimal web app on top of the Kerykeion library.\n\n"
        "- JSON endpoints under the `/api` prefix (natal, transits, reports, relationship, synastry).\n"
        "- A small web UI at `/home` for generating natal SVG charts.\n"
        "- Static assets served from `/static`."
    ),
    dependencies=[Depends(get_current_username)],
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
    StaticFiles(directory=str(FRONTEND_DIST), html=True),
    name="static",
)
app.mount(
    "/legacy",
    StaticFiles(directory=str(FRONTEND_LEGACY), html=True),
    name="legacy",
)


def _frontend_page(filename: str) -> Path:
    """
    Resolve a built frontend page, falling back to the legacy copy if the build is missing.
    """
    candidate = FRONTEND_DIST / filename
    if candidate.exists():
        return candidate
    legacy_map = {
        "index.html": FRONTEND_LEGACY / "home.html",
        "advanced.html": FRONTEND_LEGACY / "advanced.html",
        "esoteric.html": FRONTEND_LEGACY / "esoteric.html",
    }
    return legacy_map.get(filename, candidate)


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

    The page loads `frontend/dist/index.html`, which pulls assets from `/static`.
    """
    return FileResponse(_frontend_page("index.html"))


@app.get("/advanced", include_in_schema=False)
async def advanced() -> FileResponse:
    """
    Serve the advanced layout page.

    The page loads `frontend/dist/advanced.html` and assets from `/static`.
    """
    return FileResponse(_frontend_page("advanced.html"))


@app.get("/esoteric", include_in_schema=False)
async def esoteric() -> FileResponse:
    """
    Serve the esoteric layout page.

    The page loads `frontend/dist/esoteric.html` and assets from `/static`.
    """
    return FileResponse(_frontend_page("esoteric.html"))


# API routers – all mounted under `/api`
API_PREFIX = "/api"

app.include_router(health_router, prefix=API_PREFIX)
app.include_router(natal_router, prefix=API_PREFIX)
app.include_router(transit_router, prefix=API_PREFIX)
app.include_router(transit_range_router, prefix=API_PREFIX)
app.include_router(report_router, prefix=API_PREFIX)
app.include_router(relationship_router, prefix=API_PREFIX)
app.include_router(svg_chart_router, prefix=API_PREFIX)
