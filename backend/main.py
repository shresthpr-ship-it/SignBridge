import os
import tempfile

os.environ["MPLCONFIGDIR"] = tempfile.gettempdir()

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SignBridge API: High-performance backend for sign language data collection, landmark normalization, and real-time gesture recognition.",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

# Register top-level API routes under /api
app.include_router(api_router, prefix=settings.API_PREFIX)

# Mount local media storage directory
app.mount("/media", StaticFiles(directory=settings.MEDIA_DIR), name="media")

@app.get("/")
def root():
    return {
        "message": "SignBridge Backend Operational",
        "docs": "/docs",
        "version": settings.VERSION
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=False)
