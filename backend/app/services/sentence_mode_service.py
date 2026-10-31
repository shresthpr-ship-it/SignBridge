"""
SignBridge Sentence Mode Service.
Handles complete recorded video processing, chronological landmark extraction,
motion-aware gesture segmentation, and sentence-level linguistic translation.
"""

import os
import cv2
import math
import time
import json
import uuid
import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any, Tuple
from pydantic import BaseModel

from app.config import settings
from app.models import LandmarkPoint
from app.services.vision_pipeline import vision_pipeline
from app.services.recognition_service import recognition_service
from app.services.sentence_service import sentence_generation_service, GeneratedSentence

SENTENCE_VIDEOS_DIR = settings.VIDEOS_DIR / "sentence_mode"
SENTENCE_VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
SENTENCE_SESSIONS_FILE = settings.DATA_DIR / "sentence_sessions.json"


class DetectedSignSegment(BaseModel):
    sign: str
    confidence: float
    start_time_ms: float
    end_time_ms: float
    frame_count: int


class SentenceModeProcessingResult(BaseModel):
    session_id: str
    target_language: str
    recognition_task: str  # 'sentence_translation' | 'gloss_sequence' | 'recognition_unavailable'
    status: str            # 'success' | 'no_hands_detected' | 'no_recognized_signs' | 'error'
    message: str
    video_filename: str
    video_url: Optional[str] = None
    duration_seconds: float
    total_frames: int
    processed_frames: int
    frames_with_hands: int
    raw_gloss_sequence: List[str]
    detected_segments: List[DetectedSignSegment]
    generated_sentence: Optional[GeneratedSentence] = None
    model_info: Dict[str, Any]
    processing_time_ms: float
    created_at: str


