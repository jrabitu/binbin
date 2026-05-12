import os
import uuid
from PIL import Image
from app.core.config import CROP_DIR, CROP_PADDING_RATIO

os.makedirs(CROP_DIR, exist_ok=True)


def crop_with_padding(image_path: str, bbox: dict, padding_ratio: float = CROP_PADDING_RATIO) -> str:
    image = Image.open(image_path).convert("RGB")
    width, height = image.size

    x1 = float(bbox["x1"])
    y1 = float(bbox["y1"])
    x2 = float(bbox["x2"])
    y2 = float(bbox["y2"])

    box_width = x2 - x1
    box_height = y2 - y1

    pad_x = box_width * padding_ratio
    pad_y = box_height * padding_ratio

    crop_x1 = max(0, int(x1 - pad_x))
    crop_y1 = max(0, int(y1 - pad_y))
    crop_x2 = min(width, int(x2 + pad_x))
    crop_y2 = min(height, int(y2 + pad_y))

    if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
        raise ValueError("Invalid crop box generated from YOLO bounding box.")

    crop = image.crop((crop_x1, crop_y1, crop_x2, crop_y2))

    crop_name = f"{uuid.uuid4().hex}.jpg"
    crop_path = os.path.join(CROP_DIR, crop_name)
    crop.save(crop_path, quality=95)

    return crop_path