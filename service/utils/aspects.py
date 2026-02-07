from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional
import re

from kerykeion import AspectsFactory  # type: ignore

from service.schemas import BirthData, ChartConfig
from .config import ensure_config
from .subjects import build_subject


def _label_from_value(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, dict):
        for key in ("name", "point", "planet", "label", "body"):
            if value.get(key):
                return str(value[key]).replace("_", " ")
        if value.get("emoji") and value.get("name"):
            return f"{value['name']} {value['emoji']}".replace("_", " ")
        return str(value)
    if hasattr(value, "__dict__"):
        for key in ("name", "point", "planet", "label", "body"):
            attr = getattr(value, key, None)
            if attr:
                return str(attr).replace("_", " ")
        emoji = getattr(value, "emoji", None)
        name = getattr(value, "name", None)
        if emoji and name:
            return f"{name} {emoji}".replace("_", " ")
    return str(value)


def _entry_mapping(entry) -> Optional[dict]:
    if isinstance(entry, dict):
        return entry
    if hasattr(entry, "model_dump"):
        try:
            return entry.model_dump(mode="json")
        except Exception:
            try:
                return entry.model_dump()
            except Exception:
                return None
    try:
        return vars(entry)
    except TypeError:
        return None


def _get_entry_value(entry, key):
    mapping = _entry_mapping(entry)
    if mapping:
        if key in mapping:
            return mapping.get(key)
        if hasattr(entry, key):
            return getattr(entry, key)
        return None
    if hasattr(entry, key):
        return getattr(entry, key)
    return None


def _iter_entry_items(entry):
    mapping = _entry_mapping(entry)
    if mapping:
        return mapping.items()
    return []


def _extract_aspects_list(aspects_model) -> list:
    for field in ("aspects", "aspects_list", "dual_chart_aspects", "aspect_list"):
        val = getattr(aspects_model, field, None)
        if isinstance(val, list):
            return val
    return []


def _pick_aspect_point(entry, keys: list[str], fallback_tokens: tuple[str, ...]) -> Optional[str]:
    for key in keys:
        value = _get_entry_value(entry, key)
        if value is not None:
            label = _label_from_value(value)
            if label and not str(label).strip().isdigit():
                return label
    for key, val in _iter_entry_items(entry):
        lower = str(key).lower()
        if any(tok in lower for tok in fallback_tokens):
            label = _label_from_value(val)
            if label and not str(label).strip().isdigit():
                return label
    return None


def _pick_aspect_owner(entry, keys: list[str], fallback_tokens: tuple[str, ...]) -> Optional[str]:
    for key in keys:
        value = _get_entry_value(entry, key)
        if value is not None:
            label = _label_from_value(value)
            if label:
                return str(label)
    for key, val in _iter_entry_items(entry):
        lower = str(key).lower()
        if any(tok in lower for tok in fallback_tokens):
            label = _label_from_value(val)
            if label:
                return str(label)
    return None


def _normalize_point_key(value: str) -> str:
    if not value:
        return ""
    raw = str(value)
    raw = re.sub(r"\([^)]*\)", "", raw)
    raw = re.sub(r"[^a-zA-Z0-9_ ]+", " ", raw)
    key = re.sub(r"\s+", "_", raw.strip().lower())
    if not key:
        return ""
    alias = {
        "asc": "ascendant",
        "ascendant": "ascendant",
        "desc": "descendant",
        "descendant": "descendant",
        "mc": "medium_coeli",
        "midheaven": "medium_coeli",
        "ic": "imum_coeli",
        "north_node": "true_north_lunar_node",
        "north_lunar_node": "true_north_lunar_node",
        "south_node": "true_south_lunar_node",
        "south_lunar_node": "true_south_lunar_node",
        "lilith": "mean_lilith",
    }
    return alias.get(key, key)


def _extract_point_key(value, allowed: set[str]) -> Optional[str]:
    label = _label_from_value(value)
    key = _normalize_point_key(label or "")
    if key in allowed:
        return key
    if key:
        for allowed_key in allowed:
            if key.startswith(f"{allowed_key}_") or key.endswith(f"_{allowed_key}") or f"_{allowed_key}_" in key:
                return allowed_key
    if "north" in key and "node" in key and "true_north_lunar_node" in allowed:
        return "true_north_lunar_node"
    if "south" in key and "node" in key and "true_south_lunar_node" in allowed:
        return "true_south_lunar_node"
    return key if key in allowed else None


