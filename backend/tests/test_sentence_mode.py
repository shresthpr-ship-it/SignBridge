"""
Automated Unit and Integration Tests for Sentence Mode API & Video Processing.
"""

import io
import sys
import tempfile
from pathlib import Path
import pytest
import numpy as np
import cv2
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app

client = TestClient(app)


def create_synthetic_test_video(num_frames: int = 15, width: int = 320, height: int = 240) -> bytes:
    """Creates a lightweight synthetic MP4 video in memory."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(tmp_path, fourcc, 15.0, (width, height))

    for i in range(num_frames):
        # Create dark frame with light circle moving
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        cx = int(width / 2 + 20 * np.sin(i / 3.0))
        cy = int(height / 2)
        cv2.circle(frame, (cx, cy), 25, (200, 200, 200), -1)
        out.write(frame)

    out.release()

    with open(tmp_path, "rb") as f:
        data = f.read()

    try:
        Path(tmp_path).unlink()
    except Exception:
        pass

    return data


def test_sentence_mode_status_endpoint():
    resp = client.get("/api/sentence-mode/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "operational"
    assert "ISL" in data["supported_languages"]
    assert "model_status" in data


def test_sentence_mode_history_endpoint():
    resp = client.get("/api/sentence-mode/history")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_sentence_mode_translate_empty_file_rejected():
    files = {"file": ("empty.webm", b"", "video/webm")}
    resp = client.post("/api/sentence-mode/translate", files=files, data={"target_language": "ISL"})
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


def test_sentence_mode_translate_synthetic_video():
    video_bytes = create_synthetic_test_video(num_frames=12)
    files = {"file": ("test_recording.mp4", video_bytes, "video/mp4")}
    resp = client.post(
        "/api/sentence-mode/translate",
        files=files,
        data={"target_language": "ISL"}
    )
    assert resp.status_code == 200
    res_data = resp.json()

    assert "session_id" in res_data
    assert res_data["target_language"] == "ISL"
    assert res_data["processed_frames"] > 0
    assert "recognition_task" in res_data
    assert "status" in res_data
    # In synthetic blank circle frame, no hands are present
    assert res_data["status"] == "no_hands_detected"
    assert "hands" in res_data["message"].lower()

    # Verify session is saved in history
    hist_resp = client.get("/api/sentence-mode/history")
    assert hist_resp.status_code == 200
    hist = hist_resp.json()
    assert len(hist) > 0
    assert hist[0]["session_id"] == res_data["session_id"]
