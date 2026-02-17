from __future__ import annotations

import re
from typing import Optional

from service.schemas import HousePlanetsMap, RelationshipHouseProjections, TransitHouseProjections


class HouseProjectionEngine:
    """
    Project source planets into target house cusps.

    Notes:
    - House spans are computed from target cusp starts:
      house N is [cusp_N, cusp_{N+1}) with wrap-around for house 12 -> house 1.
    - Returned lists preserve the configured active_points order.
    """

    PLANET_KEYS = {
        "sun",
        "moon",
        "mercury",
        "venus",
        "mars",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
        "pluto",
        "chiron",
    }

    SIGN_TO_INDEX = {
        "aries": 0,
        "taurus": 1,
        "gemini": 2,
        "cancer": 3,
        "leo": 4,
        "virgo": 5,
        "libra": 6,
        "scorpio": 7,
        "sagittarius": 8,
        "capricorn": 9,
        "aquarius": 10,
        "pisces": 11,
        "ari": 0,
        "tau": 1,
        "gem": 2,
        "can": 3,
        "leo": 4,
        "vir": 5,
        "lib": 6,
        "sco": 7,
        "sag": 8,
        "cap": 9,
        "aqu": 10,
        "pis": 11,
    }

    HOUSE_WORD_TO_NUM = {
        "first": 1,
        "second": 2,
        "third": 3,
        "fourth": 4,
        "fifth": 5,
        "sixth": 6,
        "seventh": 7,
        "eighth": 8,
        "ninth": 9,
        "tenth": 10,
        "eleventh": 11,
        "twelfth": 12,
    }

    @staticmethod
    def _normalize_key(value: str) -> str:
        if not value:
            return ""
        return re.sub(r"[^a-z0-9_]+", "_", str(value).strip().lower()).strip("_")

    @staticmethod
    def _normalize_angle(value) -> Optional[float]:
        try:
            return float(value) % 360.0
        except (TypeError, ValueError):
            return None

    def _extract_abs_pos(self, payload: dict) -> Optional[float]:
        if not isinstance(payload, dict):
            return None
        abs_pos = self._normalize_angle(payload.get("abs_pos"))
        if abs_pos is not None:
            return abs_pos
        sign_raw = payload.get("sign")
        pos = payload.get("position")
        if sign_raw is None:
            return None
        sign_key = self._normalize_key(str(sign_raw))
        sign_idx = self.SIGN_TO_INDEX.get(sign_key)
        pos_val = self._normalize_angle(pos)
        if sign_idx is None or pos_val is None:
            return None
        return ((sign_idx * 30.0) + (pos_val % 30.0)) % 360.0

    def _house_num_from_raw(self, value) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, int) and 1 <= value <= 12:
            return value
        text = self._normalize_key(str(value))
        if not text:
            return None
        digits = re.search(r"(\d+)", text)
        if digits:
            num = int(digits.group(1))
            if 1 <= num <= 12:
                return num
        for word, num in self.HOUSE_WORD_TO_NUM.items():
            if word in text:
                return num
        return None

    def _collect_house_cusps(self, target_subject_dict: dict) -> dict[int, float]:
        cusps: dict[int, float] = {}
        for key, value in (target_subject_dict or {}).items():
            if not isinstance(value, dict):
                continue
            house_num = self._house_num_from_raw(key)
            if house_num is None:
                house_num = self._house_num_from_raw(value.get("name"))
            if house_num is None:
                house_num = self._house_num_from_raw(value.get("house"))
            if house_num is None:
                house_num = self._house_num_from_raw(value.get("house_num"))
            if house_num is None:
                continue
            cusp = self._extract_abs_pos(value)
            if cusp is None:
                continue
            cusps[house_num] = cusp
        return cusps

    def _collect_source_planets(self, source_subject_dict: dict, active_points: list[str]) -> list[tuple[str, float]]:
        points_map: dict[str, dict] = {}
        for key, value in (source_subject_dict or {}).items():
            if not isinstance(value, dict):
                continue
            points_map[self._normalize_key(key)] = value

        output: list[tuple[str, float]] = []
        seen: set[str] = set()
        for point_key in active_points or []:
            norm_key = self._normalize_key(point_key)
            if not norm_key or norm_key in seen or norm_key not in self.PLANET_KEYS:
                continue
            seen.add(norm_key)
            point_payload = points_map.get(norm_key)
            if not isinstance(point_payload, dict):
                continue
            abs_pos = self._extract_abs_pos(point_payload)
            if abs_pos is None:
                continue
            output.append((norm_key, abs_pos))
        return output

    @staticmethod
    def _house_for_angle(angle: float, cusps: dict[int, float]) -> Optional[int]:
        for house_num in range(1, 13):
            start = cusps.get(house_num)
            end = cusps.get(1 if house_num == 12 else house_num + 1)
            if start is None or end is None:
                continue
            span = (end - start) % 360.0
            if span == 0:
                continue
            delta = (angle - start) % 360.0
            if 0 <= delta < span:
                return house_num
        return None

    def project(self, source_subject_dict: dict, target_subject_dict: dict, active_points: list[str]) -> HousePlanetsMap:
        houses: dict[int, list[str]] = {idx: [] for idx in range(1, 13)}
        cusps = self._collect_house_cusps(target_subject_dict)
        if len(cusps) < 12:
            return HousePlanetsMap(houses=houses)

        for point_key, abs_pos in self._collect_source_planets(source_subject_dict, active_points):
            house_num = self._house_for_angle(abs_pos, cusps)
            if house_num is None:
                continue
            houses[house_num].append(point_key)

        return HousePlanetsMap(houses=houses)

    def build_transit_response(
        self,
        transit_subject_dict: dict,
        natal_subject_dict: dict,
        active_points: list[str],
    ) -> TransitHouseProjections:
        return TransitHouseProjections(
            transit_into_natal=self.project(transit_subject_dict, natal_subject_dict, active_points),
        )

    def build_relationship_response(
        self,
        first_subject_dict: dict,
        second_subject_dict: dict,
        active_points: list[str],
    ) -> RelationshipHouseProjections:
        return RelationshipHouseProjections(
            first_into_second=self.project(first_subject_dict, second_subject_dict, active_points),
            second_into_first=self.project(second_subject_dict, first_subject_dict, active_points),
        )