@dataclass(frozen=True)
class AspectFilter:
    """
    Filter Kerykeion aspect models to only include configured points.

    Kerykeion AspectModel entries typically expose:
    - p1_name / p2_name
    - p1_owner / p2_owner
    - aspect, orbit, aspect_degrees, diff
    - aspect_movement
    """

    active_points: list[str]
    allowed: set[str] = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "allowed",
            {_normalize_point_key(point) for point in self.active_points if point},
        )

    def keep_entry(self, entry) -> bool:
        if not self.allowed:
            return True
        left_keys = [
            "p1_name",
            "first_point",
            "inner_point",
            "planet_a",
            "point_a",
            "point1",
            "planet1",
            "body_a",
            "body1",
            "point_1",
            "p1_point",
            "left",
            "first",
            "inner",
            "p1",
        ]
        right_keys = [
            "p2_name",
            "second_point",
            "outer_point",
            "planet_b",
            "point_b",
            "point2",
            "planet2",
            "body_b",
            "body2",
            "point_2",
            "p2_point",
            "right",
            "second",
            "outer",
            "p2",
        ]
        left_raw = _pick_aspect_point(entry, left_keys, ("first", "inner", "_a", "1"))
        right_raw = _pick_aspect_point(entry, right_keys, ("second", "outer", "_b", "2"))
        if not left_raw and hasattr(entry, "p1_name"):
            left_raw = getattr(entry, "p1_name", None)
        if not right_raw and hasattr(entry, "p2_name"):
            right_raw = getattr(entry, "p2_name", None)
        left_key = _extract_point_key(left_raw, self.allowed)
        right_key = _extract_point_key(right_raw, self.allowed)
        return bool(left_key and right_key)

    def filter_entries(self, entries: list) -> list:
        return [entry for entry in entries if self.keep_entry(entry)]

    def filter_model(self, aspects_model):
        if not self.allowed or aspects_model is None:
            return aspects_model
        fields = ("aspects", "aspects_list", "dual_chart_aspects", "aspect_list", "first_subject", "second_subject")
        updated = aspects_model
        for field in fields:
            if hasattr(updated, field):
                val = getattr(updated, field)
                if isinstance(val, (list, tuple)):
                    filtered = self.filter_entries(list(val))
                    if hasattr(updated, "model_copy"):
                        updated = updated.model_copy(update={field: filtered})
                    else:
                        try:
                            setattr(updated, field, filtered)
                        except Exception:
                            pass
        return updated


def filter_aspects_model(aspects_model, active_points: Optional[list[str]] = None):
    if not active_points:
        return aspects_model
    return AspectFilter(active_points).filter_model(aspects_model)


def compute_normal_aspects(subject, active_points: Optional[list[str]] = None) -> list[dict]:
    """
    Compute standard aspects using Kerykeion's AspectsFactory for a subject model.
    """
    try:
        aspects_model = AspectsFactory.natal_aspects(subject)
        raw_list = _extract_aspects_list(aspects_model)
        # print("[aspects] active points:", active_points)
        # print("[aspects] pre-filter count:", len(raw_list))
        # print("[aspects] pre-filter sample:", raw_list[:3])
        aspects_model = filter_aspects_model(aspects_model, active_points)
        aspects_dump = aspects_model.model_dump(mode="json")
        return extract_aspect_rows(aspects_dump)
    except Exception:
        return []


