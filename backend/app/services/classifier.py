import torch
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image

from app.core.config import CLASSIFIER_MODEL_PATH

CLASS_NAMES = [
    "batteries",
    "can",
    "carton_box",
    "cup_container",
    "electronics",
    "fabric_napkins",
    "food_waste",
    "glass",
    "others",
    "paper",
    "pet_bottle",
    "plastic_other",
    "wrapper",
]

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _build_model():
    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = torch.nn.Linear(model.last_channel, len(CLASS_NAMES))
    return model


classifier_model = _build_model()

checkpoint = torch.load(CLASSIFIER_MODEL_PATH, map_location=device)

if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
    classifier_model.load_state_dict(checkpoint["model_state_dict"])
else:
    classifier_model.load_state_dict(checkpoint)

classifier_model.to(device)
classifier_model.eval()

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


def classify_crop(crop_path: str):
    try:
        image = Image.open(crop_path).convert("RGB")
        tensor = transform(image).unsqueeze(0).to(device)

        with torch.no_grad():
            outputs = classifier_model(tensor)
            probabilities = F.softmax(outputs, dim=1)
            confidence, predicted_index = torch.max(probabilities, dim=1)

        class_index = int(predicted_index.item())
        class_name = CLASS_NAMES[class_index]
        class_confidence = float(confidence.item())

        return {
            "classifier_class": class_name,
            "classifier_confidence": class_confidence,
        }

    except Exception as error:
        print(f"MobileNetV2 classification error: {error}")
        return {
            "classifier_class": None,
            "classifier_confidence": 0.0,
        }