from __future__ import annotations

from typing import Optional

from kerykeion import AspectsFactory  # type: ignore

from service.enums import Mode
from service.schemas import BirthData, ReportRequest
from .aspects import extract_aspect_rows, filter_aspects_model
from .config import ensure_config, resolve_mode
from .subjects import build_subject_block


def render_markdown_report(structured: dict) -> str:
    """
    Render a Markdown-flavored view of the structured report.
    """
    lines: list[str] = []
    title = structured.get("title") or "Astrology Report"
    summary = structured.get("summary")
    lines.append(f"# {title}")
    if summary:
        lines.append("")
        lines.append(summary)

    for subject in structured.get("subjects", []):
        meta = subject.get("meta", {})
        lines.append("")
        lines.append(f"## {subject.get('label')}: {meta.get('name', 'Chart')}")
        meta_bits = []
        if meta.get("local_datetime"):
            meta_bits.append(f"**Date & time:** {meta['local_datetime']} ({meta.get('tz', '')})")
        if meta.get("location"):
            meta_bits.append(f"**Location:** {meta['location']}")
        if meta.get("zodiac_type"):
            zodiac = meta["zodiac_type"]
            if meta.get("sidereal_mode"):
                zodiac = f"{zodiac} - {meta['sidereal_mode']}"
            meta_bits.append(f"**Zodiac:** {zodiac}")
        if meta.get("house_system"):
            meta_bits.append(f"**Houses:** {meta['house_system']}")
        if meta_bits:
            for bit in meta_bits:
                lines.append(f"- {bit}")
        lunar = subject.get("lunar_phase")
        if isinstance(lunar, dict) and lunar.get("moon_phase_name"):
            lines.append(
                f"- **Lunar phase:** {lunar.get('moon_phase_name')} {lunar.get('moon_emoji', '')}".rstrip()
            )

        points = subject.get("points", [])
        if points:
            lines.append("")
            lines.append("### Planetary positions")
            lines.append("| Body | Sign | Degree | House | Rx |")
            lines.append("| --- | --- | --- | --- | --- |")
            for row in points:
                rx = "R" if row.get("retrograde") else ""
                lines.append(
                    f"| {row.get('name','')} | {row.get('sign','')} | {row.get('degree','')} | {row.get('house','')} | {rx} |"
                )

        houses = subject.get("houses", [])
        if houses:
            lines.append("")
            lines.append("### Houses")
            lines.append("| House | Sign | Degree |")
            lines.append("| --- | --- | --- |")
            for row in houses:
                lines.append(f"| {row.get('name','')} | {row.get('sign','')} | {row.get('degree','')} |")

        aspects = subject.get("aspects", {})
        aspect_rows = aspects.get("rows") or []
        if aspect_rows:
            lines.append("")
            lines.append("### Aspects")
            summary_data = aspects.get("summary") or {}
            if summary_data:
                lines.append(
                    f"Total: {summary_data.get('total', 0)} "
                    f"(Applying: {summary_data.get('applying', 0)}, Separating: {summary_data.get('separating', 0)}, Fixed: {summary_data.get('fixed', 0)})"
                )
            lines.append("| Inner | Aspect | Outer | Orb | Movement |")
            lines.append("| --- | --- | --- | --- | --- |")
            for row in aspect_rows:
                lines.append(
                    f"| {row.get('left','')} | {row.get('aspect','')} | {row.get('right','')} | {row.get('orb','')} | {row.get('movement','')} |"
                )

    synastry = structured.get("synastry")
    if synastry and synastry.get("rows"):
        lines.append("")
        lines.append("## Synastry")
        if synastry.get("title"):
            lines.append(synastry["title"])
        summary_data = synastry.get("summary") or {}
        if summary_data:
            lines.append("")
            lines.append(
                f"Total: {summary_data.get('total', 0)} "
                f"(Applying: {summary_data.get('applying', 0)}, "
                f"Separating: {summary_data.get('separating', 0)}, "
                f"Fixed: {summary_data.get('fixed', 0)})"
            )
        tightest = summary_data.get("tightest") or []
        if tightest:
            lines.append("")
            lines.append("Tightest aspects:")
            for row in tightest:
                orb = row.get("orb") or ""
                movement = row.get("movement") or ""
                movement = f", {movement}" if movement else ""
                left = row.get("left", "")
                right = row.get("right", "")
                aspect = row.get("aspect", "aspect")
                lines.append(f"- {left} in {aspect} with {right} (orb {orb}{movement})")
        lines.append("| Inner | Aspect | Outer | Orb | Movement |")
        lines.append("| --- | --- | --- | --- | --- |")
        for row in synastry.get("rows", []):
            lines.append(
                f"| {row.get('left','')} | {row.get('aspect','')} | {row.get('right','')} | {row.get('orb','')} | {row.get('movement','')} |"
            )

    return "\n".join(lines).strip()


