import os
import secrets
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from service.endpoints.health import router as health_router
from service.endpoints.natal import router as natal_router
from service.endpoints.transit import router as transit_router
from service.endpoints.transit_range import router as transit_range_router
from service.endpoints.time_range_sweeps import router as ranges_router
from service.endpoints.svg_chart import router as svg_chart_router
from service.endpoints.report import router as report_router
from service.endpoints.relationship import router as relationship_router
from service.endpoints.geolocation import router as geolocation_router
from service.endpoints.education import router as education_router
from service.endpoints.geolocation import init_geo_status

REPO_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = REPO_DIR / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"
FRONTEND_DIST.mkdir(parents=True, exist_ok=True)

DOCS_PREFIX = "/api/docs"
REDOC_PATH = "/api/redoc"
OPENAPI_PATH = "/api/openapi.json"
DOCS_PATHS = {
    DOCS_PREFIX,
    f"{DOCS_PREFIX}/oauth2-redirect",
    REDOC_PATH,
    OPENAPI_PATH,
}

security = HTTPBasic(auto_error=False)

# 🔐 Credentials
DEMO_USERNAME = os.getenv("DEMO_USERNAME", "demo")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "demo1234")
ENABLE_SECURITY = os.getenv("ENABLE_SECURITY", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _is_docs_path(path: str) -> bool:
    return path in DOCS_PATHS or path.startswith(f"{DOCS_PREFIX}/")


def get_current_username(
    request: Request,
    credentials: HTTPBasicCredentials | None = Depends(security),
):
    if _is_docs_path(request.url.path):
        return "docs"
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
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
    docs_url=DOCS_PREFIX,
    redoc_url=REDOC_PATH,
    openapi_url=OPENAPI_PATH,
    dependencies=[Depends(get_current_username)] if ENABLE_SECURITY else None,
)


@app.on_event("startup")
async def startup_status_check() -> None:
    init_geo_status()

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
def _frontend_page(filename: str) -> Path:
    """
    Resolve a built frontend page from the dist bundle.
    """
    candidate = FRONTEND_DIST / filename
    if candidate.exists():
        return candidate
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frontend build not found.")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code != status.HTTP_401_UNAUTHORIZED:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)
    accept_header = request.headers.get("accept", "")
    wants_html = "text/html" in accept_header and "application/json" not in accept_header
    if wants_html:
        headers = dict(exc.headers or {})
        return FileResponse(_frontend_page("401.html"), status_code=exc.status_code, headers=headers)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)


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


@app.get("/education", include_in_schema=False)
async def education() -> FileResponse:
    """
    Serve the education layout page.

    The page loads `frontend/dist/education.html` and assets from `/static`.
    """
    return FileResponse(_frontend_page("education.html"))


# API routers – all mounted under `/api`
API_PREFIX = "/api"

app.include_router(health_router, prefix=API_PREFIX)
app.include_router(natal_router, prefix=API_PREFIX)
app.include_router(transit_router, prefix=API_PREFIX)
app.include_router(transit_range_router, prefix=API_PREFIX)
app.include_router(ranges_router, prefix=API_PREFIX)
app.include_router(report_router, prefix=API_PREFIX)
app.include_router(relationship_router, prefix=API_PREFIX)
app.include_router(svg_chart_router, prefix=API_PREFIX)
app.include_router(geolocation_router, prefix=API_PREFIX)
app.include_router(education_router, prefix=API_PREFIX)
