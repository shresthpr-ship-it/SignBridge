import time
import math
from typing import List, Dict, Any, Tuple
from app.models import LandmarkPoint, RecognitionResponse, PredictionAlternative
from app.services.landmark_extractor import normalize_landmarks
from app.services.dataset_service import dataset_service

def euclidean_dist(v1: List[float], v2: List[float]) -> float:
    dist = 0.0
    for a, b in zip(v1, v2):
        d = a - b
        dist += d * d
    return math.sqrt(dist)

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot = 0.0
    mag1 = 0.0
    mag2 = 0.0
    for a, b in zip(v1, v2):
        dot += a * b
        mag1 += a * a
        mag2 += b * b
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot / (math.sqrt(mag1) * math.sqrt(mag2))

class RecognizerService:
    def __init__(self):
        self._cache_timestamp = 0.0
        self._class_centroids: Dict[str, List[float]] = {}
        self._refresh_centroids()

    def _refresh_centroids(self):
        samples = dataset_service.get_samples()
        grouped: Dict[str, List[List[float]]] = {}
        for s in samples:
            label = s["label"]
            raw_pts = [LandmarkPoint(**p) if isinstance(p, dict) else p for p in s.get("landmarks", [])]
            if len(raw_pts) >= 21:
                feat = normalize_landmarks(raw_pts)
                grouped.setdefault(label, []).append(feat)

        centroids = {}
        for label, feats in grouped.items():
            if not feats:
                continue
            dim = len(feats[0])
            centroid = [0.0] * dim
            for f in feats:
                for i in range(dim):
                    centroid[i] += f[i]
            for i in range(dim):
                centroid[i] /= len(feats)
            centroids[label] = centroid

        self._class_centroids = centroids
        self._cache_timestamp = time.time()

    def predict(self, raw_landmarks: List[LandmarkPoint], top_k: int = 3) -> RecognitionResponse:
        start_t = time.perf_counter()
        if not raw_landmarks or len(raw_landmarks) < 21:
            return RecognitionResponse(
                label="No Hand Detected",
                confidence=0.0,
                alternatives=[],
                latency_ms=round((time.perf_counter() - start_t) * 1000, 2),
                hand_detected=False
            )

        # Refresh centroids periodically or on demand
        if time.time() - self._cache_timestamp > 15:
            self._refresh_centroids()

        if not self._class_centroids:
            self._refresh_centroids()

        target_features = normalize_landmarks(raw_landmarks)

        # Score against all class centroids
        scores: List[Tuple[str, float]] = []
        for label, centroid in self._class_centroids.items():
            cos_sim = cosine_similarity(target_features, centroid)
            # Normalize cosine similarity [-1, 1] -> [0, 1]
            sim_score = max(0.0, min(1.0, (cos_sim + 1.0) / 2.0))
            
            # Combine with Euclidean proximity
            dist = euclidean_dist(target_features, centroid)
            dist_score = 1.0 / (1.0 + dist)

            combined_confidence = round((0.7 * sim_score + 0.3 * dist_score) * 100, 1)
            scores.append((label, combined_confidence))

        scores.sort(key=lambda x: x[1], reverse=True)

        if not scores:
            return RecognitionResponse(
                label="Unrecognized",
                confidence=0.0,
                alternatives=[],
                latency_ms=round((time.perf_counter() - start_t) * 1000, 2),
                hand_detected=True
            )

        top_match = scores[0]
        alternatives = [
            PredictionAlternative(label=lbl, confidence=conf)
            for lbl, conf in scores[1:top_k + 1]
        ]

        latency = round((time.perf_counter() - start_t) * 1000, 2)
        return RecognitionResponse(
            label=top_match[0],
            confidence=top_match[1],
            alternatives=alternatives,
            latency_ms=latency,
            hand_detected=True
        )

recognizer_service = RecognizerService()
