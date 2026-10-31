# SignBridge REST API Specification

Base URL: `http://127.0.0.1:8001/api`

## System Endpoints

### `GET /api/health`
Health check endpoint.
```json
{
  "status": "healthy",
  "service": "SignBridge API",
  "version": "1.0.0"
}
```

### `GET /api/system/info`
Returns backend engine status, MediaPipe version, samples count, and classes count.

---

## Dataset & Label Management

### `GET /api/dataset/languages`
Returns supported sign languages (ASL, BSL, ISL, AUSLAN, LSF, CUSTOM).

### `GET /api/dataset/classes`
Lists all registered sign gesture classes with sample counts.

### `POST /api/dataset/classes`
Creates a new sign class.
- Request body: `{ "name": "Water", "category": "General", "description": "Sign for water" }`

### `DELETE /api/dataset/classes/{class_name}`
Deletes a sign class from vocabulary.

### `GET /api/dataset/samples`
Returns dataset samples. Supports query filters: `label`, `split`, `review_status`.

### `POST /api/dataset/samples`
Registers a new sample with pre-extracted 21 3D landmarks.

### `POST /api/dataset/samples/capture`
Accepts a webcam frame multipart file, runs MediaPipe Hand Landmarker, and saves as a labeled sample.

### `POST /api/dataset/samples/{sample_id}/review`
Updates sample review status (`approved`, `rejected`, `pending_review`).

### `DELETE /api/dataset/samples/{sample_id}`
Deletes a sample by ID.

### `GET /api/dataset/quality/issues`
Audits the dataset and returns samples with quality flags (insufficient landmarks, missing labels, low confidence).

### `POST /api/dataset/augment`
Applies controlled geometric landmark transformations (`jitter`, `scale`, `mirror`).

---

## Dataset Exports

### `GET /api/dataset/export?format=json|csv`
Direct download of JSON or CSV dataset.
- JSON: structured array of samples with 21 3D points.
- CSV: flat table with `id, label, split, review_status, x_0..x_20, y_0..y_20, z_0..z_20`.

### `POST /api/dataset/export/generate`
Generates filtered export manifest.

---

## Recognition & Training

### `GET /api/recognition/status`
Returns active model tier, capabilities, and limitations.

### `POST /api/recognition/live-frame`
Accepts a live camera frame (multipart JPEG/PNG).
Returns:
- `hand_detected`: boolean
- `landmark_detection_status`: detected | partial_detection | no_landmarks_detected
- `landmarks`: 21 3D coordinate points
- `predicted_sign`: string or null
- `confidence_score`: float percentage or null
- `prediction_state`: stable | provisional | unknown | no_hand
- `alternatives`: top candidate classes with scores

### `GET /api/recognition/training/status`
Checks dataset readiness for supervised model training.

### `POST /api/recognition/train`
Trains an MLPClassifier baseline on current landmark dataset, evaluates test accuracy, and saves artifact.
