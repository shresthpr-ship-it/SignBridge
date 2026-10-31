import json
from pathlib import Path

DATA_DIR = Path(r"C:\Users\Asus\.gemini\antigravity\scratch\signbridge\backend\app\data")
DATASET_FILE = DATA_DIR / "dataset.json"

with open(DATASET_FILE, "r", encoding="utf-8") as f:
    samples = json.load(f)

# Standardize labels to clean distinct classes
mapping = {
    "Theek Hai (Okay)": "Okay",
    "D'accord (Okay)": "Okay",
    "Haan (Yes)": "Yes",
    "Nahi (No)": "No",
    "BSL Okay": "Okay",
}

for s in samples:
    old_lbl = s.get("label", "")
    if old_lbl in mapping:
        s["label"] = mapping[old_lbl]

# Filter out low-sample or non-distinct duplicate test samples
distinct = {"Okay", "Hello", "Peace", "Yes", "No", "I Love You", "Point", "Help"}
clean_samples = [s for s in samples if s.get("label") in distinct and len(s.get("landmarks", [])) >= 21]

with open(DATASET_FILE, "w", encoding="utf-8") as f:
    json.dump(clean_samples, f, indent=2)

print(f"Cleaned dataset: {len(clean_samples)} samples across {len(distinct)} distinct classes.")
from collections import Counter
counts = Counter(s["label"] for s in clean_samples)
for k, v in counts.items():
    print(f"  {k}: {v} samples")
