"""
SUDO SPANDR - SentinelMail AI Enterprise Config
"""
import os

class Settings:
    PROJECT_NAME: str = "SUDO SPANDR SentinelMail Evidence Triage API"
    TEAM_NAME: str = "SUDO SPANDR"
    PROBLEM_STATEMENT: str = "SIH 2026 #26106 (Email Forensic Ecosystem)"
    API_V1_STR: str = "/api/v1"
    ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]
    MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))

settings = Settings()
