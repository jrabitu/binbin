from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.dashboard import router as dashboard_router
from app.routes.detect import router as detect_router
from app.routes.feedback import router as feedback_router

#fastapi app үүсгэх
app = FastAPI(
    title="MonBin backend API",
    version="1.0",
    description="Backend API for smart waste sorting system"
)

#
origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5600",
    "http://localhost:5600"
]

#CORS middleware нэмэх
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
        "message": "MonBin backend is running",
        "data": {
            "service": "backend",
            "version": "1.0",
            "status": "online"
        }
    }