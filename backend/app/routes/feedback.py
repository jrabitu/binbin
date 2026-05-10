from fastapi import APIRouter
from pydantic import BaseModel
from app.services.db_service import save_feedback_log

router = APIRouter()


class FeedbackRequest(BaseModel):
    detection_id: int
    was_correct: bool
    corrected_bin_type: str | None = None


@router.post("/feedback")
def submit_feedback(feedback: FeedbackRequest):
    feedback_id = save_feedback_log(
        detection_id=feedback.detection_id,
        was_correct=feedback.was_correct,
        corrected_bin_type=feedback.corrected_bin_type
    )

    return {
        "success": True,
        "message": "feedback saved",
        "data": {
            "feedback_id": feedback_id,
            "detection_id": feedback.detection_id,
            "was_correct": feedback.was_correct,
            "corrected_bin_type": feedback.corrected_bin_type
        }
    }