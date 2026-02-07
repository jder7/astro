import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from service.schemas import GeoResolveRequest, GeoResolveResponse, GeoSearchRequest, GeoSearchResponse, GeoSearchResult, GeoStatusResponse

router = APIRouter(tags=["geo"])

GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
GOOGLE_PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/"
REPO_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DUMMY_GOOGLE_KEY_PATH = REPO_DIR / "secrets" / "google_dummy_key.txt"


def _load_dummy_key() -> str:
    try:
        with DEFAULT_DUMMY_GOOGLE_KEY_PATH.open("r", encoding="utf-8") as handle:
            return handle.read().strip()
    except FileNotFoundError:
        return ""
    except OSError as exc:
        print("[geo] Failed to read dummy key file:", DEFAULT_DUMMY_GOOGLE_KEY_PATH, exc)
        return ""


DEFAULT_DUMMY_GOOGLE_KEY = _load_dummy_key()
GOOGLE_GEOCODING_API_KEY = os.getenv("GOOGLE_GEOCODING_API_KEY", DEFAULT_DUMMY_GOOGLE_KEY).strip()
_API_ACTIVE_CACHE: Optional[bool] = None


def _mask_key(value: str) -> str:
    if not value:
        return "(empty)"
    if len(value) <= 6:
        return f"{value[:2]}***"
    return f"{value[:4]}***{value[-4:]}"

CITY_PRIORITY = [
    "locality",
    "postal_town",
    "administrative_area_level_2",
    "administrative_area_level_1",
    "sublocality",
    "colloquial_area",
]

CITY_PREDICTION_TYPES = {
    "locality",
    "postal_town",
    "administrative_area_level_1",
    "administrative_area_level_2",
}


def _api_configured() -> bool:
    return bool(GOOGLE_GEOCODING_API_KEY)


def _api_active() -> bool:
    if not _api_configured():
        return False
    global _API_ACTIVE_CACHE
    if _API_ACTIVE_CACHE is not None:
        return _API_ACTIVE_CACHE
    payload_obj = {"input": "Paris"}
    payload = json.dumps(payload_obj).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_GEOCODING_API_KEY,
    }
    request = urllib.request.Request(GOOGLE_PLACES_AUTOCOMPLETE_URL, data=payload, headers=headers, method="POST")
    try:
        print("[geo] STATUS CHECK", GOOGLE_PLACES_AUTOCOMPLETE_URL, payload_obj)
        with urllib.request.urlopen(request, timeout=4) as response:
            body_raw = response.read().decode("utf-8")
            _API_ACTIVE_CACHE = response.status == 200
            print("[geo] STATUS HTTP", response.status)
        print("[geo] STATUS RESPONSE", _API_ACTIVE_CACHE)
    except urllib.error.HTTPError as exc:
        try:
            body_raw = exc.read().decode("utf-8")
        except Exception:
            body_raw = ""
        print("[geo] STATUS HTTP ERROR", exc.code, exc.reason)
        if body_raw:
            print("[geo] STATUS ERROR BODY", body_raw)
        _API_ACTIVE_CACHE = False
    except Exception as exc:
        print("[geo] STATUS ERROR", exc)
        _API_ACTIVE_CACHE = False
    return _API_ACTIVE_CACHE


def init_geo_status() -> None:
    print("[geo] API key configured:", _api_configured(), "key:", _mask_key(GOOGLE_GEOCODING_API_KEY))
    print("[geo] API active cache before:", _API_ACTIVE_CACHE)
    _api_active()
    print("[geo] API active cache after:", _API_ACTIVE_CACHE)


def _pick_component(components: list[dict], type_name: str) -> Optional[dict]:
    for comp in components:
        if type_name in comp.get("types", []):
            return comp
    return None


def _extract_city(components: list[dict]) -> Optional[str]:
    for type_name in CITY_PRIORITY:
        comp = _pick_component(components, type_name)
        if comp:
            return (
                comp.get("longText")
                or comp.get("shortText")
                or comp.get("long_name")
                or comp.get("short_name")
            )
    return None


def _extract_country_code(components: list[dict]) -> Optional[str]:
    comp = _pick_component(components, "country")
    if not comp:
        return None
    return (
        comp.get("shortText")
        or comp.get("short_name")
        or comp.get("longText")
        or comp.get("long_name")
    )


def _build_places_headers(field_mask: str) -> dict:
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_GEOCODING_API_KEY,
        "X-Goog-FieldMask": field_mask,
    }


