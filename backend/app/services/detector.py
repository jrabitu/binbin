from ultralytics import YOLO
from app.core.config import MODEL_PATH

model = YOLO(MODEL_PATH)


def _empty_result(image_path: str):
    return {
        "detected_class": None,
        "confidence": 0.0,
        "detected_count": 0,
        "image_path": image_path,
        "detections": []
    }


def run_detection(image_path: str):
    try:
        results = model(image_path)
    except Exception as e:
        print(f"detection error: {e}")
        return _empty_result(image_path)

    result = results[0]
    boxes = result.boxes
    detected_count = len(boxes)

    if detected_count == 0:
        return _empty_result(image_path)

    detections = []
    for box in boxes:
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        class_name = model.names[class_id]

        detections.append({
            "detected_class": class_name,
            "confidence": confidence
        })

    detections.sort(key=lambda x: x["confidence"], reverse=True)
    best_detection = detections[0]

    return {
        "detected_class": best_detection["detected_class"],
        "confidence": best_detection["confidence"],
        "detected_count": detected_count,
        "image_path": image_path,
        "detections": detections
    }