import os

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "monbin_app")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Monbin@2026!")
DB_NAME = os.getenv("DB_NAME", "monbin_db")
MODEL_PATH = os.getenv("MODEL_PATH", "weights/best.pt")