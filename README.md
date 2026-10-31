# SignBridge — AI Sign Language Dataset Builder & Recognition Studio

SignBridge is an integrated computer-vision platform engineered for building sign language datasets, extracting multi-modal landmarks, and training baseline recognition models.

---

## 🚀 Quick Startup Guide

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
The FastAPI backend will be available at `http://127.0.0.1:8001`.
Interactive API documentation is at `http://127.0.0.1:8001/docs`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The Vite development server will start on `http://localhost:3000` (or `http://localhost:5173`) with automated proxying to the backend on `http://127.0.0.1:8001`.

### 3. Running Automated Tests
```bash
cd backend
pytest tests/test_signbridge.py -v
```

---

## 🛠 Features & Capabilities

1. **Dashboard & Overview**: Real-time stats on samples, classes, review queue, and recognition model tier.
2. **Live Webcam Recognition**: MediaPipe Tasks 3D hand/pose/face tracking, invariant coordinate normalization, temporal window smoothing, and honest classification without hallucinated signs.
3. **Capture Studio**: Live webcam capture for still images and video sequences with participant consent management.
4. **Video Processing**: Decompose sign language videos into temporally ordered landmark frames.
5. **Dataset Explorer**: Searchable, filterable repository of samples with 3D landmark visualizer.
6. **Sign Label Management**: Create, categorize, search, and manage sign vocabulary classes.
7. **Dataset Quality Review**: Detect samples with missing landmarks, corrupt files, or low confidence.
8. **Augmentation Lab**: Controlled geometric transformations (`jitter`, `scale`, `mirror`) with provenance tracking.
9. **Model Training & Evaluation**: Train a scikit-learn MLP classifier on invariant 3D landmarks with train/test accuracy reporting.
10. **Export Center**: Export datasets in structured JSON and flat 63-column CSV formats.
11. **Settings**: View backend health, MediaPipe engine versions, and storage metrics.

---

## 📚 Documentation
- [Architecture Guide](docs/architecture.md)
- [REST API Reference](docs/api.md)
- [Dataset Schema](docs/dataset_schema.md)
- [Recognition Setup](docs/recognition_setup.md)
