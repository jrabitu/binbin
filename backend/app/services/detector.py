from ultralytics import YOLO
from app.core.config import YOLO_MODEL_PATH, YOLO_MIN_CONFIDENCE

yolo_model = YOLO(YOLO_MODEL_PATH)


def _empty_result(image_path: str):
    return {
        "image_path": image_path,
        "detected_count": 0,
        "detections": [],
        "best_detection": None,
    }


def run_detection(image_path: str):
    try:
        results = yolo_model(image_path, conf=YOLO_MIN_CONFIDENCE)
    except Exception as error:
        print(f"YOLO detection error: {error}")
        return _empty_result(image_path)

    result = results[0]
    boxes = result.boxes

    if boxes is None or len(boxes) == 0:
        return _empty_result(image_path)

    detections = []

    for index, box in enumerate(boxes):
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        class_name = yolo_model.names[class_id]

        x1, y1, x2, y2 = box.xyxy[0].tolist()

        detections.append({
            "index": index,
            "yolo_class": class_name,
            "yolo_confidence": confidence,
            "bbox": {
                "x1": float(x1),
                "y1": float(y1),
                "x2": float(x2),
                "y2": float(y2),
            },
        })

    detections.sort(key=lambda item: item["yolo_confidence"], reverse=True)

    return {
        "image_path": image_path,
        "detected_count": len(detections),
        "detections": detections,
        "best_detection": detections[0],
    }