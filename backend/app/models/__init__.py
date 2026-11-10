# Import every model here so Base.metadata is complete for Alembic autogenerate.
from app.models.password_reset import PasswordResetCode
from app.models.payment import Payment
from app.models.plan import Plan
from app.models.progress import PracticeAnswer
from app.models.question_feedback import QuestionFeedback
from app.models.quiz_bank import QuizBankQuestion
from app.models.quiz_job import QuizGenerationJob
from app.models.saved_question import SavedQuestion
from app.models.tutor_conversation import TutorConversation
from app.models.topic import SyllabusTopic
from app.models.user import Medium, Role, StudentProfile, Subscription, SubscriptionStatus, User

__all__ = ["Medium", "PasswordResetCode", "Payment", "Plan", "PracticeAnswer", "QuestionFeedback", "QuizBankQuestion", "QuizGenerationJob", "Role", "SavedQuestion", "StudentProfile",
           "Subscription", "SubscriptionStatus", "SyllabusTopic", "TutorConversation", "User"]
