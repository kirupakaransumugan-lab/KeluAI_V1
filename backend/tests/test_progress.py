"""Progress: answers are saved once, per student, and the report only states what they did."""
from datetime import date, datetime, timedelta
from types import SimpleNamespace as NS

import pytest

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.main import app
from app.models import PracticeAnswer
from app.models.user import Medium, Role, User
from app.services.progress import _streaks, build_report, local_day
from app.services.topics import TOPICS, classify

NOW = datetime(2026, 11, 6, 6, 0)            # a Friday, 11:30 in Colombo


@pytest.fixture
def db(client):
    gen = app.dependency_overrides[get_db]()
    session = next(gen)
    session.add(User(id=7, full_name="A", email="a@example.invalid", mobile="+94771234567", role=Role.student,
                     terms_accepted_at=NOW, created_at=NOW - timedelta(days=60)))
    session.add(User(id=8, full_name="B", email="b@example.invalid", mobile="+94771234568", role=Role.student,
                     terms_accepted_at=NOW, created_at=NOW - timedelta(days=60)))
    session.commit()
    app.dependency_overrides[get_current_user] = lambda: session.get(User, 7)
    yield session
    gen.close()


def _add(db, *, user=7, set_id=1, slot=1, topic="Mathematical Induction", total=3, right=3, ago=0):
    db.add(PracticeAnswer(user_id=user, set_id=set_id, lang="en", slot=slot, topic=topic, steps_total=total,
                          steps_right=right, kind="practice", answered_at=NOW - timedelta(days=ago)))
    db.commit()


def _report(db, days=30, user=7):
    return build_report(db, db.get(User, user), days, now=NOW)


def _body(set_id=1, answers=None):
    return {"set_id": set_id, "lang": "en",
            "answers": answers or [{"slot": 1, "topic": "Limits", "steps_total": 3, "steps_right": 2}]}


def test_saving_requires_login(client):
    assert client.post("/api/v1/progress/attempts", json=_body()).status_code == 401
    assert client.get("/api/v1/progress/report").status_code == 401


def test_saving_twice_stores_one_set(client, db):
    assert client.post("/api/v1/progress/attempts", json=_body()).json() == {"recorded": True}
    assert client.post("/api/v1/progress/attempts", json=_body()).json() == {"recorded": False}
    assert db.query(PracticeAnswer).count() == 1


def test_user_comes_from_the_session_not_the_body(client, db):
    client.post("/api/v1/progress/attempts", json={**_body(), "user_id": 8})
    assert db.query(PracticeAnswer).one().user_id == 7


def test_rejects_more_right_than_asked(client, db):
    bad = _body(answers=[{"slot": 1, "topic": "Limits", "steps_total": 2, "steps_right": 3}])
    assert client.post("/api/v1/progress/attempts", json=bad).status_code == 422


def test_rejects_a_repeated_slot(client, db):
    one = {"slot": 1, "topic": "Limits", "steps_total": 3, "steps_right": 2}
    assert client.post("/api/v1/progress/attempts", json=_body(answers=[one, one])).status_code == 422


def test_long_topic_is_cut_not_rejected(client, db):
    long = _body(answers=[{"slot": 1, "topic": "x" * 200, "steps_total": 3, "steps_right": 2}])
    assert client.post("/api/v1/progress/attempts", json=long).status_code == 200
    assert len(db.query(PracticeAnswer).one().topic) == 120


def test_report_endpoint_checks_the_range(client, db):
    assert client.get("/api/v1/progress/report?range=7").status_code == 200
    assert client.get("/api/v1/progress/report?range=all").json()["days"] is None
    assert client.get("/api/v1/progress/report?range=12").status_code == 422


def test_no_answers_is_empty_not_zero(db):
    r = _report(db)
    assert r["has_answers"] is False
    assert r["mastery"]["value"] is None and r["accuracy"]["value"] is None
    assert all(t["pct"] is None for t in r["topics"])
    assert r["topics_covered"] == {"covered": 0, "total": len(TOPICS)}


def test_another_students_answers_never_count(db):
    _add(db, user=8)
    assert _report(db)["has_answers"] is False


def test_mastery_averages_topics_not_steps(db):
    # Many steps on one strong topic must not hide a weak one: (100 + 0) / 2, not 90.
    for slot in range(1, 10):
        _add(db, slot=slot, total=1, right=1)
    _add(db, slot=10, topic="Limits", total=1, right=0)
    r = _report(db)
    assert r["mastery"]["value"] == 50
    assert r["topics"][0]["key"] == "limits" and r["topics"][0]["pct"] == 0


def test_accuracy_needs_every_step_right(db):
    _add(db, slot=1, total=3, right=3)
    _add(db, slot=2, total=3, right=2)
    assert _report(db)["accuracy"] == {"value": 50, "questions": 2}


def test_range_and_change_against_the_previous_range(db):
    _add(db, set_id=1, slot=1, total=4, right=1, ago=10)         # 25 in the previous 7 days
    _add(db, set_id=2, slot=1, total=4, right=3, ago=1)          # 75 in the last 7 days
    r = _report(db, days=7)
    assert r["mastery"] == {"value": 75, "change": 50}
    assert r["accuracy"]["questions"] == 1
    assert _report(db, days=None)["mastery"]["change"] is None


