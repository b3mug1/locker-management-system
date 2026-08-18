"""SMTP email service — uses Python's built-in smtplib, no extra packages."""
from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _send(to_email: str, subject: str, html: str) -> None:
    """Low-level helper: open an SMTP connection and send one message."""
    sender = settings.SMTP_FROM or settings.SMTP_USER

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"AITU Locker System <{sender}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    if settings.SMTP_USE_TLS:
        # STARTTLS — standard for port 587
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.sendmail(sender, to_email, msg.as_string())
    else:
        # SSL — standard for port 465
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.sendmail(sender, to_email, msg.as_string())


def send_credentials_email(to_email: str, password: str) -> bool:
    """Send login credentials to a newly created user."""
    if not settings.SMTP_USER:
        # No SMTP configured — print to console in dev
        print(f"[DEV] Credentials for {to_email}: password={password}")
        return True

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:2rem">
      <h2 style="color:#2563eb;text-align:center;margin-bottom:1.5rem">
        Your Account Has Been Created
      </h2>
      <p style="color:#374151">Hello,</p>
      <p style="color:#374151">
        An account has been created for you in the
        <strong>AITU Locker</strong>.
        Use the credentials below to sign in:
      </p>
      <div style="background:#f4f6f9;border:1px solid #e5e7eb;border-radius:8px;
                  padding:1.25rem;margin:1.5rem 0">
        <p style="margin:0 0 0.5rem;color:#374151"><strong>Email:</strong> {to_email}</p>
        <p style="margin:0;color:#374151"><strong>Password:</strong> {password}</p>
      </div>
      <p style="color:#6b7280;font-size:0.875rem">
        Please keep your credentials safe and change your password after first login.
        Contact your administrator if you have any issues.
      </p>
    </div>
    """

    try:
        _send(to_email, "AITU Locker — Your Account Credentials", html)
        print(f"[SMTP] Credentials sent to {to_email}")
        return True
    except Exception as exc:
        print(f"[SMTP Error] Failed to send to {to_email}: {exc}")
        raise RuntimeError(f"Failed to send credentials email: {exc}") from exc


def send_assignment_email(to_email: str, locker_number: str, floor: int) -> bool:
    """Notify a user that a locker has been assigned to them."""
    if not settings.SMTP_USER:
        print(f"[DEV] Assignment notification for {to_email}: locker={locker_number}")
        return True

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:2rem">
      <h2 style="color:#2563eb;text-align:center;margin-bottom:1.5rem">
        Locker Assigned
      </h2>
      <p style="color:#374151">Hello,</p>
      <p style="color:#374151">
        A locker has been assigned to you in the
        <strong>AITU Locker</strong>:
      </p>
      <div style="background:#f4f6f9;border:1px solid #e5e7eb;border-radius:8px;
                  padding:1.25rem;margin:1.5rem 0">
        <p style="margin:0 0 0.5rem;color:#374151"><strong>Locker number:</strong> {locker_number}</p>
        <p style="margin:0;color:#374151"><strong>Floor:</strong> {floor}</p>
      </div>
      <p style="color:#6b7280;font-size:0.875rem">
        Log in to the system to see full details.
      </p>
    </div>
    """

    try:
        _send(to_email, "AITU Locker System — Locker Assigned", html)
        print(f"[SMTP] Assignment notification sent to {to_email}")
        return True
    except Exception as exc:
        print(f"[SMTP Error] Failed to send to {to_email}: {exc}")
        raise RuntimeError(f"Failed to send assignment email: {exc}") from exc


def send_release_email(to_email: str, locker_number: str) -> bool:
    """Notify a user that their locker has been released."""
    if not settings.SMTP_USER:
        print(f"[DEV] Release notification for {to_email}: locker={locker_number}")
        return True

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:2rem">
      <h2 style="color:#dc2626;text-align:center;margin-bottom:1.5rem">
        Locker Released
      </h2>
      <p style="color:#374151">Hello,</p>
      <p style="color:#374151">
        Your locker <strong>{locker_number}</strong> has been released in the
        <strong>AITU Locker</strong>.
      </p>
      <p style="color:#6b7280;font-size:0.875rem">
        If you believe this is a mistake, please contact your administrator.
      </p>
    </div>
    """

    try:
        _send(to_email, "AITU Locker System — Locker Released", html)
        print(f"[SMTP] Release notification sent to {to_email}")
        return True
    except Exception as exc:
        print(f"[SMTP Error] Failed to send to {to_email}: {exc}")
        raise RuntimeError(f"Failed to send release email: {exc}") from exc
