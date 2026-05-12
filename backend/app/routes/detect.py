from fastapi import APIRouter, UploadFile, File
import os
import uuid

from app.core.config import UPLOAD_DIR, MODEL_VERSION
from app.services.detector import run_detection
from app.services.image_utils import crop_with_padding
from app.services.classifier import classify_crop
from app.services.decision_engine import decide_single_item, decide_multiple_items
from app.services.db_service import (
    get_all_bins,
    get_bin_by_type,
    save_detection_log,
    save_sorting_action,
    increment_bin_item_count,
    save_system_event,
)

router = APIRouter()

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
            "detector": "yolo26s",
            "classifier": "mobilenetv2",
            "database": "connected",
        },
    }


@router.get("/bins")
def get_bins():
    return {
        "success": True,
        "message": "bin list success",
        "data": get_all_bins(),
    }


@router.post("/detect")
async def detect_item(file: UploadFile = File(...)):
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in [".jpg", ".jpeg", ".png"]:
        return {
            "success": False,
            "message": "unsupported file type",
            "data": {"status": "invalid_file_type"},
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
            "data": {"status": "empty_file"},
        }

    detection_result = run_detection(saved_path)

    if detection_result["detected_count"] == 0:
        event_id = None
        try:
            event_id = save_system_event(
                "no_detection",
                f"no item detected in uploaded image: {saved_path}",
            )
        except Exception as db_error:
            print(f"DB log error (no_detection): {db_error}")

        return {
            "success": False,
            "message": "no item detected",
            "data": {
                "event_id": event_id,
                "status": "no_detection",
                "image_path": saved_path,
                "warning_message": "Хаягдал илэрсэнгүй.",
            },
        }

    verified_items = []

    for detection in detection_result["detections"]:
        try:
            crop_path = crop_with_padding(saved_path, detection["bbox"])
            classifier_result = classify_crop(crop_path)
        except Exception as error:
            print(f"crop/classification pipeline error: {error}")
            crop_path = None
            classifier_result = {
                "classifier_class": None,
                "classifier_confidence": 0.0,
            }

        single_decision = decide_single_item(detection, classifier_result)
        single_decision["bbox"] = detection["bbox"]
        single_decision["crop_path"] = crop_path

        verified_items.append(single_decision)

    final_decision = decide_multiple_items(verified_items)

    status = final_decision["status"]
    final_bin_type = final_decision.get("final_bin_type")
    final_class = final_decision.get("final_class")
    final_confidence = final_decision.get("final_confidence") or 0.0
    warning_message = final_decision.get("warning_message")
    is_supported = final_decision.get("is_supported", False)

    target_bin_id = None
    sorting_action_id = None

    if is_supported and final_bin_type:
        bin_row = get_bin_by_type(final_bin_type)
        target_bin_id = bin_row["id"] if bin_row else None

        if not target_bin_id:
            status = "bin_not_found"
            warning_message = "Идэвхтэй сав олдсонгүй."

    log_id = None
    try:
        log_id = save_detection_log(
            image_path=saved_path,
            source_type="camera_capture",
            detected_class=final_class,
            confidence=final_confidence,
            detected_count=detection_result["detected_count"],
            final_bin_type=final_bin_type,
            target_bin_id=target_bin_id,
            detection_status=status,
            is_supported=is_supported,
            warning_message=warning_message,
            model_version=MODEL_VERSION,
        )
    except Exception as db_error:
        print(f"DB log error (detection_log): {db_error}")

    if status == "success" and target_bin_id and is_supported:
        try:
            command_sent = build_sorting_command(final_bin_type)
            sorting_action_id = save_sorting_action(
                detection_id=log_id,
                command_sent=command_sent,
                action_status="simulated",
            )
            increment_bin_item_count(target_bin_id)
        except Exception as db_error:
            print(f"DB log error (sorting_action): {db_error}")

    if status in ["unsupported", "multiple_items", "bin_not_found", "confirmation_required"]:
        try:
            save_system_event(
                status,
                warning_message or f"system returned status: {status}",
                related_detection_id=log_id,
            )
        except Exception as db_error:
            print(f"DB log error (system_event): {db_error}")

    response_success = status in ["success", "confirmation_required"]

    return {
        "success": response_success,
        "message": "hybrid detection completed",
        "data": {
            "log_id": log_id,
            "sorting_action_id": sorting_action_id,
            "status": status,
            "agreement_type": final_decision.get("agreement_type"),
            "image_path": saved_path,
            "detected_count": detection_result["detected_count"],

            "yolo_class": final_decision.get("yolo_class"),
            "yolo_confidence": final_decision.get("yolo_confidence"),
            "classifier_class": final_decision.get("classifier_class"),
            "classifier_confidence": final_decision.get("classifier_confidence"),

            "final_class": final_class,
            "final_confidence": final_confidence,
            "final_bin_type": final_bin_type,
            "target_bin_id": target_bin_id,

            "is_supported": is_supported,
            "warning_message": warning_message,
            "model_version": MODEL_VERSION,
            "items": final_decision.get("items", verified_items),
        },
    }