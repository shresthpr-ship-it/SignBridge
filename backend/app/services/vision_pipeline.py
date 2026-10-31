import time
import math
import uuid
import datetime
import os
import tempfile
from pathlib import Path
from typing import List, Optional, Dict, Any

import cv2
import numpy as np

try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_tasks
    from mediapipe.tasks.python import vision as mp_vision
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    mp = None
    mp_tasks = None
    mp_vision = None

from app.models import (
    LandmarkPoint3D,
    HandDetection,
    PoseDetection,
    FaceDetection,
    FrameLandmarks,
    ExtractionResult,
)
from app.config import settings

# Paths to MediaPipe model assets
MODELS_DIR = Path(__file__).resolve().parent.parent / "models_cv"
HAND_MODEL_PATH = MODELS_DIR / "hand_landmarker.task"
POSE_MODEL_PATH = MODELS_DIR / "pose_landmarker.task"
FACE_MODEL_PATH = MODELS_DIR / "face_landmarker.task"

# Salient Facial Landmark Indices for Sign Language Linguistics (Non-Manual Markers)
# Nose: 1 (tip), 4, 6
# Left Eyebrow: 70, 63, 105, 66, 107
# Right Eyebrow: 336, 296, 334, 293, 300
# Left Eye: 33, 133, 159, 145
# Right Eye: 263, 362, 386, 374
# Lips/Mouth: 0 (upper), 17 (lower), 61 (left corner), 291 (right corner), 13 (inner upper), 14 (inner lower)
# Jaw/Chin: 152 (chin bottom), 172, 397
SIGN_FACIAL_INDICES = [
    1, 4, 6,
    70, 63, 105, 66, 107,
    336, 296, 334, 293, 300,
    33, 133, 159, 145,
    263, 362, 386, 374,
    0, 17, 61, 291, 13, 14,
    152, 172, 397
]


