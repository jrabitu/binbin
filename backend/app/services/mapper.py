CLASS_CONFIDENCE_THRESHOLDS = {
    "paper": 0.93,
    "pet_bottle": 0.93,
    "can": 0.91,
    "carton_box": 0.88,
    "cup_container": 0.85,
    "food_waste": 0.82,
    "glass": 0.85,
    "others": 0.80,
    "plastic_other": 0.82,
    "wrapper": 0.78,
    "electronics": 0.85,
    "batteries": 0.85,
    "fabric_napkins": 0.85,
}

DEFAULT_THRESHOLD = 0.85


def get_class_threshold(class_name: str) -> float:
    return CLASS_CONFIDENCE_THRESHOLDS.get(class_name, DEFAULT_THRESHOLD)


def map_class_to_bin(class_name: str):
    class_bin_map = {
        "paper": ("paper", None, True),
        "carton_box": ("paper", None, True),

        "pet_bottle": ("plastic", None, True),
        "can": ("can", None, True),

        "cup_container": ("general", None, True),
        "food_waste": ("general", None, True),
        "glass": ("general", None, True),
        "others": ("general", None, True),
        "plastic_other": ("general", None, True),
        "wrapper": ("general", None, True),
        "fabric_napkins": ("general", None, True),

        "electronics": (
            "special",
            "Электрон барааны хог хаягдал илэрлээ. Зориулалтын хогийн саванд хаяна уу.",
            False,
        ),
        "batteries": (
            "special",
            "Батерей илэрлээ. Зориулалтын хогийн саванд хаяна уу.",
            False,
        ),
    }

    return class_bin_map.get(
        class_name,
        ("general", "Тодорхойгүй хаягдал илэрлээ.", False),
    )