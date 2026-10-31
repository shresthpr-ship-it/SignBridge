from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from typing import List, Optional
from app.models import MediaRecord
from app.services.media_service import media_service

router = APIRouter(prefix="/media", tags=["Media Capture"])

@router.post("/upload", response_model=MediaRecord)
async def upload_media_sample(
    file: UploadFile = File(...),
    media_type: str = Form(..., description="'image' or 'video'"),
    sign_language: str = Form(..., description="Target sign language (e.g. ASL, BSL, ISL)"),
    sign_label: str = Form(..., description="Target sign gesture label"),
    description: Optional[str] = Form("", description="Optional sign context or description"),
    signer_id: str = Form(..., description="Anonymous signer identifier (e.g. signer_01)"),
    consent_confirmed: bool = Form(..., description="Consent confirmation boolean"),
    split: str = Form("train", description="Dataset split: train, val, or test"),
):
    if not consent_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Participant consent must be confirmed before saving sign language media."
        )

    if media_type not in ["image", "video"]:
        raise HTTPException(status_code=400, detail="media_type must be 'image' or 'video'")

    if not sign_label.strip():
        raise HTTPException(status_code=400, detail="sign_label cannot be empty")

    if not signer_id.strip():
        raise HTTPException(status_code=400, detail="signer_id cannot be empty")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    record = media_service.save_media_file(
        file_bytes=file_bytes,
        filename=file.filename or f"capture.{'png' if media_type == 'image' else 'webm'}",
        media_type=media_type,
        sign_language=sign_language.strip(),
        sign_label=sign_label.strip(),
        description=description.strip() if description else "",
        signer_id=signer_id.strip(),
        consent_confirmed=consent_confirmed,
        split=split if split in ["train", "val", "test"] else "train"
    )

    return record

@router.get("", response_model=List[MediaRecord])
def list_media_records(
    label: Optional[str] = Query(None, description="Filter by sign label"),
    media_type: Optional[str] = Query(None, description="Filter by media type ('image' or 'video')"),
):
    return media_service.list_records(label=label, media_type=media_type)

@router.delete("/{media_id}")
def delete_media_record(media_id: str):
    success = media_service.delete_record(media_id)
    if not success:
        raise HTTPException(status_code=404, detail="Media record not found")
    return {"status": "success", "deleted_id": media_id}
