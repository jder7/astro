import unittest

from service.schemas import BirthData, ChartConfig, ReportRequest, TransitMomentInput
from service.utils import generate_report_content


class TestReportAspects(unittest.TestCase):
    def _assert_subject_aspects(self, structured: dict, label: str):
        subjects = structured.get("subjects", [])
        self.assertTrue(subjects, f"Report should include {label} subject blocks.")
        aspects = subjects[0].get("aspects", {})
        self.assertIn("rows", aspects, f"{label} report should include aspect rows.")
        self.assertNotEqual(aspects["rows"], [], f"{label} report aspects should not be empty.")

    def _base_config(self) -> ChartConfig:
        return ChartConfig(active_points=["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"])

    def _base_birth(self, name: str) -> BirthData:
        return BirthData(
            name=name,
            year=1990,
            month=1,
            day=1,
            hour=12,
            minute=0,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
            city="Amsterdam",
            nation="NL",
        )

    def test_report_aspects_natal_mode(self):
        request = ReportRequest(
            birth=self._base_birth("Natal Subject"),
            config=self._base_config(),
            include_aspects=True,
            max_aspects=50,
        )
        structured, _ = generate_report_content(request)
        self._assert_subject_aspects(structured, "natal")

    def test_report_aspects_transit_mode(self):
        moment = TransitMomentInput(
            year=2025,
            month=11,
            day=27,
            hour=12,
            minute=0,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
            city="Amsterdam",
            nation="NL",
        )
        request = ReportRequest(
            moment=moment,
            config=self._base_config(),
            include_aspects=True,
            max_aspects=50,
        )
        structured, _ = generate_report_content(request)
        self._assert_subject_aspects(structured, "transit")

    def test_report_aspects_natal_transit_mode(self):
        moment = TransitMomentInput(
            year=2025,
            month=11,
            day=27,
            hour=12,
            minute=0,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
            city="Amsterdam",
            nation="NL",
        )
        request = ReportRequest(
            birth=self._base_birth("Natal Subject"),
            moment=moment,
            config=self._base_config(),
            include_aspects=True,
            max_aspects=50,
        )
        structured, _ = generate_report_content(request)
        self._assert_subject_aspects(structured, "natal+transit")
        synastry = structured.get("synastry", {})
        self.assertIn("rows", synastry, "Natal+transit report should include synastry rows.")

    def test_report_aspects_relationship_mode(self):
        first = self._base_birth("Partner A")
        second = BirthData(
            name="Partner B",
            year=1995,
            month=6,
            day=15,
            hour=18,
            minute=30,
            lng=4.8952,
            lat=52.3702,
            tz_str="Europe/Amsterdam",
            city="Amsterdam",
            nation="NL",
        )
        request = ReportRequest(
            first=first,
            second=second,
            config=self._base_config(),
            include_aspects=True,
            max_aspects=50,
        )
        structured, _ = generate_report_content(request)
        self._assert_subject_aspects(structured, "relationship")
        synastry = structured.get("synastry", {})
        self.assertIn("rows", synastry, "Relationship report should include synastry rows.")


if __name__ == "__main__":
    unittest.main()
