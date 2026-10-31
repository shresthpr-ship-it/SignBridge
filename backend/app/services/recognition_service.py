import time
import os
import datetime
from pathlib import Path
from collections import Counter
from typing import List, Dict, Optional, Any, Tuple

from app.models import (
    LandmarkPoint,
    LandmarkPoint3D,
    HandDetection,
    PoseDetection,
    FaceDetection,
    PredictionAlternative,
)
from app.services.landmark_extractor import normalize_landmarks
from app.services.dataset_service import dataset_service
from app.config import settings

MODELS_DIR = Path(__file__).resolve().parent.parent / "models_cv"


class TemporalPredictionBuffer:
    """
    Maintains a sliding window of recent predictions across frames
    to suppress high-frequency flickering and compute stability.
    """
    def __init__(self, window_size: int = 5, min_stable_count: int = 3):
        self.window_size = window_size
        self.min_stable_count = min_stable_count
        self.buffer: List[Dict[str, Any]] = []

    def add(self, prediction: Optional[str], confidence: Optional[float]):
        now = time.time()
        self.buffer.append({
            "sign": prediction,
            "confidence": confidence,
            "timestamp": now,
        })
        if len(self.buffer) > self.window_size:
            self.buffer.pop(0)

    def get_stability(self) -> Tuple[Optional[str], str, float]:
        """
        Returns:
            (evaluated_sign, state, stability_ratio)
            state is 'stable' | 'provisional' | 'unknown'
        """
        if not self.buffer:
            return None, "unknown", 0.0

        # Filter out None/empty entries
        valid_predictions = [b["sign"] for b in self.buffer if b["sign"] is not None]
        if not valid_predictions:
            return None, "unknown", 0.0

        counts = Counter(valid_predictions)
        most_common_sign, frequency = counts.most_common(1)[0]
        stability_ratio = round(frequency / len(self.buffer), 2)

        if frequency >= self.min_stable_count:
            return most_common_sign, "stable", stability_ratio
        else:
            return most_common_sign, "provisional", stability_ratio

    def clear(self):
        self.buffer.clear()


