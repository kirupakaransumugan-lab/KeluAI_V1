import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

log = logging.getLogger("kelu.email")


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email over SMTP (any provider: Gmail, SES, Brevo, Mailgun...).

    Runs as a FastAPI background task, so a slow or failing mail server never
    delays the HTTP response or reveals whether the address has an account.
    """
    settings = get_settings()
    if not settings.smtp_host:
        # Dev mode: no mail server configured, so show the email in the server console.
        log.warning("SMTP_HOST not set; email NOT sent.\nTo: %s\nSubject: %s\n\n%s", to, subject, body)
        return

    msg = EmailMessage()
    msg["From"] = settings.mail_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)  # UTF-8, so Tamil text is fine

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password or "")
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError):
        log.exception("Failed to send email to %s", to)