class SentenceModeService:
    def __init__(self):
        self.sessions_file = SENTENCE_SESSIONS_FILE
        self._ensure_sessions_file()

    def _ensure_sessions_file(self):
        if not self.sessions_file.exists():
            with open(self.sessions_file, "w", encoding="utf-8") as f:
                json.dump([], f)

    def get_sessions(self) -> List[Dict[str, Any]]:
        try:
            with open(self.sessions_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def save_session(self, session_data: Dict[str, Any]):
        try:
            sessions = self.get_sessions()
            sessions.insert(0, session_data)
            # Retain last 50 sentence mode sessions
            if len(sessions) > 50:
                sessions = sessions[:50]
            with open(self.sessions_file, "w", encoding="utf-8") as f:
                json.dump(sessions, f, indent=2)
        except Exception as e:
            print(f"[SentenceModeService] Failed to persist session: {e}")

    def process_sentence_video(
        self,
        video_bytes: bytes,
        original_filename: str,
        target_language: str = "ISL"
    ) -> SentenceModeProcessingResult:
        start_perf = time.perf_counter()
        now_dt = datetime.datetime.now(datetime.timezone.utc).isoformat()
        session_id = f"sent_{uuid.uuid4().hex[:10]}"

        # 1. Determine file extension and write to disk safely
        ext = Path(original_filename).suffix.lower()
        if ext not in [".webm", ".mp4", ".mov", ".avi", ".mkv"]:
            ext = ".webm"

        saved_filename = f"{session_id}_{int(time.time())}{ext}"
        saved_path = SENTENCE_VIDEOS_DIR / saved_filename

        with open(saved_path, "wb") as f:
            f.write(video_bytes)

        file_url = f"/media/videos/sentence_mode/{saved_filename}"

        # 2. Open video with OpenCV
        cap = cv2.VideoCapture(str(saved_path))
        if not cap.isOpened():
            return SentenceModeProcessingResult(
                session_id=session_id,
                target_language=target_language,
                recognition_task="recognition_unavailable",
                status="error",
                message="Failed to decode uploaded video media format.",
                video_filename=saved_filename,
                video_url=file_url,
                duration_seconds=0.0,
                total_frames=0,
                processed_frames=0,
                frames_with_hands=0,
                raw_gloss_sequence=[],
                detected_segments=[],
                generated_sentence=None,
                model_info=recognition_service.get_model_status(),
                processing_time_ms=round((time.perf_counter() - start_perf) * 1000, 1),
                created_at=now_dt,
            )

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        duration_s = round(total_frames / video_fps, 2) if total_frames > 0 else 0.0

        # Subsample frames to ~12 FPS for smooth and fast landmark sequence decoding
        sample_step = max(1, int(round(video_fps / 12.0)))

        processed_count = 0
        hands_count = 0
        frame_idx = 0

        # Chronological frame observations: list of {timestamp_ms, sign, confidence, velocity}
        frame_observations: List[Dict[str, Any]] = []
        last_wrist_pos: Optional[Tuple[float, float, float]] = None

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_step == 0:
                processed_count += 1
                timestamp_ms = round((frame_idx / video_fps) * 1000, 1)

                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                # Run high-performance MediaPipe hand landmark extraction
                landmarks_data = vision_pipeline._extract_frame_landmarks(
                    rgb_frame,
                    frame_idx=frame_idx,
                    timestamp_ms=timestamp_ms,
                    detect_pose=False,
                    detect_face=False
                )

                if landmarks_data.hands and len(landmarks_data.hands[0].landmarks) >= 21:
                    hands_count += 1
                    primary_hand = landmarks_data.hands[0]
                    pts = [
                        LandmarkPoint(
                            x=p.x,
                            y=p.y,
                            z=p.z,
                            visibility=p.visibility if p.visibility is not None else 1.0
                        )
                        for p in primary_hand.landmarks
                    ]

                    # Velocity calculation
                    wrist = pts[0]
                    cur_pos = (wrist.x, wrist.y, wrist.z or 0.0)
                    velocity = 0.0
                    if last_wrist_pos:
                        dx = cur_pos[0] - last_wrist_pos[0]
                        dy = cur_pos[1] - last_wrist_pos[1]
                        dz = cur_pos[2] - last_wrist_pos[2]
                        velocity = round(math.sqrt(dx * dx + dy * dy + dz * dz) * 10, 2)
                    last_wrist_pos = cur_pos

                    # Evaluate sign posture on this frame
                    # Suppress during extreme motion spikes (inter-sign epenthesis)
                    if velocity < 2.2:
                        rec = recognition_service.infer_sign(pts)
                        if rec["predicted_sign"] and rec["prediction_state"] != "unknown":
                            conf = rec["confidence_score"] or 0.0
                            if conf >= 70.0:
                                frame_observations.append({
                                    "timestamp_ms": timestamp_ms,
                                    "sign": rec["predicted_sign"],
                                    "confidence": conf,
                                    "velocity": velocity,
                                })
                else:
                    last_wrist_pos = None

            frame_idx += 1

        cap.release()

        # 3. Chronological Gesture Segmentation & Consensus
        # Group adjacent frames into sustained gesture intervals
        detected_segments: List[DetectedSignSegment] = []
        if frame_observations:
            current_sign = frame_observations[0]["sign"]
            start_ms = frame_observations[0]["timestamp_ms"]
            confs = [frame_observations[0]["confidence"]]
            count = 1

            for obs in frame_observations[1:]:
                # Check for sign boundary
                if obs["sign"] == current_sign and (obs["timestamp_ms"] - frame_observations[frame_observations.index(obs) - 1]["timestamp_ms"]) < 600:
                    confs.append(obs["confidence"])
                    count += 1
                else:
                    # Finalize current segment if it was held for at least 2 sampled frames (~160ms+)
                    if count >= 2:
                        avg_conf = round(sum(confs) / len(confs), 1)
                        last_ms = frame_observations[frame_observations.index(obs) - 1]["timestamp_ms"]
                        detected_segments.append(
                            DetectedSignSegment(
                                sign=current_sign,
                                confidence=avg_conf,
                                start_time_ms=start_ms,
                                end_time_ms=last_ms,
                                frame_count=count
                            )
                        )
                    # Start new candidate segment
                    current_sign = obs["sign"]
                    start_ms = obs["timestamp_ms"]
                    confs = [obs["confidence"]]
                    count = 1

            # Finalize trailing segment
            if count >= 2:
                avg_conf = round(sum(confs) / len(confs), 1)
                detected_segments.append(
                    DetectedSignSegment(
                        sign=current_sign,
                        confidence=avg_conf,
                        start_time_ms=start_ms,
                        end_time_ms=frame_observations[-1]["timestamp_ms"],
                        frame_count=count
                    )
                )

        # Remove immediate consecutive duplicate signs from sequence
        pruned_segments: List[DetectedSignSegment] = []
        for seg in detected_segments:
            if not pruned_segments or pruned_segments[-1].sign != seg.sign:
                pruned_segments.append(seg)
            else:
                # Merge if pause was tiny
                if seg.start_time_ms - pruned_segments[-1].end_time_ms < 500:
                    pruned_segments[-1].end_time_ms = seg.end_time_ms
                    pruned_segments[-1].confidence = round((pruned_segments[-1].confidence + seg.confidence) / 2, 1)
                    pruned_segments[-1].frame_count += seg.frame_count

        raw_gloss = [s.sign for s in pruned_segments]

        # 4. Sentence Generation & Classification Status
        model_info = recognition_service.get_model_status()
        processing_time_ms = round((time.perf_counter() - start_perf) * 1000, 1)

        if hands_count == 0:
            status = "no_hands_detected"
            task = "recognition_unavailable"
            message = "No hands were detected throughout the recording. Ensure your hands are clearly visible in the camera frame."
            generated_sentence = None
        elif not raw_gloss:
            status = "no_recognized_signs"
            task = "recognition_unavailable"
            message = "Hand movement detected, but postures did not match calibrated vocabulary with sufficient confidence."
            generated_sentence = None
        else:
            status = "success"
            confs = [s.confidence for s in pruned_segments]
            generated_sentence = sentence_generation_service.generate_sentence(raw_gloss, confs)
            task = "sentence_translation" if generated_sentence.is_complete else "gloss_sequence"
            message = f"Successfully recognized {len(raw_gloss)} sign gestures and generated translation."

        result = SentenceModeProcessingResult(
            session_id=session_id,
            target_language=target_language,
            recognition_task=task,
            status=status,
            message=message,
            video_filename=saved_filename,
            video_url=file_url,
            duration_seconds=duration_s,
            total_frames=total_frames,
            processed_frames=processed_count,
            frames_with_hands=hands_count,
            raw_gloss_sequence=raw_gloss,
            detected_segments=pruned_segments,
            generated_sentence=generated_sentence,
            model_info=model_info,
            processing_time_ms=processing_time_ms,
            created_at=now_dt,
        )

        # Persist session to history store
        self.save_session(result.model_dump())
        return result


sentence_mode_service = SentenceModeService()
