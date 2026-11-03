from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, tutor

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(tutor.router)
api_router.include_router(admin.router)
