import re
import shutil
import tempfile
from pathlib import Path

from kerykeion.charts.chart_drawer import ChartDrawer  # type: ignore


def render_svg_to_string(drawer: ChartDrawer, filename_prefix: str = "chart") -> str:
    """
    Render the given ChartDrawer to an SVG string.

    Kerykeion currently saves charts to disk, so we use a temporary directory
    internally and read the generated file back as text.
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="kerykeion_api_"))
    try:
        drawer.save_svg(output_path=tmp_dir, filename=filename_prefix)
        svg_path = tmp_dir / f"{filename_prefix}.svg"
        return svg_path.read_text(encoding="utf-8")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def normalize_svg_colors(svg_text: str) -> str:
    """
    Resolve CSS var() references while preserving the original styling and colors.
    We avoid injecting custom styles to keep the chart appearance intact.
    """
    css_vars = dict(re.findall(r"--([\\w-]+)\\s*:\\s*([^;]+);", svg_text))

    def replace_var(match: re.Match[str]) -> str:
        key = match.group(1)
        # match keys with and without leading dashes
        value = css_vars.get(key.lstrip("-")) or css_vars.get(key)
        return value.strip() if value else match.group(0)

    return re.sub(r"var\\((--[-a-zA-Z0-9_]+)\\)", replace_var, svg_text)
