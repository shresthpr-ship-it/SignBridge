import io
import os
import sys
import pytest
import numpy as np
import cv2
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app
from app.services.vision_pipeline import vision_pipeline
from app.services.recognition_service import recognition_service
from app.services.dataset_service import dataset_service

client = TestClient(app)

# ---------------------------------------------------------------------------
# Section 1: System and Health Endpoints
# ---------------------------------------------------------------------------

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data
    assert "version" in data


def test_system_info_endpoint():
    response = client.get("/api/system/info")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert "backend_engine" in data
    assert "mediapipe_available" in data
    assert "samples_count" in data
    assert "classes_count" in data


# ---------------------------------------------------------------------------
# Section 2: Languages and Vocabulary / Classes
# ---------------------------------------------------------------------------

def test_list_languages():
    response = client.get("/api/dataset/languages")
    assert response.status_code == 200
    languages = response.json()
    assert isinstance(languages, list)
    assert len(languages) >= 5
    codes = [l["code"] for l in languages]
    assert "ASL" in codes
    assert "BSL" in codes
    assert "ISL" in codes


def test_create_and_delete_sign_class():
    test_class_name = "TestSignGesture_A"
    
    # 1. Create class
    create_resp = client.post(
        "/api/dataset/classes",
        json={
            "name": test_class_name,
            "category": "Testing",
            "description": "Automated unit test gesture class"
        }
    )
    assert create_resp.status_code == 200
    created = create_resp.json()
    assert created["name"] == test_class_name
    assert created["category"] == "Testing"

    # 2. Verify it appears in list
    list_resp = client.get("/api/dataset/classes")
    assert list_resp.status_code == 200
    names = [c["name"] for c in list_resp.json()]
    assert test_class_name in names

    # 3. Delete class
    del_resp = client.delete(f"/api/dataset/classes/{test_class_name}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"

    # 4. Verify deletion
    list_after = client.get("/api/dataset/classes").json()
    names_after = [c["name"] for c in list_after]
    assert test_class_name not in names_after


# ---------------------------------------------------------------------------
# Section 3: Samples Creation & Dataset Management
# ---------------------------------------------------------------------------

def test_create_sample_validation():
    # Attempt creating sample with insufficient landmarks (< 21 points)
    bad_sample = {
        "label": "TestGesture",
        "split": "train",
        "landmarks": [{"x": 0.5, "y": 0.5, "z": 0.0}] # only 1 point!
    }
    resp = client.post("/api/dataset/samples", json=bad_sample)
    assert resp.status_code == 400
    assert "21 landmark points" in resp.json()["detail"]


def test_create_valid_sample_and_retrieve():
    # Valid 21 landmarks
    valid_landmarks = [
        {"x": 0.5 + i * 0.01, "y": 0.5 + i * 0.01, "z": 0.0, "visibility": 1.0}
        for i in range(21)
    ]
    sample_data = {
        "label": "TestGesture_Valid",
        "split": "test",
        "landmarks": valid_landmarks,
        "notes": "Automated test landmark sequence",
        "device_info": "test-harness"
    }
    resp = client.post("/api/dataset/samples", json=sample_data)
    assert resp.status_code == 200
    sample = resp.json()
    assert sample["label"] == "TestGesture_Valid"
    assert sample["split"] == "test"
    sample_id = sample["id"]

    # Retrieve in filtered list
    list_resp = client.get(f"/api/dataset/samples?label=TestGesture_Valid")
    assert list_resp.status_code == 200
    samples = list_resp.json()
    assert any(s["id"] == sample_id for s in samples)

    # Clean up test sample
    del_resp = client.delete(f"/api/dataset/samples/{sample_id}")
    assert del_resp.status_code == 200


# ---------------------------------------------------------------------------
# Section 4: Dataset Quality Checks
# ---------------------------------------------------------------------------

def test_quality_issues_endpoint():
    resp = client.get("/api/dataset/quality/issues")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_issues" in data
    assert "issues" in data
    assert isinstance(data["issues"], list)


# ---------------------------------------------------------------------------
# Section 5: Dataset Exports (JSON and CSV)
# ---------------------------------------------------------------------------

def test_export_json_dataset():
    resp = client.get("/api/dataset/export?format=json")
    assert resp.status_code == 200
    assert "application/json" in resp.headers["content-type"]
    data = resp.json()
    assert "schema_version" in data
    assert "total_samples" in data
    assert "samples" in data
    assert isinstance(data["samples"], list)


def test_export_csv_dataset():
    resp = client.get("/api/dataset/export?format=csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    csv_text = resp.text
    # Verify header row has ID, label, split, and x_0..x_20 coordinates
    first_line = csv_text.splitlines()[0]
    assert "id,label,split" in first_line
    assert "x_0,y_0,z_0" in first_line
    assert "x_20,y_20,z_20" in first_line


def test_export_generate_metadata():
    resp = client.post("/api/dataset/export/generate?format=json&include_augmented=false")
    assert resp.status_code == 200
    data = resp.json()
    assert "export_id" in data
    assert data["format"] == "json"
    assert "download_url" in data
    assert data["status"] == "ready"


# ---------------------------------------------------------------------------
# Section 6: Computer Vision Pipeline & Landmark Extraction
# ---------------------------------------------------------------------------

def test_vision_pipeline_status():
    resp = client.get("/api/vision/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "mediapipe_available" in data
    assert "opencv_version" in data
    assert "engine" in data
    assert data["mediapipe_available"] is True


def test_vision_extract_image_rejection_of_invalid_files():
    # Empty file
    files = {"file": ("empty.png", b"", "image/png")}
    resp = client.post("/api/vision/extract-image", files=files)
    assert resp.status_code == 400

    # Corrupted / invalid image bytes
    corrupt_files = {"file": ("corrupt.png", b"NOT_AN_IMAGE_DATA_12345", "image/png")}
    resp2 = client.post("/api/vision/extract-image", files=corrupt_files)
    assert resp2.status_code == 400


def test_vision_extract_image_synthetic_blank_frame():
    # Generate blank dark frame (640x480 black image)
    blank_bgr = np.zeros((480, 640, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".png", blank_bgr)
    image_bytes = buf.tobytes()

    files = {"file": ("blank_frame.png", image_bytes, "image/png")}
    data = {"target_language": "ASL", "sign_label": "TestingBlank"}
    resp = client.post("/api/vision/extract-image", files=files, data=data)
    assert resp.status_code == 200
    result = resp.json()

    assert result["media_type"] == "image"
    assert result["total_frames"] == 1
    # On a blank black frame, MediaPipe should honestly report NO hand detection
    assert result["frames_with_detections"] == 0
    assert result["missing_detections"] == 1
    assert result["detection_rate_pct"] == 0.0
    frame_0 = result["frames"][0]
    assert frame_0["detection_status"] == "no_landmarks_detected"
    assert len(frame_0["hands"]) == 0


# ---------------------------------------------------------------------------
# Section 7: Live Gesture Recognition & Honest Thresholding
# ---------------------------------------------------------------------------

def test_recognition_model_status():
    resp = client.get("/api/recognition/status")
    assert resp.status_code == 200
    status = resp.json()
    assert "is_model_configured" in status
    assert "model_name" in status
    assert "tier" in status
    assert "capabilities" in status
    assert "limitations" in status
    assert "temporal_smoothing_window" in status


def test_recognition_predict_empty_input():
    # Predicting on empty landmarks list should return hand_detected=False
    resp = client.post("/api/recognition/predict", json={"landmarks": [], "top_k": 3})
    assert resp.status_code == 200
    res = resp.json()
    assert res["hand_detected"] is False
    assert res["label"] == "No Hand Detected"
    assert res["confidence"] == 0.0


def test_recognition_live_frame_blank_image():
    # Blank frame uploaded to /api/recognition/live-frame
    blank_bgr = np.zeros((480, 640, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", blank_bgr)
    frame_bytes = buf.tobytes()

    files = {"file": ("webcam_test.jpg", frame_bytes, "image/jpeg")}
    resp = client.post("/api/recognition/live-frame?top_k=3", files=files)
    assert resp.status_code == 200
    res = resp.json()
    assert res["hand_detected"] is False
    assert res["landmark_detection_status"] == "no_landmarks_detected"
    assert res["predicted_sign"] is None
    assert res["prediction_state"] == "no_hand"


# ---------------------------------------------------------------------------
# Section 8: Model Training Readiness & Training Endpoint
# ---------------------------------------------------------------------------

def test_training_readiness_status():
    resp = client.get("/api/recognition/training/status")
    assert resp.status_code == 200
    status = resp.json()
    assert "can_train" in status
    assert "minimum_samples_per_class" in status
    assert "viable_classes" in status
    assert "insufficient_classes" in status
    assert "training_pipeline" in status
