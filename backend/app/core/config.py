import os
import tempfile

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "monbin_app")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Monbin@2026!")
DB_NAME = os.getenv("DB_NAME", "monbin_db")

YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "weights/yolo26sbest.pt")
CLASSIFIER_MODEL_PATH = os.getenv("CLASSIFIER_MODEL_PATH", "weights/mobilenetv2_best.pth")

_tmp = os.path.join(tempfile.gettempdir(), "monbin")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(_tmp, "uploads"))
CROP_DIR = os.getenv("CROP_DIR", os.path.join(_tmp, "crops"))

MODEL_VERSION = "yolo26s_mobilenetv2_hybrid_v1"

YOLO_MIN_CONFIDENCE = 0.25
AUTO_SUCCESS_CONFIDENCE = 0.88
CLASSIFIER_AUTO_CONFIDENCE = 0.88
LOW_CONFIDENCE_LIMIT = 0.65
CROP_PADDING_RATIO = 0.18
