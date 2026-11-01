"""
SignBridge Continuous Sign Recognition Service.
Handles temporal sequence buffering, motion energy estimation, sign onset/hold/offset segmentation,
debouncing of sustained gestures, and continuous sequence accumulation for sentence generation.
"""

import time
import math
from typing import List, Dict, Optional, Tuple, Any
from pydantic import BaseModel, Field

from app.models import LandmarkPoint
from app.services.recognition_service import recognition_service
from app.services.sentence_service import sentence_generation_service, GeneratedSentence


class SignToken(BaseModel):
    id: str
    sign: str
    confidence: float
    timestamp: float
    duration_ms: float
    motion_energy: float


class ContinuousSessionSnapshot(BaseModel):
    session_id: str
    is_active: bool
    motion_state: str  # 'signing' | 'transition' | 'idle'
    motion_energy: float
    current_frame_sign: Optional[str]
    current_frame_confidence: Optional[float]
    stable_candidate: Optional[str]
    stable_candidate_frames: int
    active_sequence: List[SignToken]
    raw_gloss_sequence: List[str]
    generated_sentence: Optional[GeneratedSentence]
    total_tokens_recognized: int
    session_duration_s: float
    last_commit_time_ago_s: float


class ContinuousSignRecognizer:
    """
    Maintains continuous recognition across successive webcam frames.
    Implements temporal windowing, motion energy estimation, transition filtering,
    and sequence aggregation.
    """

    def __init__(self, window_size: int = 8, min_consensus_frames: int = 2, confidence_threshold: float = 60.0):
        self.session_id: str = f"session_{int(time.time())}"
        self.session_start_time: float = time.time()
        self.window_size = window_size
        self.min_consensus_frames = min_consensus_frames
        self.confidence_threshold = confidence_threshold

        # Frame history buffer: stores recent (landmarks, timestamp, wrist_pos, sign_pred, conf)
        self.frame_buffer: List[Dict[str, Any]] = []

        # Current Candidate Tracking
        self.current_candidate: Optional[str] = None
        self.candidate_frame_count: int = 0
        self.candidate_confidences: List[float] = []
        self.candidate_start_time: float = 0.0

        # Motion Energy
        self.last_wrist_pos: Optional[Tuple[float, float, float]] = None
        self.current_motion_energy: float = 0.0
        self.motion_state: str = "idle"  # 'idle' | 'transition' | 'signing'

        # Committed Sequence
        self.active_sequence: List[SignToken] = []
        self.last_committed_sign: Optional[str] = None
        self.last_committed_time: float = 0.0
        self.time_since_last_neutral: float = 0.0
        self.was_in_transition: bool = False

        # Generated Sentence
        self.current_sentence: Optional[GeneratedSentence] = None

    def process_frame(
        self,
        raw_landmarks: List[LandmarkPoint],
        hand_present: bool = True
    ) -> Dict[str, Any]:
        """
        Process a single incoming video frame in the continuous session.
        Calculates motion dynamics, runs feature recognition, applies temporal consensus,
        and emits new sign tokens when gesture boundaries are detected.
        """
        now = time.time()

        if not hand_present or not raw_landmarks or len(raw_landmarks) < 21:
            self._handle_no_hand(now)
            return self.get_snapshot().model_dump()

        # 1. Compute Motion Energy & Velocity from Wrist (lm 0) and Middle MCP (lm 9)
        wrist = raw_landmarks[0]
        cur_pos = (wrist.x, wrist.y, wrist.z or 0.0)

        dt = (now - self.frame_buffer[-1]["time"]) if self.frame_buffer else 0.05
        dt = max(0.01, min(dt, 0.25))

        if self.last_wrist_pos:
            dx = cur_pos[0] - self.last_wrist_pos[0]
            dy = cur_pos[1] - self.last_wrist_pos[1]
            dz = cur_pos[2] - self.last_wrist_pos[2]
            displacement = math.sqrt(dx * dx + dy * dy + dz * dz)
            self.current_motion_energy = round(displacement / dt, 3)
        else:
            self.current_motion_energy = 0.0

        self.last_wrist_pos = cur_pos

        # Determine motion state based on velocity
        # High velocity (> 2.0) -> hand in rapid motion transition between signs
        # Low velocity (<= 2.0) -> hand held in signing posture (stroke/hold phase)
        if self.current_motion_energy > 2.0:
            self.motion_state = "transition"
            self.was_in_transition = True
        else:
            self.motion_state = "signing"

        # 2. Frame Inference via Isolated Recognition Engine
        infer_res = recognition_service.infer_sign(raw_landmarks)
        pred_sign = infer_res.get("predicted_sign")
        conf_score = infer_res.get("confidence_score") or 0.0
        pred_state = infer_res.get("prediction_state", "unknown")

        # 3. Add to sliding frame buffer
        self.frame_buffer.append({
            "time": now,
            "sign": pred_sign,
            "confidence": conf_score,
            "state": pred_state,
            "motion_energy": self.current_motion_energy,
        })
        if len(self.frame_buffer) > self.window_size * 2:
            self.frame_buffer.pop(0)

        # 4. Temporal Consensus & Boundary Segmentation
        if pred_sign and conf_score >= self.confidence_threshold:
            if pred_sign == self.current_candidate:
                self.candidate_frame_count += 1
                self.candidate_confidences.append(conf_score)
            else:
                self.current_candidate = pred_sign
                self.candidate_frame_count = 1
                self.candidate_confidences = [conf_score]
                self.candidate_start_time = now

            # Check if candidate has reached temporal consensus
            if self.candidate_frame_count >= self.min_consensus_frames:
                self._evaluate_token_commit(pred_sign, now)
        else:
            # Gesture degraded or ambiguous
            if self.candidate_frame_count > 0:
                self.candidate_frame_count -= 1
            if self.candidate_frame_count == 0:
                self.current_candidate = None

        return self.get_snapshot().model_dump()

    def _handle_no_hand(self, now: float):
        """Handle frame where no hand is visible in signing space."""
        self.last_wrist_pos = None
        self.current_motion_energy = 0.0
        self.motion_state = "idle"
        self.current_candidate = None
        self.candidate_frame_count = 0
        self.time_since_last_neutral = now
        self.was_in_transition = True

        self.frame_buffer.append({
            "time": now,
            "sign": None,
            "confidence": 0.0,
            "state": "no_hand",
            "motion_energy": 0.0,
        })
        if len(self.frame_buffer) > self.window_size:
            self.frame_buffer.pop(0)

    def _evaluate_token_commit(self, sign: str, now: float):
        """
        Emits a new SignToken when a sign has stabilized, avoiding unwanted repeat tokens
        unless an intentional pause or transition has occurred.
        """
        duration_ms = (now - self.candidate_start_time) * 1000
        avg_conf = (
            round(sum(self.candidate_confidences) / len(self.candidate_confidences), 1)
            if self.candidate_confidences
            else 85.0
        )

        time_since_last_commit = now - self.last_committed_time

        # Debouncing rule:
        # If the same sign as last committed:
        # Only re-commit if at least 1.6s elapsed AND an intervening neutral/transition occurred
        if sign == self.last_committed_sign:
            if time_since_last_commit < 1.6 or not self.was_in_transition:
                return  # Sustained hold of the same sign, do not duplicate token

        token_id = f"tok_{int(now * 1000)}_{len(self.active_sequence)}"
        token = SignToken(
            id=token_id,
            sign=sign,
            confidence=avg_conf,
            timestamp=now,
            duration_ms=round(duration_ms, 1),
            motion_energy=self.current_motion_energy,
        )

        self.active_sequence.append(token)
        self.last_committed_sign = sign
        self.last_committed_time = now
        self.was_in_transition = False

        # Keep active sequence to reasonable length (e.g. last 16 signs in sentence)
        if len(self.active_sequence) > 16:
            self.active_sequence.pop(0)

        # Trigger linguistic sentence generation
        raw_signs = [t.sign for t in self.active_sequence]
        confs = [t.confidence for t in self.active_sequence]
        self.current_sentence = sentence_generation_service.generate_sentence(raw_signs, confs)

    def remove_last_token(self) -> Optional[SignToken]:
        """Undo / delete the most recently committed sign token."""
        if not self.active_sequence:
            return None
        removed = self.active_sequence.pop()
        self.last_committed_sign = self.active_sequence[-1].sign if self.active_sequence else None

        raw_signs = [t.sign for t in self.active_sequence]
        confs = [t.confidence for t in self.active_sequence]
        self.current_sentence = (
            sentence_generation_service.generate_sentence(raw_signs, confs)
            if raw_signs
            else None
        )
        return removed

    def add_token(self, sign_name: str, confidence: float = 95.0) -> SignToken:
        """Manually append a sign token into the continuous sequence."""
        now = time.time()
        token = SignToken(
            id=f"tok_{int(now * 1000)}_{len(self.active_sequence)}",
            sign=sign_name,
            confidence=confidence,
            timestamp=now,
            duration_ms=500.0,
            motion_energy=0.2,
        )
        self.active_sequence.append(token)
        self.last_committed_sign = sign_name
        self.last_committed_time = now

        raw_signs = [t.sign for t in self.active_sequence]
        confs = [t.confidence for t in self.active_sequence]
        self.current_sentence = sentence_generation_service.generate_sentence(raw_signs, confs)
        return token

    def reset_session(self):
        """Clears all session buffers, active sequence, and generated sentence."""
        self.session_id = f"session_{int(time.time())}"
        self.session_start_time = time.time()
        self.frame_buffer.clear()
        self.current_candidate = None
        self.candidate_frame_count = 0
        self.candidate_confidences.clear()
        self.last_wrist_pos = None
        self.current_motion_energy = 0.0
        self.motion_state = "idle"
        self.active_sequence.clear()
        self.last_committed_sign = None
        self.last_committed_time = 0.0
        self.was_in_transition = False
        self.current_sentence = None
        recognition_service.reset_temporal_window()

    def get_snapshot(self) -> ContinuousSessionSnapshot:
        """Returns instantaneous snapshot of current continuous recognition session."""
        now = time.time()
        last_frame = self.frame_buffer[-1] if self.frame_buffer else {}
        cur_sign = last_frame.get("sign")
        cur_conf = last_frame.get("confidence")

        raw_gloss = [t.sign for t in self.active_sequence]
        last_commit_ago = (now - self.last_committed_time) if self.last_committed_time > 0 else 0.0

        # If active_sequence has committed tokens, use the multi-token sentence
        # If active_sequence is empty, but we have a stable candidate or current recognized sign,
        # provide a live provisional sentence so the user immediately sees translation feedback
        effective_sentence = self.current_sentence
        if not effective_sentence and not self.active_sequence:
            provisional_sign = self.current_candidate or cur_sign
            if provisional_sign and (cur_conf or 0) >= 50.0:
                provisional = sentence_generation_service.generate_sentence([provisional_sign], [cur_conf or 80.0])
                provisional.grammar_pattern = "Live Provisional (Active Gesture)"
                provisional.is_complete = False
                effective_sentence = provisional

        return ContinuousSessionSnapshot(
            session_id=self.session_id,
            is_active=True,
            motion_state=self.motion_state,
            motion_energy=round(self.current_motion_energy, 2),
            current_frame_sign=cur_sign,
            current_frame_confidence=cur_conf,
            stable_candidate=self.current_candidate,
            stable_candidate_frames=self.candidate_frame_count,
            active_sequence=self.active_sequence,
            raw_gloss_sequence=raw_gloss,
            generated_sentence=effective_sentence,
            total_tokens_recognized=len(self.active_sequence),
            session_duration_s=round(now - self.session_start_time, 1),
            last_commit_time_ago_s=round(last_commit_ago, 1),
        )


continuous_recognizer = ContinuousSignRecognizer()
