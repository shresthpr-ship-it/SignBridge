from fastapi import APIRouter, HTTPException, Query, Response, UploadFile, File, Form
from typing import List, Optional
import csv
import io
import json
import datetime
from app.models import (
    SignClass,
    CreateSignClassRequest,
    SignSample,
    CreateSampleRequest,
    DatasetStats,
    ActivityLogItem,
    ReviewSampleRequest,
    AugmentRequest,
)
from app.services.dataset_service import dataset_service

router = APIRouter(prefix="/dataset", tags=["Dataset"])

@router.get("/languages")
def list_languages():
    """Return supported sign languages for dataset labeling."""
    return [
        {"id": "asl", "code": "ASL", "name": "American Sign Language", "description": "Sign language used predominantly in the United States and Canada"},
        {"id": "bsl", "code": "BSL", "name": "British Sign Language", "description": "Sign language used in the United Kingdom"},
        {"id": "isl", "code": "ISL", "name": "Indian Sign Language", "description": "Sign language used in India"},
        {"id": "auslan", "code": "AUSLAN", "name": "Australian Sign Language", "description": "Sign language used in Australia"},
        {"id": "lsf", "code": "LSF", "name": "Langue des Signes Française", "description": "Sign language used in France"},
        {"id": "custom", "code": "CUSTOM", "name": "Custom / Research Language", "description": "Custom sign vocabulary for research purposes"},
    ]

@router.get("/classes", response_model=List[SignClass])
def list_classes():
    return dataset_service.get_classes()

@router.post("/classes", response_model=SignClass)
def create_class(req: CreateSignClassRequest):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Class name cannot be empty")
    return dataset_service.add_class(name=req.name, category=req.category, description=req.description)

@router.delete("/classes/{class_name}")
async def delete_class(
    class_name: str,
    delete_samples: bool = Query(True, description="Also remove all samples associated with this sign label"),
    auto_retrain: bool = Query(True, description="Automatically retrain the model after deletion")
):
    """Delete a sign class and its associated landmark samples, then update the active model."""
    classes = dataset_service.get_classes()
    cls = next((c for c in classes if c["name"].lower() == class_name.lower() or c["id"] == class_name), None)
    if not cls:
        raise HTTPException(status_code=404, detail=f"Class '{class_name}' not found")

    target_name = cls["name"]

    # 1. Remove from classes file
    remaining_classes = [c for c in classes if c["name"].lower() != target_name.lower() and c["id"] != class_name]
    dataset_service._save_json(dataset_service.classes_path, remaining_classes)

    deleted_samples_count = 0
    # 2. Optionally remove associated samples from dataset
    if delete_samples:
        all_samples = dataset_service._read_json(dataset_service.dataset_path)
        filtered_samples = [s for s in all_samples if s.get("label", "").lower() != target_name.lower()]
        deleted_samples_count = len(all_samples) - len(filtered_samples)
        dataset_service._save_json(dataset_service.dataset_path, filtered_samples)
        dataset_service._recompute_class_counts()

    dataset_service.log_activity(
        "Class Deleted",
        f"Sign class '{target_name}' deleted along with {deleted_samples_count} samples.",
        "system"
    )

    # 3. Retrain if requested
    training_status = None
    if auto_retrain:
        try:
            from app.routes.recognition import train_model
            training_status = await train_model()
        except Exception as e:
            print(f"[DeleteClass] Retraining note: {e}")

    return {
        "status": "success",
        "deleted_class": target_name,
        "deleted_samples_count": deleted_samples_count,
        "model_retrained": training_status is not None,
        "remaining_classes_count": len(remaining_classes)
    }

@router.get("/samples", response_model=List[SignSample])
def list_samples(
    label: Optional[str] = Query(None, description="Filter by class label"),
    split: Optional[str] = Query(None, description="Filter by split (train/val/test)"),
    review_status: Optional[str] = Query(None, description="Filter by review status (pending_review/approved/rejected)"),
):
    return dataset_service.get_samples(label=label, split=split, review_status=review_status)

