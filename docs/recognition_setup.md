# Sign Recognition Setup and Training Guide

## 1. Prerequisites
- Python 3.10+
- Dependencies installed: `pip install -r backend/requirements.txt`
- MediaPipe task models present in `backend/app/models_cv/`:
  - `hand_landmarker.task`
  - `pose_landmarker.task`
  - `face_landmarker.task`

## 2. Training Workflow
1. Navigate to **Capture Studio** or **Video Processing** to record or upload gesture clips.
2. Ensure at least 2 distinct sign classes have at least 10 samples each.
3. Open the **Model Training** page in SignBridge.
4. Review the class distribution analysis.
5. Click **Train Baseline Classifier**.
6. The backend runs an 80/20 train/test split with `sklearn.neural_network.MLPClassifier`, saves `trained_sign_classifier.pkl` and `label_map.json`, and outputs test accuracy.

## 3. Live Recognition Testing
1. Navigate to **Live Recognition**.
2. Click **Start Camera** and grant browser webcam permissions.
3. Observe real-time 3D landmark skeleton drawn over your hand.
4. Perform one of your trained gestures.
5. The recognition output card displays the predicted sign, confidence %, and temporal stability state.
