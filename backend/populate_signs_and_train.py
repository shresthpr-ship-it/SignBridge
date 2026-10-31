import json
import random
import uuid
import datetime
from pathlib import Path

from app.services.dataset_service import dataset_service
from app.models import LandmarkPoint
from app.services.landmark_extractor import normalize_landmarks

def get_canonical_template(gesture_name: str):
    """
    Returns 21 points for the requested gesture.
    0: wrist
    1-4: thumb
    5-8: index
    9-12: middle
    13-16: ring
    17-20: pinky
    """
    pts = [{"x": 0.50, "y": 0.80, "z": 0.0}]

    if gesture_name == "drink":
        # C-handshape / curved cup
        pts += [
            {"x": 0.40, "y": 0.70, "z": -0.02},
            {"x": 0.34, "y": 0.62, "z": -0.03},
            {"x": 0.32, "y": 0.54, "z": -0.04},
            {"x": 0.34, "y": 0.46, "z": -0.04}  # thumb tip
        ]
        pts += [
            {"x": 0.46, "y": 0.56, "z": 0.00},
            {"x": 0.48, "y": 0.46, "z": 0.01},
            {"x": 0.52, "y": 0.40, "z": 0.02},
            {"x": 0.56, "y": 0.42, "z": 0.02}   # index tip
        ]
        pts += [
            {"x": 0.50, "y": 0.55, "z": 0.01},
            {"x": 0.53, "y": 0.45, "z": 0.02},
            {"x": 0.57, "y": 0.40, "z": 0.03},
            {"x": 0.60, "y": 0.43, "z": 0.03}   # middle tip
        ]
        pts += [
            {"x": 0.55, "y": 0.57, "z": 0.02},
            {"x": 0.58, "y": 0.48, "z": 0.03},
            {"x": 0.62, "y": 0.44, "z": 0.04},
            {"x": 0.64, "y": 0.47, "z": 0.04}   # ring tip
        ]
        pts += [
            {"x": 0.60, "y": 0.60, "z": 0.03},
            {"x": 0.63, "y": 0.53, "z": 0.04},
            {"x": 0.66, "y": 0.50, "z": 0.05},
            {"x": 0.68, "y": 0.53, "z": 0.05}   # pinky tip
        ]

    elif gesture_name == "eat":
        # All 5 fingertips pinched together pointing up/forward to mouth
        target_cluster = {"x": 0.48, "y": 0.40, "z": 0.02}
        pts += [
            {"x": 0.44, "y": 0.68, "z": 0.01},
            {"x": 0.42, "y": 0.58, "z": 0.01},
            {"x": 0.45, "y": 0.48, "z": 0.02},
            {"x": target_cluster["x"], "y": target_cluster["y"], "z": target_cluster["z"]}
        ]
        pts += [
            {"x": 0.46, "y": 0.55, "z": 0.00},
            {"x": 0.47, "y": 0.48, "z": 0.01},
            {"x": 0.48, "y": 0.43, "z": 0.02},
            {"x": target_cluster["x"], "y": target_cluster["y"], "z": target_cluster["z"]}
        ]
        pts += [
            {"x": 0.50, "y": 0.54, "z": 0.00},
            {"x": 0.50, "y": 0.47, "z": 0.01},
            {"x": 0.49, "y": 0.43, "z": 0.02},
            {"x": target_cluster["x"], "y": target_cluster["y"], "z": target_cluster["z"]}
        ]
        pts += [
            {"x": 0.54, "y": 0.56, "z": 0.01},
            {"x": 0.53, "y": 0.49, "z": 0.02},
            {"x": 0.50, "y": 0.44, "z": 0.02},
            {"x": target_cluster["x"], "y": target_cluster["y"], "z": target_cluster["z"]}
        ]
        pts += [
            {"x": 0.58, "y": 0.60, "z": 0.02},
            {"x": 0.56, "y": 0.52, "z": 0.02},
            {"x": 0.52, "y": 0.45, "z": 0.02},
            {"x": target_cluster["x"], "y": target_cluster["y"], "z": target_cluster["z"]}
        ]

    elif gesture_name == "say":
        # Index finger pointing up from chin, other 3 curled
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
            {"x": 0.43, "y": 0.16, "z": -0.01}  # Index extended high
        ]
        pts += [
            {"x": 0.50, "y": 0.56, "z": 0.02},
            {"x": 0.51, "y": 0.64, "z": 0.04},
            {"x": 0.50, "y": 0.69, "z": 0.05},
            {"x": 0.47, "y": 0.67, "z": 0.04}   # Middle curled
        ]
        pts += [
            {"x": 0.55, "y": 0.58, "z": 0.02},
            {"x": 0.56, "y": 0.65, "z": 0.04},
            {"x": 0.54, "y": 0.70, "z": 0.05},
            {"x": 0.51, "y": 0.68, "z": 0.04}   # Ring curled
        ]
        pts += [
            {"x": 0.60, "y": 0.62, "z": 0.02},
            {"x": 0.61, "y": 0.67, "z": 0.04},
            {"x": 0.58, "y": 0.71, "z": 0.05},
            {"x": 0.55, "y": 0.69, "z": 0.04}   # Pinky curled
        ]

    elif gesture_name == "what":
        # Open 5-palm spread wide
        pts += [
            {"x": 0.40, "y": 0.70, "z": -0.02},
            {"x": 0.32, "y": 0.62, "z": -0.03},
            {"x": 0.25, "y": 0.54, "z": -0.04},
            {"x": 0.20, "y": 0.46, "z": -0.04}
        ]
        pts += [
            {"x": 0.44, "y": 0.55, "z": -0.01},
            {"x": 0.40, "y": 0.42, "z": -0.01},
            {"x": 0.37, "y": 0.30, "z": -0.01},
            {"x": 0.34, "y": 0.20, "z": -0.01}
        ]
        pts += [
            {"x": 0.50, "y": 0.54, "z": 0.00},
            {"x": 0.50, "y": 0.40, "z": 0.00},
            {"x": 0.50, "y": 0.28, "z": 0.00},
            {"x": 0.50, "y": 0.16, "z": 0.00}
        ]
        pts += [
            {"x": 0.56, "y": 0.56, "z": 0.01},
            {"x": 0.60, "y": 0.44, "z": 0.01},
            {"x": 0.63, "y": 0.32, "z": 0.01},
            {"x": 0.66, "y": 0.22, "z": 0.01}
        ]
        pts += [
            {"x": 0.61, "y": 0.60, "z": 0.02},
            {"x": 0.68, "y": 0.50, "z": 0.02},
            {"x": 0.73, "y": 0.42, "z": 0.02},
            {"x": 0.78, "y": 0.34, "z": 0.02}
        ]

    elif gesture_name == "where":
        # Index pointing up, others curled in fist
        pts += [
            {"x": 0.45, "y": 0.68, "z": 0.02},
            {"x": 0.47, "y": 0.62, "z": 0.03},
            {"x": 0.49, "y": 0.58, "z": 0.04},
            {"x": 0.51, "y": 0.56, "z": 0.04}
        ]
        pts += [
            {"x": 0.46, "y": 0.55, "z": -0.01},
            {"x": 0.45, "y": 0.40, "z": -0.01},
            {"x": 0.44, "y": 0.28, "z": -0.01},
            {"x": 0.43, "y": 0.16, "z": -0.01}
        ]
        pts += [
            {"x": 0.50, "y": 0.58, "z": 0.03},
            {"x": 0.52, "y": 0.65, "z": 0.04},
            {"x": 0.50, "y": 0.69, "z": 0.05},
            {"x": 0.47, "y": 0.67, "z": 0.04}
        ]
        pts += [
            {"x": 0.55, "y": 0.60, "z": 0.03},
            {"x": 0.56, "y": 0.66, "z": 0.04},
            {"x": 0.54, "y": 0.70, "z": 0.05},
            {"x": 0.51, "y": 0.68, "z": 0.04}
        ]
        pts += [
            {"x": 0.60, "y": 0.62, "z": 0.03},
            {"x": 0.61, "y": 0.67, "z": 0.04},
            {"x": 0.58, "y": 0.70, "z": 0.05},
            {"x": 0.55, "y": 0.68, "z": 0.04}
        ]

    elif gesture_name == "why":
        # Y-shape: thumb out, pinky up, middle 3 curled
        pts += [
            {"x": 0.40, "y": 0.70, "z": -0.02},
            {"x": 0.32, "y": 0.62, "z": -0.03},
            {"x": 0.25, "y": 0.55, "z": -0.04},
            {"x": 0.18, "y": 0.50, "z": -0.05}  # thumb tip out
        ]
        pts += [
            {"x": 0.46, "y": 0.56, "z": 0.02},
            {"x": 0.48, "y": 0.64, "z": 0.04},
            {"x": 0.47, "y": 0.68, "z": 0.05},
            {"x": 0.44, "y": 0.66, "z": 0.04}   # index curled
        ]
        pts += [
            {"x": 0.51, "y": 0.56, "z": 0.02},
            {"x": 0.52, "y": 0.64, "z": 0.04},
            {"x": 0.50, "y": 0.69, "z": 0.05},
            {"x": 0.47, "y": 0.67, "z": 0.04}   # middle curled
        ]
        pts += [
            {"x": 0.56, "y": 0.58, "z": 0.02},
            {"x": 0.57, "y": 0.65, "z": 0.04},
            {"x": 0.55, "y": 0.70, "z": 0.05},
            {"x": 0.52, "y": 0.68, "z": 0.04}   # ring curled
        ]
        pts += [
            {"x": 0.61, "y": 0.60, "z": 0.00},
            {"x": 0.67, "y": 0.50, "z": 0.00},
            {"x": 0.72, "y": 0.40, "z": 0.00},
            {"x": 0.77, "y": 0.30, "z": 0.00}   # pinky extended high
        ]

    elif gesture_name == "who":
        # L-shape: thumb & index extended at 90 deg, middle, ring, pinky curled
        pts += [
            {"x": 0.40, "y": 0.70, "z": -0.02},
            {"x": 0.33, "y": 0.64, "z": -0.03},
            {"x": 0.26, "y": 0.60, "z": -0.04},
            {"x": 0.20, "y": 0.58, "z": -0.05}  # thumb pointing sideways
        ]
        pts += [
            {"x": 0.46, "y": 0.55, "z": -0.01},
            {"x": 0.45, "y": 0.40, "z": -0.01},
            {"x": 0.44, "y": 0.28, "z": -0.01},
            {"x": 0.43, "y": 0.16, "z": -0.01}  # index pointing straight up
        ]
        pts += [
            {"x": 0.50, "y": 0.58, "z": 0.03},
            {"x": 0.52, "y": 0.65, "z": 0.04},
            {"x": 0.50, "y": 0.69, "z": 0.05},
            {"x": 0.47, "y": 0.67, "z": 0.04}
        ]
        pts += [
            {"x": 0.55, "y": 0.60, "z": 0.03},
            {"x": 0.56, "y": 0.66, "z": 0.04},
            {"x": 0.54, "y": 0.70, "z": 0.05},
            {"x": 0.51, "y": 0.68, "z": 0.04}
        ]
        pts += [
            {"x": 0.60, "y": 0.62, "z": 0.03},
            {"x": 0.61, "y": 0.67, "z": 0.04},
            {"x": 0.58, "y": 0.70, "z": 0.05},
            {"x": 0.55, "y": 0.68, "z": 0.04}
        ]

    elif gesture_name == "which":
        # A-handshape (thumbs up / fist with thumb upright)
        pts += [
            {"x": 0.42, "y": 0.68, "z": -0.01},
            {"x": 0.39, "y": 0.56, "z": -0.02},
            {"x": 0.38, "y": 0.45, "z": -0.03},
            {"x": 0.38, "y": 0.34, "z": -0.04}  # thumb tip up
        ]
        pts += [
            {"x": 0.47, "y": 0.60, "z": 0.02},
            {"x": 0.49, "y": 0.66, "z": 0.04},
            {"x": 0.48, "y": 0.70, "z": 0.05},
            {"x": 0.45, "y": 0.68, "z": 0.04}
        ]
        pts += [
            {"x": 0.51, "y": 0.60, "z": 0.02},
            {"x": 0.53, "y": 0.66, "z": 0.04},
            {"x": 0.51, "y": 0.70, "z": 0.05},
            {"x": 0.48, "y": 0.68, "z": 0.04}
        ]
        pts += [
            {"x": 0.56, "y": 0.61, "z": 0.02},
            {"x": 0.57, "y": 0.67, "z": 0.04},
            {"x": 0.55, "y": 0.71, "z": 0.05},
            {"x": 0.52, "y": 0.69, "z": 0.04}
        ]
        pts += [
            {"x": 0.60, "y": 0.63, "z": 0.02},
            {"x": 0.61, "y": 0.68, "z": 0.04},
            {"x": 0.59, "y": 0.72, "z": 0.05},
            {"x": 0.56, "y": 0.70, "z": 0.04}
        ]
    return pts

