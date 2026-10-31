import json
import uuid
import datetime
import random
from pathlib import Path

# Paths
DATA_DIR = Path(__file__).resolve().parent / "app" / "data"
CLASSES_FILE = DATA_DIR / "classes.json"
DATASET_FILE = DATA_DIR / "dataset.json"

from app.services.dataset_service import generate_canonical_landmarks
from app.services.landmark_extractor import normalize_landmarks
from app.models import LandmarkPoint

# 1. Pre-available languages and vocabularies
PRESET_CLASSES = [
    # ASL (American Sign Language)
    {"name": "Okay", "language": "ASL", "category": "Conversational", "description": "Thumb and index tips touching to form a circular O, middle, ring, pinky extended upward."},
    {"name": "Hello", "language": "ASL", "category": "Greetings", "description": "Open hand facing forward."},
    {"name": "Thank You", "language": "ASL", "category": "Greetings", "description": "Flat hand moving forward from chin or mouth."},
    {"name": "Yes", "language": "ASL", "category": "Responses", "description": "Thumbs-up or nodding fist."},
    {"name": "No", "language": "ASL", "category": "Responses", "description": "Closed fist or index and middle snapping to thumb."},
    {"name": "Peace", "language": "ASL", "category": "Conversational", "description": "Index and middle fingers forming a clear V sign."},
    {"name": "I Love You", "language": "ASL", "category": "Conversational", "description": "Thumb, index, and pinky extended upward."},
    {"name": "Help", "language": "ASL", "category": "Emergency", "description": "Thumbs-up resting atop flat open palm."},
    {"name": "Stop", "language": "ASL", "category": "Actions", "description": "Open palm extended vertically facing forward."},
    {"name": "Point", "language": "ASL", "category": "Numbers", "description": "Index finger pointing up, others curled in fist."},

    # ISL (Indian Sign Language)
    {"name": "Namaste", "language": "ISL", "category": "Greetings", "description": "Formal greeting with upright palm or hands near chest."},
    {"name": "Theek Hai (Okay)", "language": "ISL", "category": "Conversational", "description": "Standard OK handshape indicating agreement."},
    {"name": "Haan (Yes)", "language": "ISL", "category": "Responses", "description": "Affirmative thumb up gesture."},
    {"name": "Nahi (No)", "language": "ISL", "category": "Responses", "description": "Negative fist shake or closed hand."},
    {"name": "Shukriya", "language": "ISL", "category": "Greetings", "description": "Thank you gesture from chin."},
    {"name": "Madad (Help)", "language": "ISL", "category": "Emergency", "description": "Supportive fist on palm for emergency."},

    # BSL (British Sign Language)
    {"name": "Cheers", "language": "BSL", "category": "Greetings", "description": "Thumbs-up or casual thank you handshape."},
    {"name": "BSL Okay", "language": "BSL", "category": "Conversational", "description": "OK ring handshape indicating confirmation."},

    # LSF (Langue des Signes Française)
    {"name": "Bonjour", "language": "LSF", "category": "Greetings", "description": "Hand moving from chin forward."},
    {"name": "D'accord (Okay)", "language": "LSF", "category": "Conversational", "description": "Index and thumb circle with fingers up."}
]

# Read existing classes
classes = []
if CLASSES_FILE.exists():
    with open(CLASSES_FILE, "r", encoding="utf-8") as f:
        classes = json.load(f)

existing_names = {c["name"] for c in classes}
for item in PRESET_CLASSES:
    if item["name"] not in existing_names:
        classes.append({
            "id": f"cls-{uuid.uuid4().hex[:8]}",
            "name": item["name"],
            "language": item["language"],
            "category": item["category"],
            "description": item["description"],
            "sample_count": 0,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })

with open(CLASSES_FILE, "w", encoding="utf-8") as f:
    json.dump(classes, f, indent=2)
print(f"Updated classes: {len(classes)} total classes registered.")

# Read existing dataset
samples = []
if DATASET_FILE.exists():
    with open(DATASET_FILE, "r", encoding="utf-8") as f:
        samples = json.load(f)

# Seed gesture landmark templates with variations
NEW_SEEDS = [
    ("Okay", "okay", "ASL", 15),
    ("Theek Hai (Okay)", "okay", "ISL", 10),
    ("D'accord (Okay)", "okay", "LSF", 10),
    ("Point", "point", "ASL", 12),
    ("Stop", "open_palm", "ASL", 12),
    ("Namaste", "open_palm", "ISL", 12),
    ("Hello", "open_palm", "ASL", 12),
    ("Yes", "thumbs_up", "ASL", 12),
    ("Haan (Yes)", "thumbs_up", "ISL", 10),
    ("Peace", "peace", "ASL", 12),
    ("I Love You", "ily", "ASL", 12),
    ("No", "fist", "ASL", 12),
    ("Nahi (No)", "fist", "ISL", 10),
]

for label, g_type, lang, count in NEW_SEEDS:
    existing_count = sum(1 for s in samples if s.get("label") == label)
    needed = max(0, count - existing_count)
    if needed > 0:
        base_pts = generate_canonical_landmarks(g_type)
        for i in range(needed):
            jittered = []
            for pt in base_pts:
                jittered.append({
                    "x": round(pt["x"] + random.uniform(-0.012, 0.012), 4),
                    "y": round(pt["y"] + random.uniform(-0.012, 0.012), 4),
                    "z": round(pt.get("z", 0.0) + random.uniform(-0.005, 0.005), 4),
                    "visibility": 1.0
                })
            samples.append({
                "id": f"smp-{uuid.uuid4().hex[:8]}",
                "label": label,
                "language": lang,
                "split": "train" if i < int(needed * 0.8) else "test",
                "landmarks": jittered,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "device_info": "SignBridge-MultiLang-Seeder",
                "notes": f"Calibrated {g_type} handshape for {lang}",
                "review_status": "approved",
                "quality_score": round(random.uniform(0.95, 0.99), 2)
            })

with open(DATASET_FILE, "w", encoding="utf-8") as f:
    json.dump(samples, f, indent=2)

# Update class sample counts
counts = {}
for s in samples:
    lbl = s.get("label", "")
    counts[lbl] = counts.get(lbl, 0) + 1

for c in classes:
    c["sample_count"] = counts.get(c["name"], 0)

with open(CLASSES_FILE, "w", encoding="utf-8") as f:
    json.dump(classes, f, indent=2)

print(f"Dataset updated: {len(samples)} total samples. Counts:")
for k, v in sorted(counts.items(), key=lambda x: -x[1])[:10]:
    print(f"  {k}: {v} samples")