class VisionPipelineService:
    def __init__(self):
        self.mediapipe_available = MEDIAPIPE_AVAILABLE
        self._hand_landmarker = None
        self._pose_landmarker = None
        self._face_landmarker = None

    def _get_hand_landmarker(self):
        if not MEDIAPIPE_AVAILABLE or not HAND_MODEL_PATH.exists():
            return None
        if self._hand_landmarker is None:
            try:
                base_options = mp_tasks.BaseOptions(model_asset_path=str(HAND_MODEL_PATH))
                options = mp_vision.HandLandmarkerOptions(
                    base_options=base_options,
                    running_mode=mp_vision.RunningMode.IMAGE,
                    num_hands=2,
                    min_hand_detection_confidence=0.45,
                    min_hand_presence_confidence=0.45,
                    min_tracking_confidence=0.45,
                )
                self._hand_landmarker = mp_vision.HandLandmarker.create_from_options(options)
            except Exception as e:
                print(f"[VisionPipeline] HandLandmarker init error: {e}")
                self._hand_landmarker = None
        return self._hand_landmarker

    def _get_pose_landmarker(self):
        if not MEDIAPIPE_AVAILABLE or not POSE_MODEL_PATH.exists():
            return None
        if self._pose_landmarker is None:
            try:
                base_options = mp_tasks.BaseOptions(model_asset_path=str(POSE_MODEL_PATH))
                options = mp_vision.PoseLandmarkerOptions(
                    base_options=base_options,
                    running_mode=mp_vision.RunningMode.IMAGE,
                    min_pose_detection_confidence=0.45,
                    min_pose_presence_confidence=0.45,
                    min_tracking_confidence=0.45,
                )
                self._pose_landmarker = mp_vision.PoseLandmarker.create_from_options(options)
            except Exception as e:
                print(f"[VisionPipeline] PoseLandmarker init error: {e}")
                self._pose_landmarker = None
        return self._pose_landmarker

    def _get_face_landmarker(self):
        if not MEDIAPIPE_AVAILABLE or not FACE_MODEL_PATH.exists():
            return None
        if self._face_landmarker is None:
            try:
                base_options = mp_tasks.BaseOptions(model_asset_path=str(FACE_MODEL_PATH))
                options = mp_vision.FaceLandmarkerOptions(
                    base_options=base_options,
                    running_mode=mp_vision.RunningMode.IMAGE,
                    num_faces=1,
                    min_face_detection_confidence=0.45,
                    min_face_presence_confidence=0.45,
                    min_tracking_confidence=0.45,
                )
                self._face_landmarker = mp_vision.FaceLandmarker.create_from_options(options)
            except Exception as e:
                print(f"[VisionPipeline] FaceLandmarker init error: {e}")
                self._face_landmarker = None
        return self._face_landmarker

    def get_engine_status(self) -> Dict[str, Any]:
        has_hands = HAND_MODEL_PATH.exists()
        has_pose = POSE_MODEL_PATH.exists()
        has_face = FACE_MODEL_PATH.exists()
        return {
            "mediapipe_available": self.mediapipe_available,
            "opencv_version": cv2.__version__,
            "numpy_version": np.__version__,
            "engine": f"MediaPipe Tasks Vision v{mp.__version__}" if self.mediapipe_available else "Not Installed",
            "models_loaded": {
                "hand_landmarker": has_hands,
                "pose_landmarker": has_pose,
                "face_landmarker": has_face,
            }
        }

    def _extract_frame_landmarks(
        self,
        rgb_frame: np.ndarray,
        frame_idx: int,
        timestamp_ms: float,
        detect_pose: bool = True,
        detect_face: bool = True
    ) -> FrameLandmarks:
        """
        Executes real MediaPipe Tasks on an RGB image frame.
        Guaranteed: No synthetic coordinates, no fabricated landmarks.
        Missing detections are explicitly recorded in `missing_elements`.
        """
        if not self.mediapipe_available:
            return FrameLandmarks(
                frame_index=frame_idx,
                timestamp_ms=round(timestamp_ms, 2),
                detection_status="no_landmarks_detected",
                hands=[],
                pose=None,
                face=None,
                missing_elements=["mediapipe_unavailable", "left_hand", "right_hand", "pose", "face"]
            )

        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        hands_list: List[HandDetection] = []
        pose_detection: Optional[PoseDetection] = None
        face_detection: Optional[FaceDetection] = None
        missing_elements: List[str] = []

        # 1. Hand Detection
        hand_detector = self._get_hand_landmarker()
        detected_handedness_labels = []
        if hand_detector:
            try:
                hand_res = hand_detector.detect(mp_image)
                if hand_res and hand_res.hand_landmarks:
                    for i, landmarks_per_hand in enumerate(hand_res.hand_landmarks):
                        # Determine handedness and score
                        handedness_label = "Unknown"
                        confidence_score = 0.85
                        if hand_res.handedness and i < len(hand_res.handedness):
                            cat_list = hand_res.handedness[i]
                            if cat_list and len(cat_list) > 0:
                                handedness_label = cat_list[0].category_name or cat_list[0].display_name or "Unknown"
                                confidence_score = round(float(cat_list[0].score), 3)

                        detected_handedness_labels.append(handedness_label.lower())

                        pts = [
                            LandmarkPoint3D(
                                x=round(float(lm.x), 5),
                                y=round(float(lm.y), 5),
                                z=round(float(lm.z), 5),
                                visibility=round(float(getattr(lm, "visibility", 1.0)), 3) if getattr(lm, "visibility", None) is not None else None,
                                presence=round(float(getattr(lm, "presence", 1.0)), 3) if getattr(lm, "presence", None) is not None else None
                            )
                            for lm in landmarks_per_hand
                        ]

                        hands_list.append(HandDetection(
                            handedness=handedness_label,
                            confidence=confidence_score,
                            landmarks=pts
                        ))
            except Exception as e:
                print(f"[VisionPipeline] Hand detection exception on frame {frame_idx}: {e}")

        # Explicitly tag missing hands
        if "left" not in detected_handedness_labels:
            missing_elements.append("left_hand")
        if "right" not in detected_handedness_labels:
            missing_elements.append("right_hand")

        # 2. Pose Detection (Optional for high-speed live gesture mode)
        if detect_pose:
            pose_detector = self._get_pose_landmarker()
            if pose_detector:
                try:
                    pose_res = pose_detector.detect(mp_image)
                    if pose_res and pose_res.pose_landmarks and len(pose_res.pose_landmarks) > 0:
                        pose_pts = [
                            LandmarkPoint3D(
                                x=round(float(lm.x), 5),
                                y=round(float(lm.y), 5),
                                z=round(float(lm.z), 5),
                                visibility=round(float(getattr(lm, "visibility", 1.0)), 3) if getattr(lm, "visibility", None) is not None else None,
                                presence=round(float(getattr(lm, "presence", 1.0)), 3) if getattr(lm, "presence", None) is not None else None
                            )
                            for lm in pose_res.pose_landmarks[0]
                        ]
                        vis_scores = [p.visibility for p in pose_pts if p.visibility is not None]
                        mean_vis = round(float(np.mean(vis_scores)), 3) if vis_scores else 0.85

                        pose_detection = PoseDetection(
                            confidence=mean_vis,
                            landmarks=pose_pts
                        )
                    else:
                        missing_elements.append("pose")
                except Exception as e:
                    print(f"[VisionPipeline] Pose detection exception on frame {frame_idx}: {e}")
                    missing_elements.append("pose")
            else:
                missing_elements.append("pose")
        else:
            missing_elements.append("pose_disabled_for_speed")

        # 3. Face Detection (Optional for high-speed live gesture mode)
        if detect_face:
            face_detector = self._get_face_landmarker()
            if face_detector:
                try:
                    face_res = face_detector.detect(mp_image)
                    if face_res and face_res.face_landmarks and len(face_res.face_landmarks) > 0:
                        raw_face = face_res.face_landmarks[0]
                        salient_pts = []
                        for idx in SIGN_FACIAL_INDICES:
                            if idx < len(raw_face):
                                lm = raw_face[idx]
                                salient_pts.append(LandmarkPoint3D(
                                    x=round(float(lm.x), 5),
                                    y=round(float(lm.y), 5),
                                    z=round(float(lm.z), 5)
                                ))
                        face_detection = FaceDetection(
                            confidence=0.90,
                            landmarks=salient_pts
                        )
                    else:
                        missing_elements.append("face")
                except Exception as e:
                    print(f"[VisionPipeline] Face detection exception on frame {frame_idx}: {e}")
                    missing_elements.append("face")
            else:
                missing_elements.append("face")
        else:
            missing_elements.append("face_disabled_for_speed")

        # Determine overall frame detection status
        has_hands = len(hands_list) > 0
        has_pose = pose_detection is not None

        if has_hands and has_pose:
            detection_status = "detected"
        elif has_hands or has_pose:
            detection_status = "partial_detection"
        else:
            detection_status = "no_landmarks_detected"

        return FrameLandmarks(
            frame_index=frame_idx,
            timestamp_ms=round(timestamp_ms, 2),
            detection_status=detection_status,
            hands=hands_list,
            pose=pose_detection,
            face=face_detection,
            missing_elements=missing_elements
        )

    def process_image(
        self,
        image_bytes: bytes,
        filename: str,
        target_language: str = "ASL",
        sign_label: Optional[str] = None
    ) -> ExtractionResult:
        """
        Processes a still image frame using OpenCV & MediaPipe.
        Saves media to MEDIA_DIR for web rendering and landmark verification.
        """
        start_time = time.perf_counter()
        sample_id = f"ext-img-{uuid.uuid4().hex[:8]}"

        # Decode image using OpenCV
        np_arr = np.frombuffer(image_bytes, np.uint8)
        bgr_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if bgr_img is None:
            raise ValueError(f"Failed to decode image file '{filename}'. Ensure it is a valid PNG, JPEG, or WEBP image.")

        # Save media file persistently
        ext = Path(filename).suffix or ".jpg"
        saved_filename = f"{sample_id}_{Path(filename).stem}{ext}"
        target_file_path = settings.IMAGES_DIR / saved_filename
        with open(target_file_path, "wb") as f:
            f.write(image_bytes)
        file_url = f"/media/images/{saved_filename}"

        # Convert to RGB for MediaPipe
        rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)

        # Extract landmarks
        frame_data = self._extract_frame_landmarks(rgb_img, frame_idx=0, timestamp_ms=0.0)

        has_detection = frame_data.detection_status in ["detected", "partial_detection"]
        frames_with_detections = 1 if has_detection else 0
        missing_count = 0 if has_detection else 1
        rate = 100.0 if has_detection else 0.0

        latency = round((time.perf_counter() - start_time) * 1000, 2)

        return ExtractionResult(
            sample_id=sample_id,
            media_type="image",
            target_language=target_language,
            sign_label=sign_label,
            filename=filename,
            file_url=file_url,
            total_frames=1,
            processed_frames=1,
            frames_with_detections=frames_with_detections,
            missing_detections=missing_count,
            detection_rate_pct=rate,
            processing_time_ms=latency,
            creation_timestamp=datetime.datetime.utcnow().isoformat(),
            engine="MediaPipe Tasks Vision (Hand, Pose, Face)",
            frames=[frame_data]
        )

    def process_video(
        self,
        video_bytes: bytes,
        filename: str,
        target_language: str = "ASL",
        sign_label: Optional[str] = None,
        max_frames: int = 60,
        sample_fps: int = 6
    ) -> ExtractionResult:
        """
        Processes video frames while preserving temporal order and timestamps.
        Configurable sampling rate and frame bounds ensure responsive processing.
        """
        start_time = time.perf_counter()
        sample_id = f"ext-vid-{uuid.uuid4().hex[:8]}"

        # Save video file persistently for streaming preview
        ext = Path(filename).suffix or ".mp4"
        saved_filename = f"{sample_id}_{Path(filename).stem}{ext}"
        target_file_path = settings.VIDEOS_DIR / saved_filename
        with open(target_file_path, "wb") as f:
            f.write(video_bytes)
        file_url = f"/media/videos/{saved_filename}"

        # Use temporary file to read via cv2.VideoCapture
        frames_list: List[FrameLandmarks] = []
        total_video_frames = 0
        frames_with_detections = 0

        cap = cv2.VideoCapture(str(target_file_path))
        try:
            if not cap.isOpened():
                raise ValueError(f"Unable to read video file '{filename}'. Format may be unreadable or corrupt.")

            native_fps = cap.get(cv2.CAP_PROP_FPS)
            if not native_fps or native_fps <= 0 or math.isnan(native_fps):
                native_fps = 30.0

            total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if total_video_frames <= 0:
                total_video_frames = 1

            # Determine frame step based on desired sample_fps
            frame_step = max(1, int(round(native_fps / sample_fps)))

            current_frame_idx = 0
            sampled_idx = 0

            while cap.isOpened() and sampled_idx < max_frames:
                ret, bgr_frame = cap.read()
                if not ret:
                    break

                if current_frame_idx % frame_step == 0:
                    timestamp_ms = (current_frame_idx / native_fps) * 1000.0
                    rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)

                    frame_data = self._extract_frame_landmarks(
                        rgb_frame,
                        frame_idx=sampled_idx,
                        timestamp_ms=timestamp_ms
                    )

                    if frame_data.detection_status in ["detected", "partial_detection"]:
                        frames_with_detections += 1

                    frames_list.append(frame_data)
                    sampled_idx += 1

                current_frame_idx += 1
        finally:
            cap.release()

        processed_count = len(frames_list)
        missing_count = processed_count - frames_with_detections
        rate = round((frames_with_detections / processed_count * 100.0), 1) if processed_count > 0 else 0.0
        latency = round((time.perf_counter() - start_time) * 1000, 2)

        return ExtractionResult(
            sample_id=sample_id,
            media_type="video",
            target_language=target_language,
            sign_label=sign_label,
            filename=filename,
            file_url=file_url,
            total_frames=total_video_frames,
            processed_frames=processed_count,
            frames_with_detections=frames_with_detections,
            missing_detections=missing_count,
            detection_rate_pct=rate,
            processing_time_ms=latency,
            creation_timestamp=datetime.datetime.utcnow().isoformat(),
            engine="MediaPipe Tasks Vision (Hand, Pose, Face)",
            frames=frames_list
        )


vision_pipeline = VisionPipelineService()
