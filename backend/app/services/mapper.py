CLASS_CONFIDENCE_THRESHOLDS = {
    "paper":         0.93,
    "pet_bottle":    0.93,
    "can":           0.91,
    "carton_box":    0.88,
    "cup_container": 0.85,
    "food_waste":    0.82,
    "glass":         0.85,
    "others":        0.80,
    "plastic_other": 0.82,
    "wrapper":       0.78,
    "electronics":   0.85,
    "batteries":     0.85,
}
DEFAULT_THRESHOLD = 0.85


def get_class_threshold(detected_class: str) -> float:
    return CLASS_CONFIDENCE_THRESHOLDS.get(detected_class, DEFAULT_THRESHOLD)


def map_class_to_bin(detected_class):
    class_bin_map = {
        "paper": ("paper", None, True),
        "pet_bottle": ("plastic", None, True),
        "can": ("can", None, True),
        
        "carton_box": ("paper", None, True),
        "cup_container": ("general", None, True),
        "food_waste": ("general", None, True),
        "glass": ("general", None, True),
        "others": ("general", None, True),
        "plastic_other": ("general", None, True),
        "wrapper": ("general", None, True),

        "electronics": (
            "special", 
            "Цахилгаан барааны хог хаягдал илэрлээ. Зориулалтын хогийн саванд хаях.", 
            False
        ),
        "batteries": (
            "special", 
            "Батерей илэрлээ. Зориулалтын хогийн саванд хаяна уу.", 
            False
        )
    }

    return class_bin_map.get(
        detected_class, 
        ("general", "Тодорхойгүй хаягдал илэрлээ.", False)
    )


def evaluate_detection_group(detections):
    if not detections:
        return{
            "status": "no_detection",
            "final_bin_type": None,
            "warning_message": "Хаягдал илэрсэнгүй.",
            "is_supported": False
        }
    
    mapped_results = []
    for item in detections:
        detected_class = item["detected_class"]
        final_bin_type, warning_message, is_supported = map_class_to_bin(detected_class)

        mapped_results.append({
            "detected_class": detected_class,
            "final_bin_type": final_bin_type,
            "warning_message": warning_message,
            "is_supported": is_supported,
            "confidence": item["confidence"]
        })

    bin_types = {item["final_bin_type"] for item in mapped_results}
    unsupported_items = [item for item in mapped_results if not item["is_supported"]]

    if unsupported_items:
        first_warning = unsupported_items[0]["warning_message"]
        return{
            "status": "unsupported",
            "final_bin_type": "special",
            "warning_message": first_warning,
            "is_supported": False,
            "mapped_results": mapped_results
        }
    
    if len(bin_types) ==1:
        # Хамгийн өндөр confidence бүхий class утгыг тооцоолох
        best_class = mapped_results[0]["detected_class"]
        return{
            "status": "detected",
            "final_bin_type": mapped_results[0]["final_bin_type"],
            "warning_message": None,
            "is_supported": True,
            "mapped_results": mapped_results,
            "class_threshold": get_class_threshold(best_class)
        }
    
    return{
        "status": "multiple_items",
        "final_bin_type": None,
        "warning_message": "Олон төрлийн хаягдал илэрлээ.",
        "is_supported": False,
        "mapped_results": mapped_results
    }