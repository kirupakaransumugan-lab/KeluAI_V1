from sqlalchemy import Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SyllabusTopic(Base):
    """The syllabus subjects. `id` is what chunks carry in Qdrant as `topic_ids`, so ids must
    never be reused or renumbered.
    The list lives in app/services/topics.py (its matching rules are code, not data)."""

    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=False)
    key: Mapped[str] = mapped_column(String(40), unique=True)
    strand: Mapped[str] = mapped_column(String(10))                 # "pure" | "applied"
    name_en: Mapped[str] = mapped_column(String(120))
    name_ta: Mapped[str] = mapped_column(String(120))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)    # chunks tagged in Qdrant (manage tag-topics)
