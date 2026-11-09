"""Admin overview: admin only, counts from users / subscriptions, nothing invented."""
from datetime import timedelta

from app.core.clock import utcnow
from app.core.database import get_db
from app.main import app
from app.models.user import Subscription, SubscriptionStatus
from app.repositories import user_repository
from tests.test_admin_roles import login, promote_in_db
from tests.test_auth_login import register

URL = "/api/v1/admin/overview"


def _db():
    return next(app.dependency_overrides[get_db]())


def _as_admin(client):
    register(client, "boss@example.com")
    promote_in_db("boss@example.com")
    login(client, "boss@example.com")


def test_students_cannot_see_the_overview(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    assert client.get(URL).status_code == 403


def test_counts_students_signups_and_trials_but_not_admins(client):
    register(client, "a@example.com")
    register(client, "b@example.com")
    _as_admin(client)
    data = client.get(URL).json()
    k = data["kpis"]
    assert k["total_students"]["value"] == 2          # the admin is not a student
    assert k["new_signups"]["value"] == 2
    assert k["active_trials"]["value"] == 2           # every sign-up starts a trial
    assert k["paid_subscribers"]["value"] == 0
    assert k["trial_to_paid_pct"]["value"] is None    # no trial has ended: no fake 0%
    assert len(data["signups_per_day"]) == 30 and data["signups_per_day"][-1]["count"] == 2
    assert [s["status"] for s in data["latest_signups"]] == ["trial", "trial"]
    assert "revenue" not in k                          # not recorded anywhere yet


def test_old_signups_and_conversion(client):
    register(client, "old@example.com")
    register(client, "new@example.com")
    db = _db()
    old = user_repository.get_by_email(db, "old@example.com")
    long_ago = utcnow() - timedelta(days=40)
    old.created_at = long_ago
    trial = old.subscriptions[0]
    trial.starts_at, trial.ends_at = long_ago, utcnow() - timedelta(days=5)     # trial ended this month
    old.subscriptions.append(Subscription(plan="monthly", status=SubscriptionStatus.active,
                                          starts_at=utcnow() - timedelta(days=5), ends_at=utcnow() + timedelta(days=25)))
    db.commit()
    _as_admin(client)
    k = client.get(URL).json()["kpis"]
    assert k["new_signups"]["value"] == 1 and k["total_students"]["previous"] == 1
    assert k["paid_subscribers"]["value"] == 1 and k["active_trials"]["value"] == 1
    assert k["trial_to_paid_pct"]["value"] == 100.0


def test_medium_filter_and_range_validation(client):
    register(client, "a@example.com")
    _as_admin(client)
    medium = user_repository.get_by_email(_db(), "a@example.com").profile.medium.value
    other = "ta" if medium == "en" else "en"
    assert client.get(URL, params={"medium": medium}).json()["kpis"]["total_students"]["value"] == 1
    assert client.get(URL, params={"medium": other}).json()["kpis"]["total_students"]["value"] == 0
    assert len(client.get(URL, params={"days": 7}).json()["signups_per_day"]) == 7
    assert client.get(URL, params={"days": 12}).status_code == 422
