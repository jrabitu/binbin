from app.core.config import (
    AUTO_SUCCESS_CONFIDENCE,
    CLASSIFIER_AUTO_CONFIDENCE,
    LOW_CONFIDENCE_LIMIT,
)
from app.services.mapper import map_class_to_bin, get_class_threshold


def decide_single_item(yolo_result: dict, classifier_result: dict):
    yolo_class = yolo_result.get("yolo_class")
    yolo_conf = float(yolo_result.get("yolo_confidence") or 0)

    classifier_class = classifier_result.get("classifier_class")
    classifier_conf = float(classifier_result.get("classifier_confidence") or 0)

    yolo_bin, yolo_warning, yolo_supported = map_class_to_bin(yolo_class)
    classifier_bin, classifier_warning, classifier_supported = map_class_to_bin(classifier_class)

    if not yolo_supported:
        return _unsupported_result(
            yolo_result,
            classifier_result,
            yolo_class,
            yolo_conf,
            yolo_bin,
            yolo_warning,
            "yolo_unsupported",
        )

    if classifier_class and not classifier_supported:
        return _unsupported_result(
            yolo_result,
            classifier_result,
            classifier_class,
            classifier_conf,
            classifier_bin,
            classifier_warning,
            "classifier_unsupported",
        )

    if not classifier_class:
        threshold = get_class_threshold(yolo_class)
        status = "success" if yolo_conf >= threshold else "confirmation_required"

        return {
            "status": status,
            "agreement_type": "yolo_only",
            "yolo_class": yolo_class,
            "yolo_confidence": yolo_conf,
            "classifier_class": None,
            "classifier_confidence": 0.0,
            "final_class": yolo_class,
            "final_confidence": yolo_conf,
            "final_bin_type": yolo_bin,
            "is_supported": True,
            "warning_message": None if status == "success" else "Итгэлцэл бага тул хэрэглэгчийн баталгаажуулалт шаардлагатай.",
        }

    if yolo_class == classifier_class:
      class_threshold = get_class_threshold(yolo_class)

      status = "success" if (
          yolo_conf >= class_threshold and classifier_conf >= 0.55
      ) else "confirmation_required"

      final_confidence = round((yolo_conf * 0.55) + (classifier_conf * 0.45), 4)

      return {
          "status": status,
          "agreement_type": "exact_class_match",
          "yolo_class": yolo_class,
          "yolo_confidence": yolo_conf,
          "classifier_class": classifier_class,
          "classifier_confidence": classifier_conf,
          "final_class": classifier_class,
          "final_confidence": final_confidence,
          "final_bin_type": classifier_bin,
          "is_supported": True,
          "warning_message": None if status == "success" else "Хоёр загвар ижил ангилал өгсөн боловч итгэлцэл хангалтгүй байна.",
      }

    if yolo_bin == classifier_bin:
      final_class = yolo_class
      final_conf = yolo_conf

      status = "success" if yolo_conf >= 0.75 else "confirmation_required"

      return {
          "status": status,
          "agreement_type": "same_bin_match",
          "yolo_class": yolo_class,
          "yolo_confidence": yolo_conf,
          "classifier_class": classifier_class,
          "classifier_confidence": classifier_conf,
          "final_class": final_class,
          "final_confidence": final_conf,
          "final_bin_type": yolo_bin,
          "is_supported": True,
          "warning_message": None if status == "success" else "Савны ангилал ижил боловч итгэлцэл хангалтгүй байна.",
      }

    final_class = yolo_class
    final_conf = yolo_conf
    final_bin = yolo_bin

    return {
        "status": "confirmation_required",
        "agreement_type": "model_conflict",
        "yolo_class": yolo_class,
        "yolo_confidence": yolo_conf,
        "classifier_class": classifier_class,
        "classifier_confidence": classifier_conf,
        "final_class": final_class,
        "final_confidence": final_conf,
        "final_bin_type": final_bin,
        "is_supported": True,
        "warning_message": "Model-н үр дүн зөрсөн тул хэрэглэгчийн баталгаажуулалт шаардлагатай.",
    }


def decide_multiple_items(verified_items: list):
    if not verified_items:
        return {
            "status": "no_detection",
            "agreement_type": "not_applicable",
            "final_class": None,
            "final_confidence": 0.0,
            "final_bin_type": None,
            "is_supported": False,
            "warning_message": "Хаягдал илэрсэнгүй.",
            "items": [],
        }

    unsupported_items = [item for item in verified_items if not item.get("is_supported")]

    if unsupported_items:
        first = unsupported_items[0]
        return {
            "status": "unsupported",
            "agreement_type": first.get("agreement_type", "unsupported"),
            "final_class": first.get("final_class"),
            "final_confidence": first.get("final_confidence", 0.0),
            "final_bin_type": "special",
            "is_supported": False,
            "warning_message": first.get("warning_message"),
            "items": verified_items,
        }

    bin_types = {item.get("final_bin_type") for item in verified_items}

    if len(bin_types) > 1:
        return {
            "status": "multiple_items",
            "agreement_type": "multiple_bin_types",
            "final_class": None,
            "final_confidence": 0.0,
            "final_bin_type": None,
            "is_supported": False,
            "warning_message": "Олон төрлийн хаягдал илэрлээ. Нэг удаад нэг төрлийн хаягдал байрлуулна уу.",
            "items": verified_items,
        }

    best_item = max(
        verified_items,
        key=lambda item: float(item.get("final_confidence") or 0),
    )

    if len(verified_items) > 1:
        return {
            **best_item,
            "status": "confirmation_required",
            "agreement_type": "multiple_same_bin",
            "warning_message": "Нэг саванд харьяалагдах олон объект илэрсэн тул баталгаажуулалт шаардлагатай.",
            "items": verified_items,
        }

    return {
        **best_item,
        "items": verified_items,
    }


def _unsupported_result(
    yolo_result,
    classifier_result,
    final_class,
    final_confidence,
    final_bin_type,
    warning_message,
    agreement_type,
):
    return {
        "status": "unsupported",
        "agreement_type": agreement_type,
        "yolo_class": yolo_result.get("yolo_class"),
        "yolo_confidence": float(yolo_result.get("yolo_confidence") or 0),
        "classifier_class": classifier_result.get("classifier_class"),
        "classifier_confidence": float(classifier_result.get("classifier_confidence") or 0),
        "final_class": final_class,
        "final_confidence": final_confidence,
        "final_bin_type": final_bin_type,
        "is_supported": False,
        "warning_message": warning_message,
    }