import json
import uuid
import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path
from app.config import settings
from app.models import SignClass, SignSample, DatasetStats, LandmarkPoint


# Canonical Hand Landmark templates (21 points normalized from 0.0 to 1.0)
def generate_canonical_landmarks(gesture_type: str) -> List[Dict[str, float]]:
    """Generates anatomically plausible 21-point hand landmark configurations."""
    # Base wrist
    pts = [{"x": 0.5, "y": 0.8, "z": 0.0}]

    if gesture_type == "open_palm":  # "Hello", "Stop", "Five"
        # Thumb
        pts += [{"x": 0.42, "y": 0.72, "z": -0.01}, {"x": 0.35, "y": 0.65, "z": -0.02}, {"x": 0.30, "y": 0.58, "z": -0.03}, {"x": 0.25, "y": 0.52, "z": -0.04}]
        # Index
        pts += [{"x": 0.45, "y": 0.55, "z": -0.01}, {"x": 0.44, "y": 0.42, "z": -0.01}, {"x": 0.43, "y": 0.32, "z": -0.01}, {"x": 0.42, "y": 0.22, "z": -0.01}]
        # Middle
        pts += [{"x": 0.50, "y": 0.54, "z": 0.0}, {"x": 0.50, "y": 0.40, "z": 0.0}, {"x": 0.50, "y": 0.28, "z": 0.0}, {"x": 0.50, "y": 0.18, "z": 0.0}]
        # Ring
        pts += [{"x": 0.55, "y": 0.56, "z": 0.01}, {"x": 0.56, "y": 0.43, "z": 0.01}, {"x": 0.57, "y": 0.33, "z": 0.01}, {"x": 0.58, "y": 0.24, "z": 0.01}]
        # Pinky
        pts += [{"x": 0.60, "y": 0.60, "z": 0.02}, {"x": 0.63, "y": 0.50, "z": 0.02}, {"x": 0.65, "y": 0.42, "z": 0.02}, {"x": 0.67, "y": 0.34, "z": 0.02}]

    elif gesture_type == "peace":  # "Peace", "Two", "V"
        # Thumb folded
        pts += [{"x": 0.44, "y": 0.70, "z": 0.02}, {"x": 0.46, "y": 0.65, "z": 0.03}, {"x": 0.48, "y": 0.62, "z": 0.04}, {"x": 0.50, "y": 0.60, "z": 0.04}]
        # Index extended
        pts += [{"x": 0.46, "y": 0.55, "z": -0.01}, {"x": 0.44, "y": 0.42, "z": -0.01}, {"x": 0.42, "y": 0.30, "z": -0.01}, {"x": 0.40, "y": 0.20, "z": -0.01}]
        # Middle extended spread
        pts += [{"x": 0.52, "y": 0.54, "z": 0.0}, {"x": 0.54, "y": 0.41, "z": 0.0}, {"x": 0.56, "y": 0.29, "z": 0.0}, {"x": 0.58, "y": 0.19, "z": 0.0}]
        # Ring curled
        pts += [{"x": 0.55, "y": 0.58, "z": 0.02}, {"x": 0.56, "y": 0.64, "z": 0.03}, {"x": 0.55, "y": 0.68, "z": 0.04}, {"x": 0.53, "y": 0.66, "z": 0.04}]
        # Pinky curled
        pts += [{"x": 0.60, "y": 0.62, "z": 0.02}, {"x": 0.61, "y": 0.67, "z": 0.03}, {"x": 0.59, "y": 0.70, "z": 0.04}, {"x": 0.56, "y": 0.68, "z": 0.04}]

    elif gesture_type == "thumbs_up":  # "Good", "Yes"
        # Thumb extended up
        pts += [{"x": 0.42, "y": 0.68, "z": -0.01}, {"x": 0.38, "y": 0.55, "z": -0.02}, {"x": 0.36, "y": 0.42, "z": -0.03}, {"x": 0.35, "y": 0.30, "z": -0.04}]
        # Fingers curled in fist
        for base_x in [0.48, 0.52, 0.56, 0.60]:
            pts += [
                {"x": base_x, "y": 0.58, "z": 0.02},
                {"x": base_x + 0.02, "y": 0.64, "z": 0.04},
                {"x": base_x + 0.01, "y": 0.68, "z": 0.05},
                {"x": base_x - 0.01, "y": 0.65, "z": 0.04}
            ]

    elif gesture_type == "fist":  # "Alphabet A", "No", "Tenacious"
        # Thumb resting along curled index
        pts += [{"x": 0.43, "y": 0.70, "z": 0.02}, {"x": 0.42, "y": 0.62, "z": 0.04}, {"x": 0.44, "y": 0.54, "z": 0.05}, {"x": 0.46, "y": 0.50, "z": 0.06}]
        # Curled fingers
        for base_x in [0.48, 0.52, 0.56, 0.60]:
            pts += [
                {"x": base_x, "y": 0.60, "z": 0.02},
                {"x": base_x + 0.02, "y": 0.66, "z": 0.04},
                {"x": base_x + 0.01, "y": 0.70, "z": 0.05},
                {"x": base_x - 0.01, "y": 0.68, "z": 0.04}
            ]

    elif gesture_type == "ily":  # "I Love You" (Thumb, Index, Pinky extended)
        # Thumb extended outward
        pts += [{"x": 0.40, "y": 0.70, "z": -0.02}, {"x": 0.32, "y": 0.62, "z": -0.03}, {"x": 0.26, "y": 0.55, "z": -0.04}, {"x": 0.20, "y": 0.48, "z": -0.05}]
        # Index extended up
        pts += [{"x": 0.46, "y": 0.55, "z": -0.01}, {"x": 0.45, "y": 0.42, "z": -0.01}, {"x": 0.44, "y": 0.30, "z": -0.01}, {"x": 0.43, "y": 0.20, "z": -0.01}]
        # Middle curled
        pts += [{"x": 0.52, "y": 0.58, "z": 0.03}, {"x": 0.53, "y": 0.65, "z": 0.04}, {"x": 0.51, "y": 0.69, "z": 0.05}, {"x": 0.48, "y": 0.67, "z": 0.04}]
        # Ring curled
        pts += [{"x": 0.56, "y": 0.60, "z": 0.03}, {"x": 0.57, "y": 0.66, "z": 0.04}, {"x": 0.55, "y": 0.70, "z": 0.05}, {"x": 0.52, "y": 0.68, "z": 0.04}]
        # Pinky extended up
        pts += [{"x": 0.60, "y": 0.62, "z": 0.0}, {"x": 0.63, "y": 0.50, "z": 0.0}, {"x": 0.65, "y": 0.40, "z": 0.0}, {"x": 0.68, "y": 0.30, "z": 0.0}]

    elif gesture_type == "okay":  # "Okay", "OK"
        # Thumb and Index tips touch to form a circle; Middle, Ring, Pinky extended upward
        pts += [
            {"x": 0.43, "y": 0.72, "z": -0.01},
            {"x": 0.40, "y": 0.63, "z": -0.02},
            {"x": 0.41, "y": 0.54, "z": -0.01},
            {"x": 0.44, "y": 0.48, "z": 0.00}   # Thumb tip (touches index tip)
        ]
        pts += [
            {"x": 0.46, "y": 0.56, "z": -0.01},
            {"x": 0.44, "y": 0.48, "z": -0.01},
            {"x": 0.43, "y": 0.46, "z": 0.00},
            {"x": 0.44, "y": 0.48, "z": 0.00}   # Index tip (touches thumb tip)
        ]
        pts += [
            {"x": 0.50, "y": 0.54, "z": 0.00},
            {"x": 0.50, "y": 0.40, "z": 0.00},
            {"x": 0.50, "y": 0.28, "z": 0.00},
            {"x": 0.50, "y": 0.16, "z": 0.00}   # Middle tip extended high
        ]
        pts += [
            {"x": 0.55, "y": 0.56, "z": 0.01},
            {"x": 0.56, "y": 0.43, "z": 0.01},
            {"x": 0.57, "y": 0.31, "z": 0.01},
            {"x": 0.58, "y": 0.20, "z": 0.01}   # Ring tip extended high
        ]
        pts += [
            {"x": 0.60, "y": 0.60, "z": 0.02},
            {"x": 0.62, "y": 0.48, "z": 0.02},
            {"x": 0.64, "y": 0.38, "z": 0.02},
            {"x": 0.66, "y": 0.28, "z": 0.02}   # Pinky tip extended high
        ]

    elif gesture_type == "point":  # "Pointing", "One", "D"
        pts += [
            {"x": 0.44, "y": 0.70, "z": 0.02},
            {"x": 0.46, "y": 0.65, "z": 0.03},
            {"x": 0.48, "y": 0.62, "z": 0.04},
            {"x": 0.50, "y": 0.60, "z": 0.04}
        ]
        pts += [
            {"x": 0.46, "y": 0.55, "z": -0.01},
            {"x": 0.45, "y": 0.40, "z": -0.01},
            {"x": 0.44, "y": 0.28, "z": -0.01},
            {"x": 0.43, "y": 0.16, "z": -0.01}
        ]
        pts += [
            {"x": 0.52, "y": 0.58, "z": 0.03},
            {"x": 0.53, "y": 0.65, "z": 0.04},
            {"x": 0.51, "y": 0.69, "z": 0.05},
            {"x": 0.48, "y": 0.67, "z": 0.04}
        ]
        pts += [
            {"x": 0.56, "y": 0.60, "z": 0.03},
            {"x": 0.57, "y": 0.66, "z": 0.04},
            {"x": 0.55, "y": 0.70, "z": 0.05},
            {"x": 0.52, "y": 0.68, "z": 0.04}
        ]
        pts += [
            {"x": 0.60, "y": 0.62, "z": 0.03},
            {"x": 0.61, "y": 0.67, "z": 0.03},
            {"x": 0.59, "y": 0.70, "z": 0.04},
            {"x": 0.56, "y": 0.68, "z": 0.04}
        ]

    else:  # Pointing index
        pts += [{"x": 0.44, "y": 0.70, "z": 0.02}, {"x": 0.46, "y": 0.65, "z": 0.03}, {"x": 0.48, "y": 0.62, "z": 0.04}, {"x": 0.50, "y": 0.60, "z": 0.04}]
        # Index pointing
        pts += [{"x": 0.46, "y": 0.55, "z": -0.01}, {"x": 0.45, "y": 0.40, "z": -0.01}, {"x": 0.44, "y": 0.28, "z": -0.01}, {"x": 0.43, "y": 0.16, "z": -0.01}]
        # Middle curled
        pts += [{"x": 0.52, "y": 0.58, "z": 0.03}, {"x": 0.53, "y": 0.65, "z": 0.04}, {"x": 0.51, "y": 0.69, "z": 0.05}, {"x": 0.48, "y": 0.67, "z": 0.04}]
        # Ring curled
        pts += [{"x": 0.56, "y": 0.60, "z": 0.03}, {"x": 0.57, "y": 0.66, "z": 0.04}, {"x": 0.55, "y": 0.70, "z": 0.05}, {"x": 0.52, "y": 0.68, "z": 0.04}]
        # Pinky curled
        pts += [{"x": 0.60, "y": 0.62, "z": 0.03}, {"x": 0.61, "y": 0.67, "z": 0.04}, {"x": 0.59, "y": 0.70, "z": 0.05}, {"x": 0.56, "y": 0.68, "z": 0.04}]

    return pts


