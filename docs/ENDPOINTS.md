# Astro API – Endpoint Reference

This file summarizes the available endpoints and their main request/response
shapes. For precise field definitions, refer to the Swagger UI (`/docs`) or
`schemas.py`.

All JSON / SVG endpoints are mounted under the `/api` prefix.

---

## Major aspect configurations

Responses can include detected Ptolemaic multi-planet patterns (`major_aspects`, `natal_major_aspects`). Shapes, orb guides, and construction notes are documented in [`docs/ptolemaic-aspects-description.md`](./ptolemaic-aspects-description.md).

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

### Range add-ons (Ascendant, Moon, Sun)

- Set `ascMoonSunRangeEnabled: true` on natal or transit requests to include `ascendantDayRange`, `moonMonthRange`, and `sunYearRange` in the response.
- Ascendant ranges cover a +/-12h window (hourly granularity). Moon ranges sweep ~1 month. Sun ranges sweep ~1 year with minute-level ingress timestamps.
- Dual modes return both ranges (e.g., natal + transit or both partners). Entries include start/end, sign, element, quality, decan, and orb (where relevant).

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
  - `ascMoonSunRangeEnabled` *(optional, default false)*: include `ascendantDayRange`, `moonMonthRange`, and `sunYearRange`.
- **Response**: `NatalResponse`
  - `subject`: raw Kerykeion `AstrologicalSubject` as JSON.
  - `aspects`: point-to-point aspect list.
  - `major_aspects`: Ptolemaic pattern matches (see [major aspect docs](./ptolemaic-aspects-description.md)).
  - `ascendantDayRange` *(optional)*: +/-12h ascendant distribution when requested.
  - `moonMonthRange` *(optional)*: month-long Moon sweep when requested.
  - `sunYearRange` *(optional)*: year-long Sun ingress sweep when requested.

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
  - `ascMoonSunRangeEnabled` *(optional, default false)*: include ascendant, Moon, and Sun sweeps.
- **Response**: `TransitResponse`
  - `snapshot`: `TransitSnapshot`
    - `timestamp`: local datetime of snapshot.
    - `subject`: transit subject JSON.
    - `natal_subject` *(optional)*: natal subject JSON (if `birth` provided).
    - `aspects`: point-to-point aspects for the transit sky.
    - `major_aspects`: Ptolemaic patterns found in the transit sky.
    - `natal_aspects` *(optional)*: aspects for the provided natal chart.
    - `natal_major_aspects` *(optional)*: Ptolemaic patterns for the natal chart.
  - `ascendantDayRange`, `moonMonthRange`, `sunYearRange` *(optional)*: returned at the response root when enabled (not inside `snapshot` to avoid duplication).

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
  - `ascMoonSunRangeEnabled` *(optional, default false)*: include ascendant, Moon, and Sun sweeps around the start moment.
- **Response**: `TransitRangeResponse`
  - `snapshots`: list of transit-only snapshots (timestamp, subject, aspects, and major aspects).

---

## `POST /api/report`

Generate a **structured report** via Kerykeion (Markdown text + raw data).

- **Request body**: `ReportRequest`
  - `kind`: `"SUBJECT"` or `"NATAL"`.
  - `birth`: `BirthData`.
  - `config`: `ChartConfig`.
  - `include_aspects`: `bool` (mainly for `SUBJECT`).
  - `max_aspects`: `int` (mainly for `NATAL`).
- **Response**: `ReportResponse`
  - `kind`: report kind.
  - `text`: Markdown-formatted report body (ready to display in the app).
  - `structured`: Structured report data (subjects, houses, aspects) for PDF rendering.

---

## `POST /api/report/pdf`

Generate a **PDF** version of the structured report (no chart).

- **Request body**: `ReportRequest`
  - Uses `birth` + `config` (and optional dual inputs) to build the report.
- **Response**: `application/pdf` (binary).
- Notes:
  - The PDF is generated server-side from the structured report sections (planets, houses, synastry aspects).
  - Returns an attachment filename `<mode>-report.pdf`.

## `POST /api/relationship`

Compute **dual-chart aspects** between two subjects.

- **Request body**: `RelationshipRequest`
  - `first`: `BirthData`.
  - `second`: `BirthData`.
  - `config`: `ChartConfig`.
  - `ascMoonSunRangeEnabled` *(optional, default false)*: include ascendant, Moon, and Sun sweeps for both partners.
- **Response**: `RelationshipResponse`
  - `first_subject`: first `AstrologicalSubject` JSON.
  - `second_subject`: second `AstrologicalSubject` JSON.
  - `aspects`: Kerykeion `DualChartAspectsModel` serialized to JSON.
  - `ascendantDayRange`, `moonMonthRange`, `sunYearRange` *(optional)*: sweeps for `first` and `second` when requested.

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