def _call_places_autocomplete(query: str) -> dict:
    if not _api_active():
        raise HTTPException(status_code=503, detail="Google places API is not configured.")
    payload_obj = {"input": query}
    payload = json.dumps(payload_obj).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_GEOCODING_API_KEY,
    }
    request = urllib.request.Request(GOOGLE_PLACES_AUTOCOMPLETE_URL, data=payload, headers=headers, method="POST")
    try:
        print("[geo] POST", GOOGLE_PLACES_AUTOCOMPLETE_URL, payload_obj)
        with urllib.request.urlopen(request, timeout=6) as response:
            payload = json.loads(response.read().decode("utf-8"))
        print("[geo] RESPONSE", payload)
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Google places request failed: {exc.reason}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Google places request failed.") from exc
    return payload


def _call_places_details(place_id: str) -> dict:
    if not _api_active():
        raise HTTPException(status_code=503, detail="Google places API is not configured.")
    if place_id.startswith("places/"):
        place_id = place_id.split("places/", 1)[1]
    headers = _build_places_headers(
        "id,displayName,formattedAddress,location,addressComponents,timeZone"
    )
    request = urllib.request.Request(f"{GOOGLE_PLACES_DETAILS_URL}{place_id}", headers=headers, method="GET")
    try:
        print("[geo] GET", f"{GOOGLE_PLACES_DETAILS_URL}{place_id}")
        with urllib.request.urlopen(request, timeout=6) as response:
            payload = json.loads(response.read().decode("utf-8"))
        print("[geo] RESPONSE", payload)
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Google places request failed: {exc.reason}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Google places request failed.") from exc
    return payload


def _prediction_to_item(prediction: dict) -> GeoSearchResult:
    structured = prediction.get("structuredFormat") or {}
    main_text = (structured.get("mainText") or {}).get("text")
    secondary_text = (structured.get("secondaryText") or {}).get("text")
    text = (prediction.get("text") or {}).get("text")
    label = text or ", ".join([part for part in [main_text, secondary_text] if part]) or ""
    return GeoSearchResult(
        place_id=prediction.get("placeId") or prediction.get("place", ""),
        label=label,
        city=main_text or label,
        country_code=None,
        lat=None,
        lng=None,
        tz_str=None,
    )


def _result_to_item(result: dict) -> GeoSearchResult:
    components = result.get("addressComponents") or []
    location = result.get("location") or {}
    time_zone = result.get("timeZone") or {}
    formatted_address = result.get("formattedAddress") or ""
    label = formatted_address or ""
    component_country = _extract_country_code(components)
    return GeoSearchResult(
        place_id=result.get("id", ""),
        label=label,
        city=_extract_city(components),
        country_code=component_country,
        lat=location.get("latitude"),
        lng=location.get("longitude"),
        tz_str=time_zone.get("id"),
    )


@router.get("/geo/status", response_model=GeoStatusResponse)
async def geo_status() -> GeoStatusResponse:
    """
    Report whether the Google places API is configured and active.
    """
    active = _api_active()
    configured = _api_configured()
    message = None
    if not configured:
        message = "Google places API key is not configured."
    elif not active:
        message = "Google places API key is using the dummy fallback value."
    return GeoStatusResponse(active=active, configured=configured, message=message)


@router.post("/geo/search", response_model=GeoSearchResponse)
async def geo_search(payload: GeoSearchRequest) -> GeoSearchResponse:
    """
    Search for up to 5 matching locations from Google places.
    """
    data = _call_places_autocomplete(payload.query)
    suggestions = data.get("suggestions") or []
    predictions = []
    for suggestion in suggestions:
        prediction = suggestion.get("placePrediction")
        if not prediction:
            continue
        predictions.append(prediction)
    filtered = [
        prediction
        for prediction in predictions
        if CITY_PREDICTION_TYPES.intersection(prediction.get("types", []))
    ]
    selected = filtered or predictions
    items = [_prediction_to_item(result) for result in selected[:5]]
    return GeoSearchResponse(active=True, results=items)


@router.post("/geo/resolve", response_model=GeoResolveResponse)
async def geo_resolve(payload: GeoResolveRequest) -> GeoResolveResponse:
    """
    Resolve a place_id into coordinates and core location fields.
    """
    data = _call_places_details(payload.place_id)
    if not data:
        raise HTTPException(status_code=404, detail="No results for provided place_id.")
    item = _result_to_item(data)
    return GeoResolveResponse(
        place_id=item.place_id,
        label=item.label,
        city=item.city,
        country_code=item.country_code,
        lat=item.lat,
        lng=item.lng,
        tz_str=item.tz_str,
    )
