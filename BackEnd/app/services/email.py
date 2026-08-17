"""Simple SMTP-based email sending service."""
from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText

from ..config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_body: str) -> None:
    """Send an HTML email. Falls back to logging when SMTP is not configured."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning(
            "SMTP not configured; logging email instead of sending.\nTo: %s\nSubject: %s\nBody: %s",
            to_email, subject, html_body,
        )
        return

    message = MIMEText(html_body, "html")
    message["Subject"] = subject
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], message.as_string())


def send_password_reset_otp_email(to_email: str, code: str) -> None:
    subject = "Your TalentTrail password reset code"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#4f46e5;">Reset your password</h2>
      <p>Use the verification code below to reset your TalentTrail password. This code expires in 10 minutes.</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #1e293b;">{code}</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>
    """
    send_email(to_email, subject, html_body)
