"""
SignBridge Sentence Mode API Router.
Handles complete recorded video upload, chronological sequence processing,
sentence generation, and session history retrieval.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query

from app.services.sentence_mode_service import sentence_mode_service, SentenceModeProcessingResult
from app.services.recognition_service import recognition_service

router = APIRouter(prefix="/sentence-mode", tags=["Sentence Mode"])

MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB limit


@router.get("/status")
def get_sentence_mode_status():
    """
    Returns pipeline readiness, supported formats, and active recognition model metadata for Sentence Mode.
    """
    model_status = recognition_service.get_model_status()
    return {
        "status": "operational",
        "supported_video_formats": [".webm", ".mp4", ".mov", ".avi", ".mkv"],
        "max_file_size_mb": 100,
        "default_language": "ISL",
        "supported_languages": ["ISL", "ASL", "BSL"],
        "model_status": model_status,
        "recommended_recording_duration_s": "2 - 15 seconds",
    }


@router.get("/history")
def get_sentence_history():
    """
    Retrieves previous sentence recordings, generated text, and model outputs.
    """
    return sentence_mode_service.get_sessions()


@router.post("/translate", response_model=SentenceModeProcessingResult)
async def translate_recorded_sentence(
    file: UploadFile = File(..., description="Recorded sign language video clip"),
    target_language: str = Form("ISL", description="Target sign language (e.g. ISL, ASL)"),
):
    """
    Submits a completed sign language video recording for chronological landmark extraction,
    temporal gesture segmentation, and sentence-level linguistic translation.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")

    file_bytes = await file.read()
    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded recorded video is empty. Please retake recording.")

    if len(file_bytes) > MAX_VIDEO_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Video size ({len(file_bytes) / (1024*1024):.1f} MB) exceeds maximum allowed limit of 100 MB."
        )

    try:
        result = sentence_mode_service.process_sentence_video(
            video_bytes=file_bytes,
            original_filename=file.filename,
            target_language=target_language.strip().upper()
        )
        return result
    except Exception as e:
        print(f"[SentenceModeRouter] Translation error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing recorded video sequence: {str(e)}"
        )
