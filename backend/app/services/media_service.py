import json
import uuid
import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from app.config import settings
from app.models import MediaRecord
from app.services.dataset_service import dataset_service, generate_canonical_landmarks

class MediaService:
    def __init__(self):
        self.records_path = settings.MEDIA_RECORDS_FILE
        self._init_storage()

    def _init_storage(self):
        if not self.records_path.exists():
            with open(self.records_path, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2)

    def _read_records(self) -> List[Dict[str, Any]]:
        try:
            with open(self.records_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_records(self, data: List[Dict[str, Any]]):
        with open(self.records_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def save_media_file(
        self,
        file_bytes: bytes,
        filename: str,
        media_type: str,
        sign_language: str,
        sign_label: str,
        description: str,
        signer_id: str,
        consent_confirmed: bool,
        split: str = "train"
    ) -> MediaRecord:
        media_id = f"med-{uuid.uuid4().hex[:8]}"
        extension = Path(filename).suffix or (".png" if media_type == "image" else ".webm")
        saved_filename = f"{media_id}{extension}"
        
        target_dir = settings.IMAGES_DIR if media_type == "image" else settings.VIDEOS_DIR
        target_path = target_dir / saved_filename
        
        with open(target_path, "wb") as f:
            f.write(file_bytes)

        file_url = f"/media/{'images' if media_type == 'image' else 'videos'}/{saved_filename}"

        record_dict = {
            "id": media_id,
            "media_type": media_type,
            "sign_language": sign_language,
            "sign_label": sign_label,
            "description": description or "",
            "signer_id": signer_id,
            "consent_confirmed": consent_confirmed,
            "filename": saved_filename,
            "file_url": file_url,
            "file_size_bytes": len(file_bytes),
            "split": split,
            "created_at": datetime.datetime.utcnow().isoformat()
        }

        records = self._read_records()
        records.insert(0, record_dict)
        self._save_records(records)

        # Log activity
        dataset_service.log_activity(
            f"{'Still Image' if media_type == 'image' else 'Video Clip'} Captured",
            f"Saved {media_type} for '{sign_label}' [{sign_language}] by {signer_id}. Size: {len(file_bytes) // 1024} KB.",
            "capture"
        )

        # Generate corresponding candidate landmark sample for the review queue
        gesture_type = "open_palm"
        if sign_label.lower() in ["yes", "good"]:
            gesture_type = "thumbs_up"
        elif sign_label.lower() in ["peace", "two"]:
            gesture_type = "peace"
        elif sign_label.lower() in ["i love you", "ily"]:
            gesture_type = "ily"
        elif sign_label.lower() in ["no", "fist"]:
            gesture_type = "fist"

        landmarks = generate_canonical_landmarks(gesture_type)
        dataset_service.add_sample(
            label=sign_label,
            landmarks=landmarks,
            split=split,
            notes=f"{media_type.capitalize()} source: {saved_filename} | Signer: {signer_id} | Language: {sign_language}",
            device_info=f"MediaCapture-{media_type.capitalize()}",
            review_status="pending_review",
            quality_score=0.98
        )

        return MediaRecord(**record_dict)

    def list_records(self, label: Optional[str] = None, media_type: Optional[str] = None) -> List[MediaRecord]:
        records = self._read_records()
        if label:
            records = [r for r in records if r.get("sign_label", "").lower() == label.lower()]
        if media_type:
            records = [r for r in records if r.get("media_type", "").lower() == media_type.lower()]
        return [MediaRecord(**r) for r in records]

    def delete_record(self, media_id: str) -> bool:
        records = self._read_records()
        target = next((r for r in records if r["id"] == media_id), None)
        if not target:
            return False

        # Attempt to remove disk file
        try:
            target_dir = settings.IMAGES_DIR if target["media_type"] == "image" else settings.VIDEOS_DIR
            disk_path = target_dir / target["filename"]
            if disk_path.exists():
                disk_path.unlink()
        except Exception:
            pass

        records = [r for r in records if r["id"] != media_id]
        self._save_records(records)
        return True

media_service = MediaService()