class DatasetService:
    def __init__(self):
        self.classes_path = settings.CLASSES_FILE
        self.dataset_path = settings.DATASET_FILE
        self.activity_path = settings.DATA_DIR / "activity.json"
        self._init_storage()

    def _init_storage(self):
        if not self.classes_path.exists():
            default_classes = [
                {"id": "cls-hello", "name": "Hello", "category": "Greetings", "description": "Open hand waving or steady palm facing forward.", "sample_count": 0, "created_at": datetime.datetime.utcnow().isoformat()},
                {"id": "cls-thanks", "name": "Thank You", "category": "Greetings", "description": "Flat hand moving forward from chin or mouth.", "sample_count": 0, "created_at": datetime.datetime.utcnow().isoformat()},
                {"id": "cls-yes", "name": "Yes", "category": "Responses", "description": "Upward thumb gesture or nodding fist.", "sample_count": 0, "created_at": datetime.datetime.utcnow().isoformat()},
                {"id": "cls-no", "name": "No", "category": "Responses", "description": "Fist or index and middle snapping to thumb.", "sample_count": 0, "created_at": datetime.datetime.utcnow().isoformat()},
                {"id": "cls-peace", "name": "Peace", "category": "Conversational", "description": "Index and middle fingers forming a clear V sign.", "sample_count": 0, "created_at": datetime.datetime.utcnow().isoformat()},
                {"id": "cls-ily", "name": "I Love You", "category": "Conversational", "description": "Thumb, index, and pinky extended upward.", "sample_count": 0, "created_at": datetime.datetime.utcnow().isoformat()},
                {"id": "cls-help", "name": "Help", "category": "Emergency", "description": "Thumbs-up resting atop flat open palm.", "sample_count": 0, "created_at": datetime.datetime.utcnow().isoformat()},
                {"id": "cls-water", "name": "Water", "category": "Essentials", "description": "W-handshape tapped near mouth.", "sample_count": 0, "created_at": datetime.datetime.utcnow().isoformat()},
            ]
            self._save_json(self.classes_path, default_classes)

        if not self.dataset_path.exists():
            starter_samples = []
            seed_configs = [
                ("Hello", "open_palm", 8),
                ("Yes", "thumbs_up", 8),
                ("Peace", "peace", 8),
                ("I Love You", "ily", 8),
                ("No", "fist", 8),
            ]
            import random
            for label, g_type, count in seed_configs:
                base_pts = generate_canonical_landmarks(g_type)
                for i in range(count):
                    split = "train" if i < 6 else ("val" if i == 6 else "test")
                    # First 6 approved, 2 pending review to demonstrate review workflow out-of-the-box
                    review_status = "approved" if i < 6 else "pending_review"
                    jittered = []
                    for pt in base_pts:
                        jittered.append({
                            "x": round(pt["x"] + random.uniform(-0.015, 0.015), 4),
                            "y": round(pt["y"] + random.uniform(-0.015, 0.015), 4),
                            "z": round(pt["z"] + random.uniform(-0.005, 0.005), 4),
                            "visibility": 1.0
                        })
                    starter_samples.append({
                        "id": f"smp-{uuid.uuid4().hex[:8]}",
                        "label": label,
                        "split": split,
                        "landmarks": jittered,
                        "created_at": datetime.datetime.utcnow().isoformat(),
                        "device_info": "SignBridge-Calibrated-V1",
                        "notes": "Baseline calibrated seed sample",
                        "review_status": review_status,
                        "quality_score": round(random.uniform(0.92, 0.99), 2)
                    })
            self._save_json(self.dataset_path, starter_samples)
            self._recompute_class_counts()

        if not self.activity_path.exists():
            initial_activity = [
                {
                    "id": f"act-{uuid.uuid4().hex[:6]}",
                    "action": "Corpus Initialized",
                    "description": "Baseline calibrated gesture landmarks seeded for 5 core classes.",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "category": "system"
                },
                {
                    "id": f"act-{uuid.uuid4().hex[:6]}",
                    "action": "Classes Registered",
                    "description": "Registered 8 sign vocabulary classes across Greetings and Conversational categories.",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "category": "system"
                }
            ]
            self._save_json(self.activity_path, initial_activity)

    def _read_json(self, path: Path) -> List[Dict[str, Any]]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_json(self, path: Path, data: Any):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def log_activity(self, action: str, description: str, category: str = "capture"):
        activities = self._read_json(self.activity_path)
        activities.insert(0, {
            "id": f"act-{uuid.uuid4().hex[:6]}",
            "action": action,
            "description": description,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "category": category
        })
        if len(activities) > 50:
            activities = activities[:50]
        self._save_json(self.activity_path, activities)

    def get_activities(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self._read_json(self.activity_path)[:limit]

    def _recompute_class_counts(self):
        samples = self.get_samples()
        counts = {}
        for s in samples:
            label = s.get("label", "")
            counts[label] = counts.get(label, 0) + 1

        classes = self.get_classes()
        updated = False
        for c in classes:
            current = counts.get(c["name"], 0)
            if c.get("sample_count") != current:
                c["sample_count"] = current
                updated = True
        if updated:
            self._save_json(self.classes_path, classes)

    def get_classes(self) -> List[Dict[str, Any]]:
        return self._read_json(self.classes_path)

    def add_class(self, name: str, category: str = "General", description: str = "") -> Dict[str, Any]:
        classes = self.get_classes()
        for c in classes:
            if c["name"].lower() == name.strip().lower():
                return c
        new_class = {
            "id": f"cls-{uuid.uuid4().hex[:8]}",
            "name": name.strip(),
            "category": category.strip() or "General",
            "description": description.strip(),
            "sample_count": 0,
            "created_at": datetime.datetime.utcnow().isoformat()
        }
        classes.append(new_class)
        self._save_json(self.classes_path, classes)
        self.log_activity("Class Created", f"Added new sign label '{name}' in category '{category}'", "class")
        return new_class

    def get_samples(self, label: Optional[str] = None, split: Optional[str] = None, review_status: Optional[str] = None) -> List[Dict[str, Any]]:
        samples = self._read_json(self.dataset_path)
        # Ensure backwards-compatible fields
        for s in samples:
            if "review_status" not in s:
                s["review_status"] = "approved"
            if "quality_score" not in s:
                s["quality_score"] = 0.95

        if label:
            samples = [s for s in samples if s.get("label", "").lower() == label.lower()]
        if split:
            samples = [s for s in samples if s.get("split", "").lower() == split.lower()]
        if review_status:
            samples = [s for s in samples if s.get("review_status", "").lower() == review_status.lower()]
        return samples

    def add_sample(
        self,
        label: str,
        landmarks: List[Dict[str, Any]],
        split: str = "train",
        notes: str = "",
        device_info: str = "web-cam",
        review_status: str = "approved",
        quality_score: float = 0.96
    ) -> Dict[str, Any]:
        samples = self._read_json(self.dataset_path)
        new_sample = {
            "id": f"smp-{uuid.uuid4().hex[:8]}",
            "label": label,
            "split": split if split in ["train", "val", "test"] else "train",
            "landmarks": landmarks,
            "created_at": datetime.datetime.utcnow().isoformat(),
            "device_info": device_info,
            "notes": notes,
            "review_status": review_status,
            "quality_score": round(quality_score, 2)
        }
        samples.insert(0, new_sample)
        self._save_json(self.dataset_path, samples)
        self._recompute_class_counts()
        self.log_activity(
            "Sample Captured",
            f"Logged sample {new_sample['id']} for '{label}' [{split.upper()}]. Status: {review_status}",
            "capture"
        )
        return new_sample

    def update_review_status(self, sample_id: str, status: str, notes: Optional[str] = "") -> Optional[Dict[str, Any]]:
        samples = self._read_json(self.dataset_path)
        target = None
        for s in samples:
            if s["id"] == sample_id:
                s["review_status"] = status
                if notes:
                    s["notes"] = f"{s.get('notes', '')} | Review: {notes}".strip(" |")
                target = s
                break
        if target:
            self._save_json(self.dataset_path, samples)
            self.log_activity(
                f"Sample {status.capitalize()}",
                f"Sample {sample_id} ({target['label']}) was marked as {status}.",
                "review"
            )
        return target

    def augment_data(self, label: str, augmentation_type: str, count: int = 4) -> List[Dict[str, Any]]:
        import random
        source_samples = self.get_samples(label=label)
        if not source_samples:
            source_samples = self.get_samples()
        if not source_samples:
            return []

        created_samples = []
        for i in range(count):
            base_sample = random.choice(source_samples)
            base_lms = base_sample.get("landmarks", [])
            new_lms = []

            for pt in base_lms:
                x, y, z = pt["x"], pt["y"], pt.get("z", 0.0)
                if augmentation_type == "jitter":
                    x += random.uniform(-0.02, 0.02)
                    y += random.uniform(-0.02, 0.02)
                    z += random.uniform(-0.008, 0.008)
                elif augmentation_type == "scale":
                    factor = random.uniform(0.92, 1.08)
                    x = 0.5 + (x - 0.5) * factor
                    y = 0.5 + (y - 0.5) * factor
                    z = z * factor
                elif augmentation_type == "mirror":
                    # Horizontal reflection around center x=0.5
                    x = 1.0 - x
                new_lms.append({
                    "x": round(x, 4),
                    "y": round(y, 4),
                    "z": round(z, 4),
                    "visibility": 1.0
                })

            sample = self.add_sample(
                label=label,
                landmarks=new_lms,
                split="train",
                notes=f"Synthetic augmentation: {augmentation_type}",
                device_info="Augmentation-Engine",
                review_status="approved",
                quality_score=round(random.uniform(0.90, 0.96), 2)
            )
            created_samples.append(sample)

        self.log_activity(
            "Batch Augmentation",
            f"Generated {count} augmented samples for '{label}' via {augmentation_type} transform.",
            "augmentation"
        )
        return created_samples

    def delete_sample(self, sample_id: str) -> bool:
        samples = self._read_json(self.dataset_path)
        initial_len = len(samples)
        deleted_sample = next((s for s in samples if s["id"] == sample_id), None)
        samples = [s for s in samples if s["id"] != sample_id]
        if len(samples) < initial_len:
            self._save_json(self.dataset_path, samples)
            self._recompute_class_counts()
            if deleted_sample:
                self.log_activity(
                    "Sample Deleted",
                    f"Removed sample {sample_id} ({deleted_sample.get('label')}) from corpus.",
                    "system"
                )
            return True
        return False

    def get_stats(self) -> DatasetStats:
        samples = self.get_samples()
        classes = self.get_classes()
        split_distribution = {"train": 0, "val": 0, "test": 0}
        class_distribution = {}

        for c in classes:
            class_distribution[c["name"]] = 0

        pending_count = 0
        approved_count = 0
        rejected_count = 0

        for s in samples:
            sp = s.get("split", "train")
            split_distribution[sp] = split_distribution.get(sp, 0) + 1
            lbl = s.get("label", "Unknown")
            class_distribution[lbl] = class_distribution.get(lbl, 0) + 1

            status = s.get("review_status", "approved")
            if status == "pending_review":
                pending_count += 1
            elif status == "rejected":
                rejected_count += 1
            else:
                approved_count += 1

        total_samples = len(samples)
        unique_labels = len([k for k, v in class_distribution.items() if v > 0])
        total_classes = len(classes)
        avg = round(total_samples / total_classes, 2) if total_classes > 0 else 0.0

        return DatasetStats(
            total_samples=total_samples,
            unique_labels=unique_labels,
            pending_review=pending_count,
            approved_samples=approved_count,
            rejected_samples=rejected_count,
            split_distribution=split_distribution,
            class_distribution=class_distribution,
            avg_samples_per_class=avg
        )

dataset_service = DatasetService()
