from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin, admin_billing, admin_feedback, admin_quiz, auth, papers, progress, quizzes, saved_questions, subscription, tutor,
    tutor_conversations,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(tutor_conversations.router)   # before tutor: /tutor/conversations
api_router.include_router(tutor.router)
api_router.include_router(papers.router)
api_router.include_router(progress.router)
api_router.include_router(quizzes.router)
api_router.include_router(saved_questions.router)
api_router.include_router(subscription.router)
api_router.include_router(admin.router)
api_router.include_router(admin_quiz.router)
api_router.include_router(admin_feedback.router)
api_router.include_router(admin_billing.router)
