from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.dashboard import router as dashboard_router
from app.routes.detect import router as detect_router
from app.routes.feedback import router as feedback_router

app = FastAPI(
    title="MonBin backend API",
    version="1.0",
    description="Backend API for smart waste sorting system"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(detect_router)
app.include_router(feedback_router)
app.include_router(dashboard_router)

@app.get("/")
def home():
    return {
        "success": True,
        "message": "MonBin backend is running"
    }