def extract_aspect_rows(aspects_data: dict, include_owner: bool = False) -> list[dict]:
    """
    Normalize dual/synastry aspect entries into a lightweight table.
    """
    def format_label(owner: Optional[str], point: Optional[str], fallback: str) -> str:
        point_label = point or fallback
        if not owner:
            return point_label
        owner_label = str(owner).strip()
        if not owner_label:
            return point_label
        if owner_label.lower() in str(point_label).lower():
            return point_label
        return f"{point_label} ({owner_label})"

    def pick_orb(entry: dict) -> tuple[Optional[str], Optional[float]]:
        for key in ("orb", "difference", "orb_value", "orb_value_deg", "orb_deg", "orbit", "diff"):
            if key in entry and entry[key] is not None:
                val = entry[key]
                if isinstance(val, (int, float)):
                    return f"{val:.2f}°", float(val)
                try:
                    num = float(val)
                    return f"{num:.2f}°", num
                except Exception:
                    return str(val), None
        return None, None

    candidates: list = []
    if isinstance(aspects_data, list):
        candidates = aspects_data
    else:
        for key in ("aspects", "aspects_list", "dual_chart_aspects", "aspect_list"):
            val = aspects_data.get(key) if isinstance(aspects_data, dict) else None
            if isinstance(val, list):
                candidates = val
                break

    rows: list[dict] = []
    for entry in candidates:
        if not isinstance(entry, dict):
            entry_map = _entry_mapping(entry)
            if not entry_map:
                rows.append({"summary": str(entry)})
                continue
            entry = entry_map
        left = _pick_aspect_point(
            entry,
            [
                "p1_name",
                "first_point",
                "inner_point",
                "planet_a",
                "point_a",
                "point1",
                "planet1",
                "body_a",
                "body1",
                "point_1",
                "p1_point",
                "left",
                "first",
                "inner",
                "p1",
            ],
            ("first", "inner", "_a", "1"),
        )
        right = _pick_aspect_point(
            entry,
            [
                "p2_name",
                "second_point",
                "outer_point",
                "planet_b",
                "point_b",
                "point2",
                "planet2",
                "body_b",
                "body2",
                "point_2",
                "p2_point",
                "right",
                "second",
                "outer",
                "p2",
            ],
            ("second", "outer", "_b", "2"),
        )
        left_owner = None
        right_owner = None
        if include_owner:
            left_owner = _pick_aspect_owner(
                entry,
                [
                    "p1_owner",
                    "first_owner",
                    "inner_owner",
                    "owner_a",
                    "owner1",
                    "first_subject",
                    "inner_subject",
                    "p1_subject",
                    "left_owner",
                ],
                ("first", "inner", "_a", "1", "p1"),
            )
            right_owner = _pick_aspect_owner(
                entry,
                [
                    "p2_owner",
                    "second_owner",
                    "outer_owner",
                    "owner_b",
                    "owner2",
                    "second_subject",
                    "outer_subject",
                    "p2_subject",
                    "right_owner",
                ],
                ("second", "outer", "_b", "2", "p2"),
            )
        aspect_name = (
            entry.get("aspect")
            or entry.get("aspect_type")
            or entry.get("angle")
            or entry.get("name")
            or entry.get("aspect_name")
        )
        orb_str, orb_value = pick_orb(entry)
        movement = entry.get("aspect_movement") or entry.get("movement") or entry.get("direction")
        rows.append(
            {
                "left": format_label(left_owner, left, "Point A"),
                "aspect": aspect_name or "Aspect",
                "right": format_label(right_owner, right, "Point B"),
                "orb": orb_str,
                "orb_value": orb_value,
                "movement": movement,
                "raw": entry,
            }
        )
    def sort_key(item: dict, idx: int) -> tuple[int, float, int]:
        orb_val = item.get("orb_value")
        if isinstance(orb_val, (int, float)):
            return (0, abs(float(orb_val)), idx)
        return (1, 9999.0, idx)

    return [row for _, row in sorted(enumerate(rows), key=lambda pair: sort_key(pair[1], pair[0]))]


def compute_dual_chart_aspects(
    first: BirthData,
    second: BirthData,
    config: Optional[ChartConfig],
):
    """
    Convenience wrapper for Kerykeion AspectsFactory.dual_chart_aspects().

    Returns a tuple: (first_subject, second_subject, aspects_model).
    """
    cfg = ensure_config(config)
    first_subject = build_subject(first, cfg)
    second_subject = build_subject(second, cfg)
    aspects_model = AspectsFactory.dual_chart_aspects(first_subject, second_subject)
    aspects_model = filter_aspects_model(aspects_model, cfg.active_points)
    return first_subject, second_subject, aspects_model
