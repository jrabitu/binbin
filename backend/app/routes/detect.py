from fastapi import APIRouter, UploadFile, File
import os
import uuid

from app.services.detector import run_detection
from app.services.mapper import evaluate_detection_group
from app.services.db_service import (
    get_all_bins,
    get_bin_by_type,
    save_detection_log,
    save_sorting_action,
    increment_bin_item_count,
    save_system_event
)

router = APIRouter()
model_ver = "yolo26s_v3"

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def build_sorting_command(bin_type: str) -> str:
    return f"sort_to_{bin_type}"


@router.get("/status")
def get_status():
    return {
        "success": True,
        "message": "system is running",
        "data": {
            "backend": "online",
            "model": "ready",
            "database": "connected"
        }
    }


@router.get("/bins")
def get_bins():
    bins = get_all_bins()
    return {
        "success": True,
        "message": "bin list success",
        "data": bins
    }


@router.post("/detect")
async def detect_item(file: UploadFile = File(...)):
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in [".jpg", ".jpeg", ".png"]:
        return {
            "success": False,
            "message": "unsupported file type",
            "data": {
                "status": "invalid_file_type",
            }
        }

    unique_name = f"{uuid.uuid4().hex}{file_ext}"
    saved_path = os.path.join(UPLOAD_DIR, unique_name)

    file_bytes = await file.read()
    with open(saved_path, "wb") as buffer:
        buffer.write(file_bytes)

    if os.path.getsize(saved_path) == 0:
        os.remove(saved_path)
        return {
            "success": False,
            "message": "empty file uploaded",
            "data": {
                "status": "empty_file"
            }
        }

    detection_result = run_detection(saved_path)

    detected_class = detection_result["detected_class"]
    confidence = detection_result["confidence"]
    detected_count = detection_result["detected_count"]
    image_path = detection_result["image_path"]
    detections = detection_result["detections"]

    group_result = evaluate_detection_group(detections)
    detection_status = group_result["status"]
    final_bin_type = group_result["final_bin_type"]
    warning_message = group_result["warning_message"]
    is_supported = group_result["is_supported"]

    if detection_status == "no_detection":
        event_id = save_system_event(
            "no_detection",
            f"no item detected in uploaded image: {saved_path}"
        )
        return {
            "success": False,
            "message": "no item detected",
            "data": {
                "event_id": event_id,
                "status": "no_detection",
                "image_path": image_path
            }
        }

    if detection_status == "multiple_items":
        event_id = save_system_event(
            "multiple_items",
            f"mixed bin types detected in uploaded image: {saved_path}"
        )
        return {
            "success": False,
            "message": "multiple item types detected",
            "data": {
                "event_id": event_id,
                "status": "multiple_items",
                "image_path": image_path,
                "detected_count": detected_count,
                "detections": detections,
                "warning_message": warning_message
            }
        }

    if is_supported:
        bin_row = get_bin_by_type(final_bin_type)
        target_bin_id = bin_row["id"] if bin_row else None
        detection_status = "detected" if target_bin_id else "bin_not_found"
    else:
        target_bin_id = None
        detection_status = "unsupported"

    log_id = save_detection_log(
        image_path=image_path,
        source_type="camera_capture",
        detected_class=detected_class,
        confidence=confidence,
        detected_count=detected_count,
        final_bin_type=final_bin_type,
        target_bin_id=target_bin_id,
        detection_status=detection_status,
        is_supported=is_supported,
        warning_message=warning_message,
        model_version=model_ver
    )

    sorting_action_id = None

    if target_bin_id and is_supported:
        command_sent = build_sorting_command(final_bin_type)
        sorting_action_id = save_sorting_action(
            detection_id=log_id,
            command_sent=command_sent,
            action_status="simulated"
        )
        increment_bin_item_count(target_bin_id)

    if detection_status == "unsupported":
        save_system_event(
            "unsupported_item",
            warning_message,
            related_detection_id=log_id
        )
        return {
        "success": False,
        "message": "unsupported item detected",
        "data": {
            "log_id": log_id,
            "status": "unsupported",
            "image_path": image_path,
            "detected_class": detected_class,
            "confidence": confidence,
            "detected_count": detected_count,
            "detections": detections,
            "final_bin_type": final_bin_type,
            "target_bin_id": None,
            "is_supported": False,
            "warning_message": warning_message,
            "model_version": model_ver
        }
    }

    if detection_status == "bin_not_found":
        save_system_event(
            "bin_not_found",
            f"active bin not found for bin type: {final_bin_type}",
            related_detection_id=log_id
        )
        return {
            "success": False,
            "message": "target bin not found",
            "data": {
                "log_id": log_id,
                "status": "bin_not_found",
                "image_path": image_path,
                "detected_class": detected_class,
                "confidence": confidence,
                "detected_count": detected_count,
                "detections": detections,
                "final_bin_type": final_bin_type,
                "target_bin_id": None,
                "is_supported": is_supported,
                "warning_message": "Идэвхтэй сав олдсонгүй.",
                "model_version": model_ver
            }
        }
    
    # class утгыг mapper-аас авах
    class_threshold = group_result.get("class_threshold", 0.90)

    return {
        "success": True,
        "message": "item detection success",
        "data": {
            "log_id": log_id,
            "sorting_action_id": sorting_action_id,
            "status": detection_status,
            "image_path": image_path,
            "detected_class": detected_class,
            "confidence": confidence,
            "detected_count": detected_count,
            "detections": detections,
            "final_bin_type": final_bin_type,
            "target_bin_id": target_bin_id,
            "is_supported": is_supported,
            "warning_message": warning_message,
            "model_version": model_ver,
            "class_threshold": class_threshold
        }
    }