class ReportBuilder:
    def __init__(self, request: ReportRequest) -> None:
        self.request = request
        self.cfg = ensure_config(request.config)
        self.mode = resolve_mode(request)

    def _build_synastry_summary(self, rows: list[dict]) -> dict:
        if not rows:
            return {}
        applying = sum(1 for r in rows if str(r.get("movement", "")).lower().startswith("app"))
        separating = sum(1 for r in rows if str(r.get("movement", "")).lower().startswith("sep"))
        fixed = sum(1 for r in rows if str(r.get("movement", "")).lower().startswith("fix"))

        def orb_key(row: dict) -> float:
            val = row.get("orb_value")
            if isinstance(val, (int, float)):
                return abs(val)
            try:
                s = str(row.get("orb", "")).replace("°", "").strip()
                return abs(float(s))
            except Exception:
                return 9999.0

        closest = sorted(rows, key=orb_key)[:5]
        tightest = [r for r in rows if isinstance(r.get("orb_value"), (int, float)) and abs(r["orb_value"]) < 1.0]
        tightest = sorted(tightest, key=orb_key)
        return {
            "total": len(rows),
            "applying": applying,
            "separating": separating,
            "fixed": fixed,
            "closest": [
                {k: v for k, v in item.items() if k in {"left", "right", "aspect", "orb", "movement"}}
                for item in closest
            ],
            "tightest": [
                {k: v for k, v in item.items() if k in {"left", "right", "aspect", "orb", "movement", "orb_value"}}
                for item in tightest
            ],
        }

    def generate(self) -> tuple[dict, str]:
        structured: dict = {
            "mode": self.mode.value,
            "kind": self.request.kind.value,
            "config": self.cfg.model_dump(mode="json"),
            "subjects": [],
        }

        def _aspect_entries_count(model) -> int:
            for field in ("aspects", "aspects_list", "dual_chart_aspects", "aspect_list"):
                val = getattr(model, field, None)
                if isinstance(val, list):
                    return len(val)
            return 0

        def add_subject(birth: BirthData, label: str) -> tuple[dict, object]:
            block, subject = build_subject_block(birth, self.cfg, label)
            if self.request.include_aspects:
                try:
                    aspects_model = AspectsFactory.natal_aspects(subject)
                    # print(f"[report] {label} aspects pre-filter:", _aspect_entries_count(aspects_model))
                    # print(f"[report] {label} active points:", self.cfg.active_points)
                    aspects_model = filter_aspects_model(aspects_model, self.cfg.active_points)
                    # print(f"[report] {label} aspects post-filter:", _aspect_entries_count(aspects_model))
                    aspects_dump = aspects_model.model_dump(mode="json")
                    aspect_rows = extract_aspect_rows(aspects_dump)
                    # print(f"[report] {label} aspect rows:", len(aspect_rows))
                    if self.request.max_aspects:
                        aspect_rows = aspect_rows[: self.request.max_aspects]
                    block["aspects"] = {
                        "title": f"{label} aspects",
                        "rows": aspect_rows,
                        "summary": self._build_synastry_summary(aspect_rows),
                        "raw": aspects_dump,
                    }
                except Exception:
                    block["aspects"] = {"rows": [], "summary": {}}
            structured["subjects"].append(block)
            return block, subject

        if self.mode == Mode.RELATIONSHIP and self.request.first and self.request.second:
            first_block, first_subject = add_subject(self.request.first, "Partner A")
            second_block, second_subject = add_subject(self.request.second, "Partner B")
            structured["title"] = (
                f"Synastry report - {first_block['meta']['name']} natal + {second_block['meta']['name']} natal"
            )
            structured["summary"] = "Dual-wheel synastry overview with shared aspects."

            aspects_model = AspectsFactory.dual_chart_aspects(first_subject, second_subject)
            # print("[report] Synastry aspects pre-filter:", _aspect_entries_count(aspects_model))
            aspects_model = filter_aspects_model(aspects_model, self.cfg.active_points)
            # print("[report] Synastry aspects post-filter:", _aspect_entries_count(aspects_model))
            aspects_dump = aspects_model.model_dump(mode="json")
            aspect_rows = extract_aspect_rows(aspects_dump, include_owner=True)
            # print("[report] Synastry aspect rows:", len(aspect_rows))
            if not self.request.include_aspects:
                aspect_rows = []
            elif self.request.max_aspects:
                aspect_rows = aspect_rows[: self.request.max_aspects]
            structured["synastry"] = {
                "title": f"{first_block['meta']['name']} <-> {second_block['meta']['name']}",
                "rows": aspect_rows,
                "summary": self._build_synastry_summary(aspect_rows),
                "raw": aspects_dump,
            }
        elif self.mode == Mode.NATAL_TRANSIT and self.request.birth and self.request.moment:
            natal_block, natal_subject = add_subject(self.request.birth, "Natal")
            m = self.request.moment
            transit_birth = BirthData(
                name=getattr(m, "name", None) or "Transit moment",
                year=m.year,
                month=m.month,
                day=m.day,
                hour=m.hour,
                minute=m.minute,
                lat=m.lat,
                lng=m.lng,
                tz_str=m.tz_str,
                city=m.city,
                nation=m.nation,
            )
            transit_block, transit_subject = add_subject(transit_birth, "Transit")
            structured["title"] = f"Dual-wheel report - {natal_block['meta']['name']} natal + transit"
            structured["summary"] = "Natal chart paired with a transit snapshot."

            try:
                aspects_model = AspectsFactory.dual_chart_aspects(natal_subject, transit_subject)
                # print("[report] Transit synastry pre-filter:", _aspect_entries_count(aspects_model))
                aspects_model = filter_aspects_model(aspects_model, self.cfg.active_points)
                # print("[report] Transit synastry post-filter:", _aspect_entries_count(aspects_model))
                aspects_dump = aspects_model.model_dump(mode="json")
                aspect_rows = extract_aspect_rows(aspects_dump, include_owner=True)
                # print("[report] Transit synastry aspect rows:", len(aspect_rows))
                if not self.request.include_aspects:
                    aspect_rows = []
                elif self.request.max_aspects:
                    aspect_rows = aspect_rows[: self.request.max_aspects]
                structured["synastry"] = {
                    "title": f"{natal_block['meta']['name']} <-> Transit",
                    "rows": aspect_rows,
                    "summary": self._build_synastry_summary(aspect_rows),
                    "raw": aspects_dump,
                }
            except Exception:
                pass
        elif self.mode == Mode.TRANSIT and self.request.moment:
            m = self.request.moment
            transit_birth = BirthData(
                name=getattr(m, "name", None) or "Transit snapshot",
                year=m.year,
                month=m.month,
                day=m.day,
                hour=m.hour,
                minute=m.minute,
                lat=m.lat,
                lng=m.lng,
                tz_str=m.tz_str,
                city=m.city,
                nation=m.nation,
            )
            add_subject(transit_birth, "Transit")
            structured["title"] = "Transit report"
            structured["summary"] = "Current sky positions without natal overlay."
        else:
            add_subject(self.request.birth, "Natal")
            structured["title"] = f"Natal report - {self.request.birth.name}"
            structured["summary"] = "Full natal positions with houses and angles."

        markdown = render_markdown_report(structured)
        structured["markdown"] = markdown
        return structured, markdown


def generate_report_content(request: ReportRequest) -> tuple[dict, str]:
    """
    Build a structured report plus a Markdown representation.
    """
    builder = ReportBuilder(request)
    return builder.generate()


def generate_report_text(request: ReportRequest) -> str:
    """
    Backwards-compatible wrapper that returns only the Markdown report text.
    """
    _, markdown = generate_report_content(request)
    return markdown