@router.post("/samples", response_model=SignSample)
def create_sample(req: CreateSampleRequest):
    if not req.label.strip():
        raise HTTPException(status_code=400, detail="Sample label cannot be empty")
    if len(req.landmarks) < 21:
        raise HTTPException(status_code=400, detail="Must provide at least 21 landmark points")
    
    # Ensure class exists or auto-register
    dataset_service.add_class(req.label)
    
    raw_landmarks = [p.dict() for p in req.landmarks]
    sample = dataset_service.add_sample(
        label=req.label,
        landmarks=raw_landmarks,
        split=req.split,
        notes=req.notes or "",
        device_info=req.device_info or "web-cam",
        review_status=req.review_status or "approved",
        quality_score=req.quality_score or 0.96
    )
    return sample

@router.post("/samples/capture", response_model=SignSample)
async def capture_webcam_sample(
    frame: UploadFile = File(..., description="Webcam frame image (JPEG/PNG)"),
    label: str = Form(..., description="Sign label for this capture"),
    split: str = Form("train", description="Dataset split: train, val, or test"),
    notes: Optional[str] = Form("", description="Optional notes"),
    language: Optional[str] = Form("ASL", description="Target sign language"),
):
    """Process a webcam frame, extract landmarks via MediaPipe, and save as a labeled sample."""
    if not label.strip():
        raise HTTPException(status_code=400, detail="Label cannot be empty")

    frame_bytes = await frame.read()
    if not frame_bytes:
        raise HTTPException(status_code=400, detail="Frame is empty")

    from app.services.vision_pipeline import vision_pipeline
    from app.models import LandmarkPoint

    try:
        result = vision_pipeline.process_image(
            image_bytes=frame_bytes,
            filename=frame.filename or "webcam_capture.jpg",
            target_language=language or "ASL",
            sign_label=label.strip()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Landmark extraction failed: {str(e)}")

    primary_landmarks = []
    if result.frames and result.frames[0].hands:
        primary_hand = result.frames[0].hands[0]
        primary_landmarks = [
            {
                "x": round(lm.x, 6),
                "y": round(lm.y, 6),
                "z": round(lm.z, 6),
                "visibility": round(lm.visibility, 4) if lm.visibility is not None else 1.0
            }
            for lm in primary_hand.landmarks
        ]

    if len(primary_landmarks) < 21:
        det_status = result.frames[0].detection_status if result.frames else "unknown"
        raise HTTPException(
            status_code=422,
            detail=f"No hand detected in captured frame (detection_status={det_status}). Ensure your hand is clearly visible and well-lit."
        )

    dataset_service.add_class(label.strip())

    sample = dataset_service.add_sample(
        label=label.strip(),
        landmarks=primary_landmarks,
        split=split if split in ["train", "val", "test"] else "train",
        notes=notes or "",
        device_info="webcam-capture",
        review_status="pending_review",
        quality_score=round(result.detection_rate_pct / 100.0, 2)
    )
    return sample

@router.post("/samples/{sample_id}/review", response_model=SignSample)
def review_sample(sample_id: str, req: ReviewSampleRequest):
    if req.status not in ["approved", "rejected", "pending_review"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'approved', 'rejected', or 'pending_review'")
    sample = dataset_service.update_review_status(sample_id, req.status, req.notes)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    return sample

@router.delete("/samples/{sample_id}")
def delete_sample(sample_id: str):
    success = dataset_service.delete_sample(sample_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sample not found")
    return {"status": "success", "deleted_id": sample_id}

@router.post("/augment", response_model=List[SignSample])
def augment_dataset(req: AugmentRequest):
    if req.augmentation_type not in ["jitter", "scale", "mirror"]:
        raise HTTPException(status_code=400, detail="Augmentation type must be 'jitter', 'scale', or 'mirror'")
    count = min(max(1, req.count), 20)
    samples = dataset_service.augment_data(req.label, req.augmentation_type, count)
    return samples

@router.get("/activity", response_model=List[ActivityLogItem])
def get_activity_log(limit: int = Query(20, ge=1, le=50)):
    return dataset_service.get_activities(limit)

@router.get("/stats", response_model=DatasetStats)
def get_stats():
    return dataset_service.get_stats()

@router.get("/quality/issues")
def get_quality_issues():
    """Identify samples with quality issues for review."""
    samples = dataset_service.get_samples()
    issues = []
    for s in samples:
        sample_issues = []
        lms = s.get("landmarks", [])
        if len(lms) < 21:
            sample_issues.append("insufficient_landmarks")
        if not s.get("label", "").strip():
            sample_issues.append("missing_label")
        if s.get("review_status") == "rejected":
            sample_issues.append("rejected_by_reviewer")
        if s.get("quality_score", 1.0) < 0.5:
            sample_issues.append("low_quality_score")
        if lms:
            all_zero = all(
                abs(p.get("x", 0)) < 1e-6 and abs(p.get("y", 0)) < 1e-6
                for p in lms[:5]
            )
            if all_zero:
                sample_issues.append("possibly_empty_landmarks")
        is_synthetic = (
            "Synthetic augmentation" in s.get("notes", "")
            or s.get("device_info", "") == "Augmentation-Engine"
        )
        if sample_issues:
            issues.append({
                "sample_id": s["id"],
                "label": s.get("label", ""),
                "issues": sample_issues,
                "review_status": s.get("review_status", ""),
                "created_at": s.get("created_at", ""),
                "notes": s.get("notes", ""),
                "is_augmented": is_synthetic,
                "quality_score": s.get("quality_score", 1.0),
            })
    return {"total_issues": len(issues), "issues": issues}

@router.post("/export/generate")
def generate_export(
    format: str = Query("json", description="Export format: json or csv"),
    label: Optional[str] = Query(None, description="Filter by sign label"),
    include_augmented: bool = Query(True, description="Include augmented samples"),
    quality_filter: Optional[str] = Query(None, description="Filter by review status"),
):
    """Generate a dataset export metadata record and return download info."""
    samples = dataset_service.get_samples()
    if label:
        samples = [s for s in samples if s.get("label") == label]
    if not include_augmented:
        samples = [
            s for s in samples
            if "Synthetic augmentation" not in s.get("notes", "")
            and s.get("device_info", "") != "Augmentation-Engine"
        ]
    if quality_filter and quality_filter in ["approved", "rejected", "pending_review"]:
        samples = [s for s in samples if s.get("review_status") == quality_filter]

    export_id = f"export-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}"
    return {
        "export_id": export_id,
        "format": format,
        "sample_count": len(samples),
        "filters_applied": {
            "label": label,
            "include_augmented": include_augmented,
            "quality_filter": quality_filter,
        },
        "download_url": f"/api/dataset/export?format={format}",
        "created_at": datetime.datetime.utcnow().isoformat(),
        "status": "ready",
    }

@router.get("/export")
def export_dataset(format: str = Query("json", description="Export format: json or csv")):
    if format not in ["json", "csv"]:
        raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")
    samples = dataset_service.get_samples()
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        coord_headers = []
        for i in range(21):
            coord_headers.extend([f"x_{i}", f"y_{i}", f"z_{i}"])
        writer.writerow(["id", "label", "split", "review_status", "quality_score", "created_at", "device_info", "notes"] + coord_headers)

        for s in samples:
            lms = s.get("landmarks", [])
            row = [
                s["id"],
                s["label"],
                s.get("split", "train"),
                s.get("review_status", "approved"),
                s.get("quality_score", 1.0),
                s.get("created_at", ""),
                s.get("device_info", ""),
                s.get("notes", ""),
            ]
            for p in lms[:21]:
                row.extend([round(p.get("x", 0), 6), round(p.get("y", 0), 6), round(p.get("z", 0), 6)])
            while len(row) < 8 + 63:
                row.append(0.0)
            writer.writerow(row)

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=signbridge_dataset.csv"}
        )
    else:
        export_data = {
            "schema_version": "1.0",
            "exported_at": datetime.datetime.utcnow().isoformat(),
            "total_samples": len(samples),
            "samples": samples,
        }
        return Response(
            content=json.dumps(export_data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=signbridge_dataset.json"}
        )
