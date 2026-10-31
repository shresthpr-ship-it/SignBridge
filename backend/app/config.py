import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "app" / "data"
SAMPLES_DIR = DATA_DIR / "samples"

MEDIA_DIR = DATA_DIR / "media"
IMAGES_DIR = MEDIA_DIR / "images"
VIDEOS_DIR = MEDIA_DIR / "videos"

DATA_DIR.mkdir(parents=True, exist_ok=True)
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

class Settings:
    PROJECT_NAME: str = "SignBridge API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ]
    DATA_DIR: Path = DATA_DIR
    MEDIA_DIR: Path = MEDIA_DIR
    IMAGES_DIR: Path = IMAGES_DIR
    VIDEOS_DIR: Path = VIDEOS_DIR
    DATASET_FILE: Path = DATA_DIR / "dataset.json"
    CLASSES_FILE: Path = DATA_DIR / "classes.json"
    ACTIVITY_FILE: Path = DATA_DIR / "activity.json"
    MEDIA_RECORDS_FILE: Path = DATA_DIR / "media_records.json"

settings = Settings()
