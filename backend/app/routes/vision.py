from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from typing import Optional
from pathlib import Path

from app.models import ExtractionResult
from app.services.vision_pipeline import vision_pipeline

router = APIRouter(prefix="/vision", tags=["Computer Vision Pipeline"])

SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
SUPPORTED_VIDEO_EXTS = {".mp4", ".webm", ".mov", ".avi", ".mkv"}
MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB
MAX_VIDEO_SIZE_BYTES = 60 * 1024 * 1024  # 60 MB

@router.get("/status")
def vision_status():
    return vision_pipeline.get_engine_status()

@router.post("/extract-image", response_model=ExtractionResult)
async def extract_image_landmarks(
    file: UploadFile = File(..., description="Uploaded image file containing sign gesture"),
    target_language: str = Form("ASL", description="Target sign language system"),
    sign_label: Optional[str] = Form(None, description="Optional sign label name"),
):
    filename = file.filename or "image.png"
    ext = Path(filename).suffix.lower()

    if ext not in SUPPORTED_IMAGE_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_IMAGE_EXTS))}"
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")

    if len(file_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image size exceeds 15 MB limit. Provided: {len(file_bytes) // (1024 * 1024)} MB."
        )

    try:
        result = vision_pipeline.process_image(
            image_bytes=file_bytes,
            filename=filename,
            target_language=target_language.strip(),
            sign_label=sign_label.strip() if sign_label else None
        )
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(exc)}")

@router.post("/extract-video", response_model=ExtractionResult)
async def extract_video_landmarks(
    file: UploadFile = File(..., description="Uploaded video sequence containing sign language gesture"),
    target_language: str = Form("ASL", description="Target sign language system"),
    sign_label: Optional[str] = Form(None, description="Optional sign label name"),
    max_frames: int = Form(60, ge=1, le=150, description="Maximum frames to process"),
    sample_fps: int = Form(6, ge=1, le=30, description="Frame sampling rate per second"),
):
    filename = file.filename or "sequence.mp4"
    ext = Path(filename).suffix.lower()

    if ext not in SUPPORTED_VIDEO_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_VIDEO_EXTS))}"
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded video file is empty.")

    if len(file_bytes) > MAX_VIDEO_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Video size exceeds 60 MB limit. Provided: {len(file_bytes) // (1024 * 1024)} MB."
        )

    try:
        result = vision_pipeline.process_video(
            video_bytes=file_bytes,
            filename=filename,
            target_language=target_language.strip(),
            sign_label=sign_label.strip() if sign_label else None,
            max_frames=max_frames,
            sample_fps=sample_fps
        )
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Video processing error: {str(exc)}")
