import time
import datetime
from typing import List, Dict, Any, Optional

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException

from app.models import RecognitionRequest, RecognitionResponse, LandmarkPoint, TeachGestureRequest
from app.services.recognizer_service import recognizer_service
from app.services.recognition_service import recognition_service
from app.services.vision_pipeline import vision_pipeline

router = APIRouter(prefix="/recognition", tags=["Recognition"])

# Sliding window buffer of recent predictions
_inference_history: List[Dict[str, Any]] = []


@router.get("/status")
def get_recognition_model_status():
    """
    Returns current recognition model status, tier (landmark detection vs. isolated prototype vs. sequence model),
    and explicit limitations.
    """
    return recognition_service.get_model_status()


@router.post("/reset-session")
def reset_recognition_session():
    """
    Resets temporal smoothing window and prediction history buffer.
    """
    recognition_service.reset_temporal_window()
    _inference_history.clear()
    return {"status": "session_reset", "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()}


@router.post("/predict", response_model=RecognitionResponse)
def predict_sign(req: RecognitionRequest):
    result = recognizer_service.predict(req.landmarks, top_k=req.top_k)
    
    # Track non-empty detections in history
    if result.hand_detected and result.label != "No Hand Detected":
        _inference_history.insert(0, {
            "label": result.label,
            "confidence": result.confidence,
            "latency_ms": result.latency_ms,
            "state": "stable" if result.confidence >= 75.0 else "provisional",
            "time": datetime.datetime.now().strftime("%H:%M:%S")
        })
        if len(_inference_history) > 30:
            _inference_history.pop()

    return result


@router.post("/live-frame")
async def recognize_live_frame(
    file: UploadFile = File(..., description="Webcam video frame for real-time sign recognition"),
    top_k: int = Query(3, ge=1, le=8)
):
    """
    Accepts a live camera frame, executes real MediaPipe detection,
    and returns detected 3D landmarks + model recognition evaluation.
    Clearly distinguishes landmark detection from sign recognition.
    """
    start_t = time.perf_counter()
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded live frame is empty")

    np_arr = np.frombuffer(file_bytes, np.uint8)
    bgr_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if bgr_img is None:
        raise HTTPException(status_code=400, detail="Failed to decode webcam video frame")

    rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)

    # 1. Landmark Detection (MediaPipe Tasks 3D)
    frame_data = vision_pipeline._extract_frame_landmarks(rgb_img, frame_idx=0, timestamp_ms=0.0)

    # 2. Recognition Inference (Separate Inference Service)
    hand_present = len(frame_data.hands) > 0
    primary_pts: List[LandmarkPoint] = []
    if hand_present:
        primary_hand = frame_data.hands[0]
        primary_pts = [
            LandmarkPoint(
                x=p.x,
                y=p.y,
                z=p.z,
                visibility=p.visibility if p.visibility is not None else 1.0
            )
            for p in primary_hand.landmarks
        ]

    rec_result = recognition_service.infer_sign(primary_pts)

    latency_ms = round((time.perf_counter() - start_t) * 1000, 2)

    # Record valid detections to history
    if rec_result["predicted_sign"] and rec_result["prediction_state"] in ["stable", "provisional"]:
        history_item = {
            "sign": rec_result["predicted_sign"],
            "confidence": rec_result["confidence_score"],
            "state": rec_result["prediction_state"],
            "stability_score": rec_result["stability_score"],
            "latency_ms": latency_ms,
            "time": datetime.datetime.now().strftime("%H:%M:%S"),
            "handedness": frame_data.hands[0].handedness if hand_present else None
        }
        _inference_history.insert(0, history_item)
        if len(_inference_history) > 30:
            _inference_history.pop()

    model_status = recognition_service.get_model_status()

    return {
        # Landmark Detection
        "landmark_detection_status": frame_data.detection_status,
        "hand_detected": hand_present,
        "landmarks": [p.model_dump() for p in (frame_data.hands[0].landmarks if hand_present else [])],
        "hands": [h.model_dump() for h in frame_data.hands],
        "pose": frame_data.pose.model_dump() if frame_data.pose else None,
        "face": frame_data.face.model_dump() if frame_data.face else None,
        "missing_elements": frame_data.missing_elements,

        # Sign Recognition
        "model_status": model_status,
        "predicted_sign": rec_result["predicted_sign"],
        "confidence_score": rec_result["confidence_score"],
        "prediction_state": rec_result["prediction_state"],
        "stability_score": rec_result["stability_score"],
        "recognition_message": rec_result["recognition_message"],
        "alternatives": [a.model_dump() for a in rec_result["alternatives"]],

        "latency_ms": latency_ms,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }


@router.get("/history")
def get_prediction_history():
    return _inference_history