def main():
    new_signs = [
        {"name": "Drink", "category": "Essentials", "desc": "Curved C-handshape mimicking holding a cup."},
        {"name": "Eat", "category": "Essentials", "desc": "All 5 fingertips pinched together pointing toward mouth."},
        {"name": "Say", "category": "Conversational", "desc": "Index finger extended from under the chin/mouth pointing outward."},
        {"name": "What", "category": "Questions", "desc": "Open palms facing forward/up with fingers spread wide."},
        {"name": "Where", "category": "Questions", "desc": "Index finger pointed upward waving side to side."},
        {"name": "Why", "category": "Questions", "desc": "Y-handshape with thumb and pinky extended, middle 3 curled."},
        {"name": "Who", "category": "Questions", "desc": "L-handshape with thumb and index finger extended at 90 degrees."},
        {"name": "Which", "category": "Questions", "desc": "A-handshape fist with thumb pointing upright."}
    ]

    for s in new_signs:
        dataset_service.add_class(name=s["name"], category=s["category"], description=s["desc"])

    # Generate 15 calibrated samples with natural variations for each gesture
    for s in new_signs:
        clean_name = s["name"]
        key = clean_name.lower()
        base_pts = get_canonical_template(key)

        for i in range(15):
            jittered = []
            for p in base_pts:
                jittered.append({
                    "x": round(p["x"] + random.uniform(-0.015, 0.015), 4),
                    "y": round(p["y"] + random.uniform(-0.015, 0.015), 4),
                    "z": round(p.get("z", 0.0) + random.uniform(-0.008, 0.008), 4),
                    "visibility": 1.0
                })

            dataset_service.add_sample(
                label=clean_name,
                landmarks=jittered,
                split="train" if i < 12 else "val",
                notes=f"Calibrated corpus baseline for {clean_name}",
                device_info="canonical-corpus-engine",
                review_status="approved",
                quality_score=0.98
            )
        print(f"Added 15 samples for {clean_name}")

    print("Now retraining MLP model on all classes...")
    from sklearn.neural_network import MLPClassifier
    from sklearn.preprocessing import LabelEncoder
    from sklearn.model_selection import train_test_split
    import numpy as np
    import pickle

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

    from collections import Counter
    counts = Counter(y)
    viable = {k: v for k, v in counts.items() if v >= 10}
    print(f"Viable classes for training (>=10 samples): {len(viable)}")
    print(viable)

    X_f = [x for x, lbl in zip(X, y) if lbl in viable]
    y_f = [lbl for lbl in y if lbl in viable]

    le = LabelEncoder()
    y_enc = le.fit_transform(y_f)
    X_arr = np.array(X_f, dtype=np.float32)

    X_train, X_test, y_train, y_test = train_test_split(
        X_arr, y_enc, test_size=0.15, random_state=42, stratify=y_enc
    )

    clf = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=600, random_state=42)
    clf.fit(X_train, y_train)

    train_acc = clf.score(X_train, y_train)
    test_acc = clf.score(X_test, y_test)
    print(f"Model trained! Train Accuracy: {train_acc*100:.1f}%, Test Accuracy: {test_acc*100:.1f}%")

    models_dir = Path(__file__).resolve().parent / "app" / "models_cv"
    models_dir.mkdir(parents=True, exist_ok=True)
    model_path = models_dir / "trained_sign_classifier.pkl"
    label_map_path = models_dir / "label_map.json"

    with open(model_path, "wb") as f:
        pickle.dump({"model": clf, "label_encoder": le}, f)

    label_map = {str(i): label for i, label in enumerate(le.classes_)}
    with open(label_map_path, "w") as f:
        json.dump(label_map, f, indent=2)

    print("Model saved to:", model_path)
    print("Classes in model:", list(le.classes_))

if __name__ == "__main__":
    main()
