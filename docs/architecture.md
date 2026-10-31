# SignBridge System Architecture

## Overview
SignBridge is a structured computer-vision platform engineered for sign language dataset building, multi-modal landmark topology extraction, and honest gesture recognition.

```
+-------------------------------------------------------------------------+
|                        SignBridge Architecture                           |
+-------------------------------------------------------------------------+
|                                                                         |
|  +--------------------+        HTTP / REST        +------------------+  |
|  |   React Frontend   | <-----------------------> | FastAPI Backend  |  |
|  | (Vite + TypeScript)|       (Port 8001)         |   (Python 3.13)  |  |
|  +--------------------+                           +------------------+  |
|            |                                                |           |
|            | WebRTC / getUserMedia                          |           |
|            v                                                v           |
|     [Browser Webcam]                              +-------------------+ |
|            |                                      | MediaPipe Tasks   | |
|     (Frame JPEG)                                  | Vision (v1.2.0)   | |
|            |                                      +-------------------+ |
|            +--------------------------------------------->  |           |
|                                                    (Hand, Pose, Face)   |
|                                                             |           |
|                                                             v           |
|                                                   +-------------------+ |
|                                                   | Invariant Norm    | |
|                                                   | [R^63 Feature]    | |
|                                                   +-------------------+ |
|                                                             |           |
|                                                             v           |
|                                                   +-------------------+ |
|                                                   | Supervised Model  | |
|                                                   | (MLP Classifier)  | |
|                                                   +-------------------+ |
|                                                             |           |
|                                                             v           |
|                                                   +-------------------+ |
|                                                   | Temporal Smoother | |
|                                                   | (5-frame window)  | |
|                                                   +-------------------+ |
+-------------------------------------------------------------------------+
```

## Stage Responsibilities

1. **Webcam Acquisition (Browser)**:
   - Captures user frames at configurable resolutions (640x480).
   - Provides Start/Stop controls, device enumerated selector, camera status.

2. **Frame Preprocessing (OpenCV)**:
   - Decodes RGB buffer, validates dimension and frame headers.

3. **Landmark Extraction (MediaPipe Tasks 3D)**:
   - Hand Landmarker: 21 3D landmarks (x, y, z) per hand, with left/right handedness.
   - Pose Landmarker: 33 3D skeletal points for signing context.
   - Face Landmarker: Salient non-manual facial markers.

4. **Coordinate Invariance**:
   - Shifts wrist point (0) to coordinate origin (0, 0, 0).
   - Scale-normalizes by Euclidean distance between wrist (0) and middle MCP (9).
   - Produces a 63-dimensional feature vector.

5. **Recognition Engine**:
   - Primary: Trained Multi-Layer Perceptron (MLP) with 128x64 hidden layers.
   - Fallback: Cosine + Euclidean centroid matching against calibrated classes.
   - Strict confidence threshold (≥ 60%) to prevent false-positive hallucination.

6. **Temporal Buffer**:
   - 5-frame moving window applies modal voting across consecutive video frames to prevent high-frequency jitter.
