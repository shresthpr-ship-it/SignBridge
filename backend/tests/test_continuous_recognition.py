"""
Automated Unit and Integration Tests for Continuous Sign Recognition & Sentence Generation.
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app
from app.models import LandmarkPoint
from app.services.sentence_service import sentence_generation_service
from app.services.continuous_recognition_service import continuous_recognizer, SignToken

client = TestClient(app)


def test_sentence_generation_idiomatic_patterns():
    # 1. Greeting + Question
    res1 = sentence_generation_service.generate_sentence(["Hello", "How", "You"])
    assert res1.is_complete is True
    assert "Hello, how are you?" in res1.english_sentence
    assert "नमस्ते" in res1.hindi_sentence

    # 2. Daily Needs Compound (Eat + Drink)
    res2 = sentence_generation_service.generate_sentence(["Eat", "Drink"])
    assert "eat" in res2.english_sentence.lower()
    assert "drink" in res2.english_sentence.lower()
    assert "खाना" in res2.hindi_sentence
    assert "पानी" in res2.hindi_sentence

    # 3. Wh-Questions (Where + Help)
    res3 = sentence_generation_service.generate_sentence(["Where", "Help"])
    assert "help" in res3.english_sentence.lower()
    assert "where" in res3.english_sentence.lower()
    assert "मदद" in res3.hindi_sentence or "सहायता" in res3.hindi_sentence

    # 4. Emergency / Urgent (Help + Yes)
    res4 = sentence_generation_service.generate_sentence(["Help", "Yes"])
    assert "help" in res4.english_sentence.lower()
    assert "हाँ" in res4.hindi_sentence


def test_sentence_generation_single_token():
    res = sentence_generation_service.generate_sentence(["Namaste"])
    assert "Namaste" in res.hindi_phonetic or "Namaste" in res.english_sentence
    assert "नमस्ते" in res.hindi_sentence

    res_drink = sentence_generation_service.generate_sentence(["Drink"])
    assert "drink" in res_drink.english_sentence.lower()
    assert "पानी" in res_drink.hindi_sentence


def test_sentence_generation_arbitrary_sequence():
    res = sentence_generation_service.generate_sentence(["Hello", "What", "Drink", "Okay"])
    assert len(res.raw_sequence) == 4
    assert res.gloss_display == "HELLO · WHAT · DRINK · OKAY"
    assert len(res.english_sentence) > 0
    assert len(res.hindi_sentence) > 0


def test_continuous_recognizer_lifecycle():
    continuous_recognizer.reset_session()
    snap = continuous_recognizer.get_snapshot()
    assert snap.total_tokens_recognized == 0
    assert len(snap.active_sequence) == 0

    # Add manual tokens
    t1 = continuous_recognizer.add_token("Hello", confidence=95.0)
    assert t1.sign == "Hello"
    assert continuous_recognizer.get_snapshot().total_tokens_recognized == 1

    t2 = continuous_recognizer.add_token("Eat", confidence=94.0)
    assert t2.sign == "Eat"
    snap2 = continuous_recognizer.get_snapshot()
    assert snap2.total_tokens_recognized == 2
    assert snap2.generated_sentence is not None
    assert "Hello" in snap2.generated_sentence.english_sentence

    # Remove token
    removed = continuous_recognizer.remove_last_token()
    assert removed is not None
    assert removed.sign == "Eat"
    assert continuous_recognizer.get_snapshot().total_tokens_recognized == 1

    continuous_recognizer.reset_session()
    assert continuous_recognizer.get_snapshot().total_tokens_recognized == 0


def test_continuous_api_endpoints():
    # 1. Reset Session
    resp = client.post("/api/recognition/continuous-session/reset")
    assert resp.status_code == 200
    assert resp.json()["status"] == "session_reset"

    # 2. Get Session State
    get_resp = client.get("/api/recognition/continuous-session")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert "active_sequence" in data
    assert "motion_state" in data

    # 3. Add Manual Token
    add_resp = client.post(
        "/api/recognition/continuous-session/add-token",
        json={"sign": "Hello", "confidence": 96.0}
    )
    assert add_resp.status_code == 200
    assert add_resp.json()["token"]["sign"] == "Hello"

    # 4. Generate Sentence API
    gen_resp = client.post(
        "/api/recognition/generate-sentence",
        json={"tokens": ["Hello", "Where", "Help"]}
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()
    assert "english_sentence" in gen_data
    assert "hindi_sentence" in gen_data
    assert "gloss_display" in gen_data
    assert gen_data["gloss_display"] == "HELLO · WHERE · HELP"

    # 5. Remove Token
    rem_resp = client.post("/api/recognition/continuous-session/remove-token")
    assert rem_resp.status_code == 200
    assert rem_resp.json()["removed_token"]["sign"] == "Hello"
