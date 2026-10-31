from fastapi import APIRouter
from .system import router as system_router
from .dataset import router as dataset_router
from .recognition import router as recognition_router
from .vision import router as vision_router
from .media import router as media_router

api_router = APIRouter()
api_router.include_router(system_router)
api_router.include_router(dataset_router)
api_router.include_router(recognition_router)
api_router.include_router(vision_router)
api_router.include_router(media_router)

__all__ = ["api_router"]