class SignRecognitionInferenceService:
    """
    Inference service managing sign recognition models, baseline prototype matching,
    and temporal sequence tracking.
    """
    def __init__(self):
        self.temporal_buffer = TemporalPredictionBuffer(window_size=5, min_stable_count=3)
        self._pretrained_model_path: Optional[Path] = None
        self._sklearn_model = None
        self._sklearn_label_encoder = None
        self._inspect_available_models()

    def _inspect_available_models(self):
        """
        Inspects models directory. Prefers SignBridge-trained sklearn pkl model,
        then falls back to external ONNX/TFLite/PT files.
        """
        self._pretrained_model_path = None
        self._sklearn_model = None
        self._sklearn_label_encoder = None

        if not MODELS_DIR.exists():
            return

        # Priority 1: SignBridge trained sklearn classifier
        pkl_path = MODELS_DIR / "trained_sign_classifier.pkl"
        if pkl_path.exists():
            try:
                import pickle
                with open(pkl_path, "rb") as f:
                    data = pickle.load(f)
                self._sklearn_model = data["model"]
                self._sklearn_label_encoder = data["label_encoder"]
                self._pretrained_model_path = pkl_path
                print(f"[RecognitionService] Loaded sklearn MLP model from {pkl_path.name}")
                print(f"[RecognitionService] Classes: {list(self._sklearn_label_encoder.classes_)}")
                return
            except Exception as e:
                print(f"[RecognitionService] sklearn model load failed: {e}")

        # Priority 2: External ONNX/TFLite/PT model
        for f in MODELS_DIR.iterdir():
            if f.suffix.lower() in [".onnx", ".tflite", ".pt", ".bin"] and "sign" in f.name.lower():
                self._pretrained_model_path = f
                print(f"[RecognitionService] Found external model: {f.name}")
                break

    def get_model_status(self) -> Dict[str, Any]:
        has_sklearn = self._sklearn_model is not None
        has_pretrained = self._pretrained_model_path is not None and not has_sklearn
        has_prototypes = len(dataset_service.get_samples()) > 0

        capabilities = ["landmark_detection_3d"]
        if has_sklearn:
            capabilities.append("trained_mlp_classifier")
        if has_prototypes:
            capabilities.append("isolated_sign_prototype_matching")
        if has_pretrained:
            capabilities.append("pretrained_model_inference")

        limitations = [
            "movement_sequence_model_required_for_dynamic_signs",
            "continuous_translation_grammar_unsupported",
            "facial_non_manual_grammar_not_modeled"
        ]

        classes_list = []
        if has_sklearn and self._sklearn_label_encoder is not None:
            classes_list = list(self._sklearn_label_encoder.classes_)

        return {
            "is_model_configured": has_sklearn or has_pretrained,
            "has_prototype_matcher": has_prototypes,
            "model_name": (
                f"Trained MLP Classifier ({self._pretrained_model_path.name})"
                if has_sklearn
                else self._pretrained_model_path.name
                if has_pretrained
                else "Baseline Prototype Centroid Matcher (Isolated Signs)"
                if has_prototypes
                else "No Sign Recognition Model Configured"
            ),
            "tier": (
                "trained_sklearn_mlp"
                if has_sklearn
                else "pretrained_sequence_model"
                if has_pretrained
                else "isolated_sign_prototype"
                if has_prototypes
                else "landmark_detection_only"
            ),
            "capabilities": capabilities,
            "limitations": limitations,
            "temporal_smoothing_window": self.temporal_buffer.window_size,
            "sklearn_model_loaded": has_sklearn,
            "classes": classes_list,
        }

    def infer_sign(self, raw_landmarks: List[LandmarkPoint]) -> Dict[str, Any]:
        """
        Performs recognition on normalized landmarks using available models.
        Distinguishes simple landmark detection from true sign recognition.
        Does NOT invent confidence or substitute random labels.

        Priority:
          1. Trained sklearn MLP classifier (most accurate)
          2. Prototype centroid matching (fallback when dataset exists)
          3. No recognition (if no data available)
        """
        if not raw_landmarks or len(raw_landmarks) < 21:
            self.temporal_buffer.add(None, None)
            return {
                "predicted_sign": None,
                "confidence_score": None,
                "prediction_state": "no_hand",
                "stability_score": 0.0,
                "recognition_message": "No hand detected in camera feed.",
                "alternatives": [],
            }

        # ── STAGE 1: sklearn MLP model (trained by SignBridge) ─────────────────
        if self._sklearn_model is not None and self._sklearn_label_encoder is not None:
            try:
                import numpy as np
                features = normalize_landmarks(raw_landmarks)
                feat_arr = np.array(features, dtype=np.float32).reshape(1, -1)
                proba = self._sklearn_model.predict_proba(feat_arr)[0]
                top_idx = int(np.argmax(proba))
                top_conf = round(float(proba[top_idx]) * 100, 1)
                top_sign = str(self._sklearn_label_encoder.classes_[top_idx])

                CONFIDENCE_THRESHOLD = 60.0
                alts = sorted(
                    [
                        PredictionAlternative(
                            label=str(self._sklearn_label_encoder.classes_[i]),
                            confidence=round(float(p) * 100, 1)
                        )
                        for i, p in enumerate(proba) if i != top_idx
                    ],
                    key=lambda a: a.confidence, reverse=True
                )[:3]

                if top_conf < CONFIDENCE_THRESHOLD:
                    self.temporal_buffer.add(None, None)
                    return {
                        "predicted_sign": None,
                        "confidence_score": top_conf,
                        "prediction_state": "unknown",
                        "stability_score": 0.0,
                        "recognition_message": (
                            f"Confidence {top_conf:.0f}% below threshold {CONFIDENCE_THRESHOLD:.0f}%. "
                            f"Closest match: '{top_sign}'. Show your hand clearly."
                        ),
                        "alternatives": alts,
                    }

                self.temporal_buffer.add(top_sign, top_conf)
                stable_sign, state, stability_ratio = self.temporal_buffer.get_stability()

                return {
                    "predicted_sign": stable_sign if state == "stable" else top_sign,
                    "confidence_score": top_conf,
                    "prediction_state": state,
                    "stability_score": stability_ratio,
                    "recognition_message": (
                        f"MLP: '{top_sign}' at {top_conf:.0f}%."
                        + (" ✓ Stable" if state == "stable" else " (stabilizing...)")
                    ),
                    "alternatives": alts,
                }
            except Exception as e:
                print(f"[RecognitionService] sklearn inference error: {e}")
                # Fall through to centroid matching

        # ── STAGE 2: Prototype centroid matching ────────────────────────────────
        samples = dataset_service.get_samples()
        if not samples:
            self.temporal_buffer.add(None, None)
            return {
                "predicted_sign": None,
                "confidence_score": None,
                "prediction_state": "model_unavailable",
                "stability_score": 0.0,
                "recognition_message": (
                    "Sign recognition model is not configured and no calibrated dataset samples exist. "
                    "Only raw 3D landmark detection is currently active."
                ),
                "alternatives": [],
            }

        # Compute centroid matching against calibrated classes
        grouped: Dict[str, List[List[float]]] = {}
        for s in samples:
            lbl = s.get("label")
            pts = [LandmarkPoint(**p) if isinstance(p, dict) else p for p in s.get("landmarks", [])]
            if lbl and len(pts) >= 21:
                grouped.setdefault(lbl, []).append(normalize_landmarks(pts))

        if not grouped:
            self.temporal_buffer.add(None, None)
            return {
                "predicted_sign": None,
                "confidence_score": None,
                "prediction_state": "model_unavailable",
                "stability_score": 0.0,
                "recognition_message": "No calibrated prototypes found in dataset.",
                "alternatives": [],
            }

        target_features = normalize_landmarks(raw_landmarks)

        # Match against prototypes
        scores: List[Tuple[str, float]] = []
        for label, feat_list in grouped.items():
            if not feat_list:
                continue
            dim = len(feat_list[0])
            centroid = [0.0] * dim
            for f in feat_list:
                for d in range(dim):
                    centroid[d] += f[d]
            for d in range(dim):
                centroid[d] /= len(feat_list)

            # Cosine similarity
            dot = sum(a * b for a, b in zip(target_features, centroid))
            mag1 = sum(a * a for a in target_features) ** 0.5
            mag2 = sum(b * b for b in centroid) ** 0.5
            cos_sim = dot / (mag1 * mag2) if (mag1 > 0 and mag2 > 0) else 0.0

            # Euclidean distance
            dist = sum((a - b) ** 2 for a, b in zip(target_features, centroid)) ** 0.5
            dist_score = 1.0 / (1.0 + dist)

            sim_norm = max(0.0, min(1.0, (cos_sim + 1.0) / 2.0))
            combined_conf = round((0.7 * sim_norm + 0.3 * dist_score) * 100, 1)
            scores.append((label, combined_conf))

        scores.sort(key=lambda x: x[1], reverse=True)

        if not scores:
            self.temporal_buffer.add(None, None)
            return {
                "predicted_sign": None,
                "confidence_score": None,
                "prediction_state": "unknown",
                "stability_score": 0.0,
                "recognition_message": "Unable to calculate similarity score.",
                "alternatives": [],
            }

        top_sign, top_conf = scores[0]
        CONFIDENCE_THRESHOLD = 70.0  # Strict threshold to avoid false positive hallucinations

        if top_conf < CONFIDENCE_THRESHOLD:
            # Below threshold -> explicitly unknown
            self.temporal_buffer.add(None, None)
            alternatives = [
                PredictionAlternative(label=lbl, confidence=conf)
                for lbl, conf in scores[:3]
            ]
            return {
                "predicted_sign": None,
                "confidence_score": top_conf,
                "prediction_state": "unknown",
                "stability_score": 0.0,
                "recognition_message": (
                    f"Ambiguous sign posture (closest match '{top_sign}' scored {top_conf}%, "
                    f"below confident acceptance threshold of {CONFIDENCE_THRESHOLD}%)."
                ),
                "alternatives": alternatives,
            }

        # Record in temporal buffer
        self.temporal_buffer.add(top_sign, top_conf)
        stable_sign, state, stability_ratio = self.temporal_buffer.get_stability()

        alternatives = [
            PredictionAlternative(label=lbl, confidence=conf)
            for lbl, conf in scores[1:4]
        ]

        if state == "stable":
            msg = f"Stable recognition: '{stable_sign}' confirmed across temporal window."
        else:
            msg = f"Provisional recognition: '{top_sign}' detected (stabilizing across frames...)."

        return {
            "predicted_sign": stable_sign if state == "stable" else top_sign,
            "confidence_score": top_conf,
            "prediction_state": state,
            "stability_score": stability_ratio,
            "recognition_message": msg,
            "alternatives": alternatives,
        }

    def reset_temporal_window(self):
        self.temporal_buffer.clear()


recognition_service = SignRecognitionInferenceService()
