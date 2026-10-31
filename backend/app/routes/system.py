from fastapi import APIRouter
from app.config import settings
from app.models import SystemInfo
from app.services.landmark_extractor import vision_service
from app.services.dataset_service import dataset_service

router = APIRouter(prefix="", tags=["System"])

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }

@router.get("/system/info", response_model=SystemInfo)
def system_info():
    v_status = vision_service.get_status()
    samples = dataset_service.get_samples()
    classes = dataset_service.get_classes()

    return SystemInfo(
        status="operational",
        version=settings.VERSION,
        backend_engine=v_status["engine"],
        mediapipe_available=v_status["mediapipe_available"],
        samples_count=len(samples),
        classes_count=len(classes),
    )
