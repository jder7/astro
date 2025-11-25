# Astro API – Endpoint Reference

This file summarizes the available endpoints and their main request/response
shapes. For precise field definitions, refer to the Swagger UI (`/docs`) or
`schemas.py`.

All JSON / SVG endpoints are mounted under the `/api` prefix.

---

## Shared models (simplified)

### `BirthData`

Used for natal charts, reports, relationship, synastry.

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

### `TransitMomentInput`

Used for transit snapshots and as the start for transit ranges. No `name`.

```jsonc
{
  "year": 2025,
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

### `TransitEndInput`

Used only in `/api/transit-range` to mark the end of the interval:

```jsonc
{
  "year": 2025,
  "month": 1,
  "day": 2,
  "hour": 12,
  "minute": 0
}
```

### `ChartConfig`

```jsonc
{
  "perspective": "TOPOCENTRIC",       // Perspective
  "zodiac_type": "SIDEREAL",          // "TROPIC" or "SIDEREAL"
  "sidereal_mode": "KRISHNAMURTI",    // for sidereal only
  "house_system": "WHOLE_SIGN",       // default Whole Sign ("W")
  "theme": "classic"                  // SVG theme
}
```

All fields are optional thanks to defaults.

---

## Frontend

### `GET /home`

Home page for the Astro App (also reachable from `/` via redirect).  
Contains a small UI that calls `POST /api/svg/natal` to render a natal SVG.

---

## `GET /api/health`

Simple liveness probe.

**Response:**

```json
{
  "status": "ok"
}
```

---

## `POST /api/natal`

Compute a **natal chart configuration**.

- **Request body**: `NatalRequest`
  - `birth`: `BirthData`
  - `config`: `ChartConfig` (optional)
- **Response**: `NatalResponse`
  - `subject`: raw Kerykeion `AstrologicalSubject` as JSON.

---

## `POST /api/svg/natal`

Generate a **natal SVG chart**.

- **Request body**: same as `/api/natal` (`NatalRequest`).
- **Response**: `image/svg+xml` (raw SVG).
- Uses `config.theme` to pick the chart theme.

---

## `POST /api/transit`

Compute a **transit snapshot** at a specific moment.

- **Request body**: `TransitMomentRequest`
  - `moment`: `TransitMomentInput` (no `name`, just date/time/location).
  - `birth` *(optional)*: `BirthData` (natal chart to compare against).
  - `config`: `ChartConfig` (optional).
- **Response**: `TransitResponse`
  - `snapshot`: `TransitSnapshot`
    - `timestamp`: local datetime of snapshot.
    - `subject`: transit subject JSON.
    - `natal_subject` *(optional)*: natal subject JSON (if `birth` provided).

---

## `POST /api/svg/transit`

Generate a **transit SVG chart**.

- **Request body**: same as `/api/transit` (`TransitMomentRequest`).
- **Response**: `image/svg+xml`.
- Behavior:
  - If `birth` is omitted → single-wheel chart of the transit sky.
  - If `birth` is provided → dual-wheel (natal inner, transit outer).
- Theme controlled by `config.theme`.

---

## `POST /api/transit-range`

Compute a **sequence of transit snapshots** between two datetimes.

- **Request body**: `TransitRangeRequest`
  - `moment`: `TransitMomentInput` (start – date/time/location).
  - `end`: `TransitEndInput` (end date/time; location/timezone reused from `moment`).
  - `granularity`: `"minute" | "hour" | "day" | "month"`.
  - `birth` *(optional)*: `BirthData`.
  - `config`: `ChartConfig` (optional).
- **Response**: `TransitRangeResponse`
  - `snapshots`: list of `TransitSnapshot` (same structure as `/api/transit`).

---

## `POST /api/report`

Generate a **plain-text report** via Kerykeion’s `ReportGenerator`.

- **Request body**: `ReportRequest`
  - `kind`: `"SUBJECT"` or `"NATAL"`.
  - `birth`: `BirthData`.
  - `config`: `ChartConfig`.
  - `include_aspects`: `bool` (mainly for `SUBJECT`).
  - `max_aspects`: `int` (mainly for `NATAL`).
- **Response**: `ReportResponse`
  - `kind`: report kind.
  - `text`: ASCII text produced by `print_report()`.

---

## `POST /api/report/pdf`

Generate a **PDF** that embeds the natal chart SVG and appends the report text.

- **Request body**: `ReportRequest`
  - Uses `birth` + `config` to build the natal chart and report.
- **Response**: `application/pdf` (binary).
- Notes:
  - The PDF is generated server-side using the same chart configuration (perspective, zodiac, sidereal mode, house system, theme).
  - Returns an attachment filename `natal-report.pdf`.

## `POST /api/relationship`

Compute **dual-chart aspects** between two subjects.

- **Request body**: `RelationshipRequest`
  - `first`: `BirthData`.
  - `second`: `BirthData`.
  - `config`: `ChartConfig`.
- **Response**: `RelationshipResponse`
  - `first_subject`: first `AstrologicalSubject` JSON.
  - `second_subject`: second `AstrologicalSubject` JSON.
  - `aspects`: Kerykeion `DualChartAspectsModel` serialized to JSON.

---

## `POST /api/svg/synastry`

Generate a **synastry SVG chart**.

- **Request body**: `SynastrySvgRequest`
  - `first`: `BirthData`.
  - `second`: `BirthData`.
  - `config`: `ChartConfig`.
  - `grid_view`: `bool` (if `true`, show aspect grid/table).
- **Response**: `image/svg+xml`.
- Theme controlled by `config.theme`.
