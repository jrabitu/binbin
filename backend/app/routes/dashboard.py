from fastapi import APIRouter
from app.services.dashboard_service import (
    get_summary_data,
    get_bin_stats,
    get_recent_logs,
    get_recent_events,
    get_feedback_summary,
    get_trashcan_overview,
    get_trashcan_detail,
)

router = APIRouter()


@router.get("/dashboard/summary")
def dashboard_summary():
    return {
        "success": True,
        "data": get_summary_data(),
    }


@router.get("/dashboard/trashcans")
def dashboard_trashcans():
    return {
        "success": True,
        "data": get_trashcan_overview(),
    }


@router.get("/dashboard/trashcans/{trashcan_id}")
def dashboard_trashcan_detail(trashcan_id: int):
    detail = get_trashcan_detail(trashcan_id)

    if not detail:
        return {
            "success": False,
            "message": "trashcan not found",
            "data": None,
        }

    return {
        "success": True,
        "data": detail,
    }


@router.get("/dashboard/bin-stats")
def dashboard_bin_stats():
    return {
        "success": True,
        "data": get_bin_stats(),
    }


@router.get("/dashboard/logs")
def dashboard_logs():
    return {
        "success": True,
        "data": get_recent_logs(12),
    }


@router.get("/dashboard/events")
def dashboard_events():
    return {
        "success": True,
        "data": get_recent_events(12),
    }


@router.get("/dashboard/feedback-summary")
def dashboard_feedback_summary():
    return {
        "success": True,
        "data": get_feedback_summary(),
    }