def test_days_follow_sri_lanka_time():
    assert local_day(datetime(2026, 11, 5, 18, 29)) == date(2026, 11, 5)
    assert local_day(datetime(2026, 11, 5, 18, 30)) == date(2026, 11, 6)     # 00:00 in Colombo


def test_streak_survives_until_today_ends():
    today = date(2026, 11, 6)
    days = {today - timedelta(days=n) for n in (1, 2, 3, 7, 8, 9, 10)}
    assert _streaks(days, today) == (3, 4)
    assert _streaks(days | {today}, today) == (4, 4)
    assert _streaks({today - timedelta(days=2)}, today) == (0, 1)


def test_daily_grid_marks_each_day(db):
    db.get(User, 7).created_at = NOW - timedelta(days=3)
    _add(db, ago=1)
    states = [d["state"] for d in _report(db, days=7)["daily"]]
    assert states == ["before", "before", "before", "missed", "missed", "done", "today"]


def test_weekly_keeps_empty_weeks_as_none(db):
    _add(db, set_id=1, total=4, right=2, ago=0)
    _add(db, set_id=2, total=4, right=1, ago=21)
    weeks = _report(db)["weekly"]
    assert [w["score"] for w in weeks] == [None, 25, None, None, 50]
    assert weeks[-1]["start"] == "2026-11-02"                    # the Monday of this week


def test_recent_names_a_single_topic_or_a_mix(db):
    _add(db, set_id=1, slot=1, ago=2)
    _add(db, set_id=2, slot=1, ago=1)
    _add(db, set_id=2, slot=2, topic="Limits", right=0, ago=1)
    recent = _report(db)["recent"]
    assert [r["set_id"] for r in recent] == [2, 1]
    assert (recent[0]["topic"], recent[0]["perfect"], recent[0]["questions"]) == (None, 1, 2)
    assert recent[1]["topic"]["en"] == "Mathematical induction"


@pytest.mark.parametrize("name, key", [
    ("Mathematical Induction", "induction"),
    ("Absolute value functions and inequalities", "inequalities"),
    ("Loci in the Argand diagram", "complex"),
    ("Binomial Expansion – Equal Consecutive Coefficients", "binomial"),
    ("Limits involving trigonometric functions", "limits"),
    ("Integration using given derivative and volume of revolution", "integration"),
    ("Equation of normal to ellipse (parametric)", "diff_applications"),
    ("Coordinate geometry of a square", "straight_lines"),
    ("Circle through intersection orthogonal to given circle", "circles"),
    ("Trigonometric identities and exact values", "trigonometry"),
    ("Circular motion of a particle", "circular_motion"),
    ("சிக்கலெண்கள்", "complex"),
])
def test_real_topic_names_are_classified(name, key):
    assert classify(name).key == key


def test_unknown_topic_counts_in_accuracy_but_not_topics(db):
    _add(db, topic="Something new")
    r = _report(db)
    assert r["accuracy"]["questions"] == 1 and r["topics_covered"]["covered"] == 0


# ---------- Dashboard home cards ----------

def _home(db, user=7):
    from app.services.progress import build_dashboard
    return build_dashboard(db, db.get(User, user), now=NOW)


def test_dashboard_requires_login(client):
    assert client.get("/api/v1/progress/dashboard").status_code == 401


def test_dashboard_is_empty_before_any_answers(db):
    home = _home(db)
    assert home["has_answers"] is False
    assert home["plan"] == [] and home["needs_work"] == [] and home["recent"] == []
    assert home["week"]["questions"] == 0 and home["week"]["score"] is None


def test_needs_work_lists_only_weak_tried_topics_weakest_first(db):
    _add(db, set_id=1, topic="Limits", total=4, right=1)                      # 25%
    _add(db, set_id=2, topic="Mathematical Induction", total=4, right=2)      # 50%
    _add(db, set_id=3, topic="Projectile motion", total=4, right=4)           # 100%: not weak
    keys = [t["key"] for t in _home(db)["needs_work"]]
    assert keys == [classify("Limits").key, classify("Mathematical Induction").key]


def test_this_week_counts_only_this_week_and_marks_each_day(db):
    _add(db, set_id=1, ago=0)                # Friday
    _add(db, set_id=2, ago=2)                # Wednesday
    _add(db, set_id=3, ago=9)                # last week: not counted
    week = _home(db)["week"]
    assert week["questions"] == 2 and week["active_days"] == 2
    assert [d["state"] for d in week["days"]] == ["missed", "missed", "done", "missed", "done", "future", "future"]


def test_dashboard_recent_is_newest_first_and_capped(db):
    for i in range(5):
        _add(db, set_id=i + 1, ago=5 - i)
    assert [r["set_id"] for r in _home(db)["recent"]] == [5, 4, 3]


def test_dashboard_only_shows_the_logged_in_student(client, db):
    _add(db, user=8, topic="Limits", total=4, right=0)
    body = client.get("/api/v1/progress/dashboard").json()
    assert body["has_answers"] is False and body["needs_work"] == []