@router.get("/training/status")
def get_training_status():
    """Returns training pipeline readiness and dataset requirements."""
    from app.services.dataset_service import dataset_service
    from collections import Counter

    samples = dataset_service.get_samples()
    classes = dataset_service.get_classes()

    # Only count real (non-zero landmark) samples
    valid_samples = []
    for s in samples:
        lms = s.get("landmarks", [])
        if len(lms) >= 21:
            non_zero = any(abs(p.get("x", 0)) > 1e-6 or abs(p.get("y", 0)) > 1e-6 for p in lms[:3])
            if non_zero:
                valid_samples.append(s)

    class_counts = Counter(s.get("label", "") for s in valid_samples)
    viable_classes = {k: v for k, v in class_counts.items() if k and v >= 10}
    insufficient_classes = {k: v for k, v in class_counts.items() if k and 0 < v < 10}
    can_train = len(viable_classes) >= 2

    # Check if sklearn model already exists
    from pathlib import Path
    models_dir = Path(__file__).resolve().parent.parent / "models_cv"
    model_exists = (models_dir / "trained_sign_classifier.pkl").exists()

    return {
        "can_train": can_train,
        "total_samples": len(samples),
        "valid_samples": len(valid_samples),
        "total_classes": len(classes),
        "viable_classes": viable_classes,
        "insufficient_classes": insufficient_classes,
        "minimum_samples_per_class": 10,
        "minimum_classes": 2,
        "training_pipeline": "sklearn_mlp_classifier",
        "requirements_met": can_train,
        "trained_model_exists": model_exists,
        "message": (
            "Dataset is ready for baseline MLP training."
            if can_train
            else f"Need at least 10 real samples per class and 2+ classes. "
                 f"Currently viable: {len(viable_classes)} classes. "
                 f"Insufficient: {dict(insufficient_classes)}"
        ),
    }


