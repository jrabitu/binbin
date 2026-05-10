from fastapi import APIRouter
from app.services.dashboard_service import (
    get_summary_data,
    get_bin_stats,
    get_recent_logs,
    get_recent_events,
    get_feedback_summary
)

router = APIRouter()


@router.get("/dashboard/summary")
def dashboard_summary():
    return {
        "success": True,
        "data": get_summary_data()
    }


@router.get("/dashboard/bin-stats")
def dashboard_bin_stats():
    return {
        "success": True,
        "data": get_bin_stats()
    }


@router.get("/dashboard/logs")
def dashboard_logs():
    return {
        "success": True,
        "data": get_recent_logs(12)
    }


@router.get("/dashboard/events")
def dashboard_events():
    return {
        "success": True,
        "data": get_recent_events(12)
    }


@router.get("/dashboard/feedback-summary")
def dashboard_feedback_summary():
    return {
        "success": True,
        "data": get_feedback_summary()
    }