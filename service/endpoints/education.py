from pathlib import Path
import re

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["education"])

REPO_DIR = Path(__file__).resolve().parents[2]
EDU_DIR = REPO_DIR / "docs" / "education"
FILE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-_]*(?:\.md)?$", re.IGNORECASE)


@router.get("/education/{file_id}")
async def get_education_topic(file_id: str) -> dict:
    """
    Load an education markdown file by file id.
    """
    if not FILE_ID_RE.match(file_id):
        raise HTTPException(status_code=400, detail="Invalid file id.")
    filename = file_id if file_id.lower().endswith(".md") else f"{file_id}.md"
    base = EDU_DIR.resolve()
    path = (base / filename).resolve()
    if base not in path.parents and path != base:
        raise HTTPException(status_code=400, detail="Invalid file id.")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Education topic not found.")
    content = path.read_text(encoding="utf-8")
    return {"id": path.stem, "content": content}
