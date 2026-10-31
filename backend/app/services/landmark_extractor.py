import math
from typing import List, Optional, Tuple, Dict, Any
from app.models import LandmarkPoint

# Try importing mediapipe and cv2 if present
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    np = None

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False


def normalize_landmarks(landmarks: List[LandmarkPoint]) -> List[float]:
    """
    Translates landmark points relative to wrist (landmark 0)
    and scale-normalizes by the distance between wrist and middle MCP (landmark 9).
    Returns a 63-dimensional feature vector [x0, y0, z0, ..., x20, y20, z20].
    """
    if not landmarks or len(landmarks) < 21:
        # Fallback padding to 63 zeros if insufficient points
        return [0.0] * 63

    # Anchor at wrist (point 0)
    origin_x = landmarks[0].x
    origin_y = landmarks[0].y
    origin_z = landmarks[0].z

    # Distance to middle finger knuckle (point 9) for scale normalization
    mid_mcp = landmarks[9]
    dx = mid_mcp.x - origin_x
    dy = mid_mcp.y - origin_y
    dz = mid_mcp.z - origin_z
    scale = math.sqrt(dx * dx + dy * dy + dz * dz)
    if scale < 1e-4:
        scale = 1.0

    features = []
    for lm in landmarks[:21]:
        features.append((lm.x - origin_x) / scale)
        features.append((lm.y - origin_y) / scale)
        features.append((lm.z - origin_z) / scale)

    return features


class VisionService:
    def __init__(self):
        self.mediapipe_available = MEDIAPIPE_AVAILABLE
        self.cv2_available = CV2_AVAILABLE

    def get_status(self) -> Dict[str, Any]:
        return {
            "mediapipe_available": self.mediapipe_available,
            "cv2_available": self.cv2_available,
            "engine": f"MediaPipe Tasks Vision v{mp.__version__}" if self.mediapipe_available else "Geometry-Assisted Math Engine"
        }


vision_service = VisionService()
