# SignBridge Dataset Schema Specification

Version: 1.0

## Sample Object (JSON)

```json
{
  "id": "sample-uuid-string",
  "label": "Hello",
  "split": "train",
  "review_status": "approved",
  "quality_score": 0.96,
  "created_at": "2026-10-31T12:00:00Z",
  "device_info": "webcam-capture",
  "notes": "Natural light capture",
  "landmarks": [
    {
      "x": 0.5124,
      "y": 0.7312,
      "z": -0.0234,
      "visibility": 1.0
    }
  ]
}
```

### Landmark Point Anatomy
Each hand comprises exactly 21 landmarks numbered according to the standard MediaPipe topological index:
- 0: Wrist
- 1–4: Thumb (CMC, MCP, IP, TIP)
- 5–8: Index Finger (MCP, PIP, DIP, TIP)
- 9–12: Middle Finger (MCP, PIP, DIP, TIP)
- 13–16: Ring Finger (MCP, PIP, DIP, TIP)
- 17–20: Pinky Finger (MCP, PIP, DIP, TIP)

## CSV Export Format
Flat tabular format where each row represents one sign instance:
```
id,label,split,review_status,quality_score,created_at,device_info,notes,x_0,y_0,z_0,...,x_20,y_20,z_20
```
Coordinates are float values in range [0.0, 1.0] relative to frame width and height.
