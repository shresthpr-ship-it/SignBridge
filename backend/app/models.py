from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float = 0.0
    visibility: Optional[float] = 1.0

class SignClass(BaseModel):
    id: str
    name: str
    language: str = "ASL"
    category: str = "General"  # e.g., "Greetings", "Alphabet", "Emergency", "Conversational"
    description: str = ""
    sample_count: int = 0
    created_at: Optional[str] = None

class CreateSignClassRequest(BaseModel):
    name: str
    language: str = "ASL"
    category: str = "General"
    description: str = ""

class TeachGestureRequest(BaseModel):
    label: str
    language: str = "ASL"
    landmarks: List[LandmarkPoint]
    samples_count: int = 8
    notes: Optional[str] = "Interactive webcam training sample"
    auto_train: bool = True

class SignSample(BaseModel):
    id: str
    label: str
    split: str = "train"  # 'train' | 'val' | 'test'
    landmarks: List[LandmarkPoint]
    created_at: str
    device_info: Optional[str] = "web-cam"
    notes: Optional[str] = ""
    review_status: str = "approved"  # 'pending_review' | 'approved' | 'rejected'
    quality_score: Optional[float] = 1.0

class CreateSampleRequest(BaseModel):
    label: str
    split: str = "train"
    landmarks: List[LandmarkPoint]
    device_info: Optional[str] = "web-cam"
    notes: Optional[str] = ""
    review_status: Optional[str] = "approved"
    quality_score: Optional[float] = 1.0

class ReviewSampleRequest(BaseModel):
    status: str  # 'approved' | 'rejected'
    notes: Optional[str] = ""

class AugmentRequest(BaseModel):
    label: str
    augmentation_type: str  # 'jitter' | 'scale' | 'mirror'
    count: int = 4

class ActivityLogItem(BaseModel):
    id: str
    action: str
    description: str
    timestamp: str
    category: str = "capture"  # 'capture' | 'review' | 'augmentation' | 'system'

class MediaRecord(BaseModel):
    id: str
    media_type: str  # 'image' | 'video'
    sign_language: str
    sign_label: str
    description: Optional[str] = ""
    signer_id: str
    consent_confirmed: bool
    filename: str
    file_url: str
    file_size_bytes: int
    split: str = "train"
    created_at: str

class PredictionAlternative(BaseModel):
    label: str
    confidence: float

class RecognitionRequest(BaseModel):
    landmarks: List[LandmarkPoint]
    top_k: int = 3

class RecognitionResponse(BaseModel):
    label: str
    confidence: float
    alternatives: List[PredictionAlternative]
    latency_ms: float
    hand_detected: bool = True

class DatasetStats(BaseModel):
    total_samples: int
    unique_labels: int
    pending_review: int
    approved_samples: int
    rejected_samples: int
    split_distribution: Dict[str, int]
    class_distribution: Dict[str, int]
    avg_samples_per_class: float

class SystemInfo(BaseModel):
    status: str
    version: str
    backend_engine: str
    mediapipe_available: bool
    samples_count: int
    classes_count: int

class LandmarkPoint3D(BaseModel):
    x: float
    y: float
    z: float = 0.0
    visibility: Optional[float] = None
    presence: Optional[float] = None

class HandDetection(BaseModel):
    handedness: str  # 'Left' or 'Right'
    confidence: float
    landmarks: List[LandmarkPoint3D]

class PoseDetection(BaseModel):
    confidence: Optional[float] = None
    landmarks: List[LandmarkPoint3D]

class FaceDetection(BaseModel):
    confidence: Optional[float] = None
    landmarks: List[LandmarkPoint3D]

class FrameLandmarks(BaseModel):
    frame_index: int
    timestamp_ms: float
    detection_status: str  # 'detected' | 'partial_detection' | 'no_landmarks_detected'
    hands: List[HandDetection] = []
    pose: Optional[PoseDetection] = None
    face: Optional[FaceDetection] = None
    missing_elements: List[str] = []

class ExtractionResult(BaseModel):
    sample_id: str
    media_type: str  # 'image' | 'video'
    target_language: str
    sign_label: Optional[str] = None
    filename: str
    file_url: Optional[str] = None
    total_frames: int
    processed_frames: int
    frames_with_detections: int
    missing_detections: int
    detection_rate_pct: float
    processing_time_ms: float
    creation_timestamp: str
    engine: str
    frames: List[FrameLandmarks]


# Continuous Recognition & Sentence Generation Models

class SignTokenModel(BaseModel):
    id: str
    sign: str
    confidence: float
    timestamp: float
    duration_ms: float
    motion_energy: float = 0.0

class GeneratedSentenceModel(BaseModel):
    raw_sequence: List[str]
    gloss_display: str
    english_sentence: str
    hindi_sentence: str
    hindi_phonetic: str
    is_complete: bool = False
    confidence_avg: float = 90.0
    grammar_pattern: str = "Standard"

class ContinuousSessionResponse(BaseModel):
    session_id: str
    is_active: bool
    motion_state: str  # 'signing' | 'transition' | 'idle'
    motion_energy: float
    current_frame_sign: Optional[str] = None
    current_frame_confidence: Optional[float] = None
    stable_candidate: Optional[str] = None
    stable_candidate_frames: int = 0
    active_sequence: List[SignTokenModel] = []
    raw_gloss_sequence: List[str] = []
    generated_sentence: Optional[GeneratedSentenceModel] = None
    total_tokens_recognized: int = 0
    session_duration_s: float = 0.0
    last_commit_time_ago_s: float = 0.0

class SentenceGenerateRequest(BaseModel):
    tokens: List[str]
    confidences: Optional[List[float]] = None

class AddManualTokenRequest(BaseModel):
    sign: str
    confidence: Optional[float] = 95.0