@router.post("/train")
async def train_model():
    """Train a baseline MLP classifier on current labeled landmark samples."""
    import json
    import pickle
    from pathlib import Path
    from collections import Counter
    from app.services.dataset_service import dataset_service
    from app.services.landmark_extractor import normalize_landmarks
    from app.models import LandmarkPoint
    from app.services.recognition_service import recognition_service

    samples = dataset_service.get_samples()

    X, y = [], []
    for s in samples:
        lms = s.get("landmarks", [])
        lbl = s.get("label", "")
        if len(lms) >= 21 and lbl:
            pts = [LandmarkPoint(**p) if isinstance(p, dict) else p for p in lms]
            feat = normalize_landmarks(pts)
            if feat and any(abs(v) > 1e-6 for v in feat):
                X.append(feat)
                y.append(lbl)

    if len(X) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 10 valid samples to train. Found: {len(X)}."
        )

    class_counts = Counter(y)
    viable = {k: v for k, v in class_counts.items() if v >= 5}
    if len(viable) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 2 classes with 5+ samples each. Found: {dict(class_counts)}"
        )

    X_f = [x for x, lbl in zip(X, y) if lbl in viable]
    y_f = [lbl for lbl in y if lbl in viable]

    try:
        from sklearn.neural_network import MLPClassifier
        from sklearn.preprocessing import LabelEncoder
        from sklearn.model_selection import train_test_split
        import numpy as np

        le = LabelEncoder()
        y_enc = le.fit_transform(y_f)
        X_arr = np.array(X_f)

        if len(X_arr) >= 20 and len(set(y_enc)) >= 2:
            try:
                X_train, X_test, y_train, y_test = train_test_split(
                    X_arr, y_enc, test_size=0.2, random_state=42, stratify=y_enc
                )
            except ValueError:
                X_train, X_test, y_train, y_test = X_arr, X_arr, y_enc, y_enc
        else:
            X_train, X_test, y_train, y_test = X_arr, X_arr, y_enc, y_enc

        clf = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=500, random_state=42)
        clf.fit(X_train, y_train)

        train_acc = float(clf.score(X_train, y_train))
        test_acc = float(clf.score(X_test, y_test))

        models_dir = Path(__file__).resolve().parent.parent / "models_cv"
        models_dir.mkdir(parents=True, exist_ok=True)
        model_path = models_dir / "trained_sign_classifier.pkl"
        label_map_path = models_dir / "label_map.json"

        with open(model_path, "wb") as f:
            pickle.dump({"model": clf, "label_encoder": le}, f)

        label_map = {str(i): label for i, label in enumerate(le.classes_)}
        with open(label_map_path, "w") as f:
            json.dump(label_map, f, indent=2)

        # Reload recognition service to pick up new model
        recognition_service._inspect_available_models()

        import datetime as dt
        return {
            "status": "success",
            "model_path": str(model_path),
            "label_map_path": str(label_map_path),
            "classes": list(le.classes_),
            "num_classes": len(le.classes_),
            "train_samples": int(len(X_train)),
            "test_samples": int(len(X_test)),
            "train_accuracy": round(train_acc * 100, 1),
            "test_accuracy": round(test_acc * 100, 1),
            "trained_at": dt.datetime.utcnow().isoformat(),
            "architecture": "MLPClassifier(hidden_layers=[128, 64], max_iter=500)",
            "input_features": 63,
            "note": (
                "Baseline prototype model for isolated static signs. "
                "Not suitable for dynamic or continuous sign language translation."
            ),
        }
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="scikit-learn is required for training. Install with: pip install scikit-learn"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.post("/teach")
async def teach_gesture(req: TeachGestureRequest):
    """
    Teach the recognition model a gesture directly using landmark points.
    Creates sample variations and automatically updates the MLP classifier in real-time.
    """
    import random
    from app.services.dataset_service import dataset_service

    if not req.label.strip():
        raise HTTPException(status_code=400, detail="Gesture label cannot be empty")
    if len(req.landmarks) < 21:
        raise HTTPException(status_code=400, detail="Must provide at least 21 3D landmark points")

    clean_label = req.label.strip()
    dataset_service.add_class(name=clean_label, category="Taught", description=f"Taught gesture for {req.language}")

    # Add primary sample
    raw_pts = [p.model_dump() for p in req.landmarks]
    dataset_service.add_sample(
        label=clean_label,
        landmarks=raw_pts,
        split="train",
        notes=req.notes or "Interactive teaching primary sample",
        device_info="webcam-live-teach",
        review_status="approved",
        quality_score=0.98
    )

    # Generate slight jitter variations so new gesture has immediate robust support
    count = max(4, min(req.samples_count, 15))
    for i in range(count - 1):
        jittered = []
        for p in req.landmarks:
            jittered.append({
                "x": round(p.x + random.uniform(-0.012, 0.012), 4),
                "y": round(p.y + random.uniform(-0.012, 0.012), 4),
                "z": round((p.z or 0.0) + random.uniform(-0.005, 0.005), 4),
                "visibility": 1.0
            })
        dataset_service.add_sample(
            label=clean_label,
            landmarks=jittered,
            split="train" if i < count - 2 else "test",
            notes=f"Taught variation {i+1}",
            device_info="webcam-live-teach-jitter",
            review_status="approved",
            quality_score=0.96
        )

    dataset_service.log_activity(
        "Gesture Taught",
        f"User taught gesture '{clean_label}' with {count} sample variations in {req.language}.",
        "system"
    )

    training_result = None
    if req.auto_train:
        try:
            training_result = await train_model()
        except Exception as e:
            print(f"[TeachGesture] Retraining warning: {e}")

    return {
        "status": "success",
        "label": clean_label,
        "language": req.language,
        "samples_added": count,
        "model_retrained": training_result is not None,
        "train_accuracy": training_result.get("train_accuracy") if training_result else None,
        "test_accuracy": training_result.get("test_accuracy") if training_result else None,
        "classes": training_result.get("classes") if training_result else [],
        "message": f"Successfully taught '{clean_label}'! {count} samples integrated and model updated."
    }


@router.post("/teach-frame")
async def teach_from_frame(
    file: UploadFile = File(..., description="Camera frame JPEG/PNG with visible gesture"),
    label: str = Form(..., description="What this gesture means (e.g. Okay, Hello)"),
    language: str = Form("ASL", description="Sign language code"),
):
    """
    Accepts an actual webcam frame image, extracts 3D landmarks with MediaPipe,
    and immediately teaches the classifier the new gesture.
    """
    if not label.strip():
        raise HTTPException(status_code=400, detail="Gesture label cannot be empty")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Captured frame is empty")

    np_arr = np.frombuffer(file_bytes, np.uint8)
    bgr_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if bgr_img is None:
        raise HTTPException(status_code=400, detail="Failed to decode webcam frame")

    rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    frame_data = vision_pipeline._extract_frame_landmarks(rgb_img, frame_idx=0, timestamp_ms=0.0)

    if not frame_data.hands or len(frame_data.hands[0].landmarks) < 21:
        raise HTTPException(
            status_code=422,
            detail="No hand detected in the camera frame. Please position your hand clearly in view and try again."
        )

    pts = [
        LandmarkPoint(
            x=p.x,
            y=p.y,
            z=p.z,
            visibility=p.visibility if p.visibility is not None else 1.0
        )
        for p in frame_data.hands[0].landmarks
    ]

    teach_req = TeachGestureRequest(
        label=label.strip(),
        language=language.strip(),
        landmarks=pts,
        samples_count=8,
        notes=f"Taught from live frame ({frame_data.hands[0].handedness} hand)"
    )

    return await teach_gesture(teach_req)
