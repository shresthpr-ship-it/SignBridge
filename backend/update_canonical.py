import re
from pathlib import Path

path = Path(r"C:\Users\Asus\.gemini\antigravity\scratch\signbridge\backend\app\services\dataset_service.py")
text = path.read_text(encoding="utf-8")

# Let's check if okay is already added
if 'gesture_type == "okay"' not in text:
    old_else = '    else:  # Pointing index'
    new_cases = '''    elif gesture_type == "okay":  # "Okay", "OK"
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

    else:  # Pointing index'''
    
    if old_else in text:
        text = text.replace(old_else, new_cases)
        path.write_text(text, encoding="utf-8")
        print("Updated dataset_service.py with okay and point gestures successfully!")
    else:
        print("Could not find old_else in text.")
else:
    print("Already updated.")
