"""Resend email service for sending account credentials."""
from __future__ import annotations

import resend

from app.core.config import settings


def send_credentials_email(to_email: str, password: str) -> bool:
    """Send account credentials to a user via Resend."""
    if not settings.RESEND_API_KEY:
        print(f"[DEV] Credentials for {to_email}: password={password}")
        return True

    resend.api_key = settings.RESEND_API_KEY

    try:
        r = resend.Emails.send({
            "from": f"AITU Locker System <{settings.RESEND_FROM_EMAIL}>",
            "to": [to_email],
            "subject": "AITU Locker Management System - Your Account Credentials",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
                <h2 style="color: #2563eb; text-align: center; margin-bottom: 1.5rem;">Your Account Has Been Created</h2>
                <p style="color: #374151;">Hello,</p>
                <p style="color: #374151;">An account has been created for you in the AITU Locker Management System. Use the credentials below to sign in:</p>
                <div style="background: #f4f6f9; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.25rem; margin: 1.5rem 0;">
                    <p style="margin: 0 0 0.5rem 0; color: #374151;"><strong>Email:</strong> {to_email}</p>
                    <p style="margin: 0; color: #374151;"><strong>Password:</strong> {password}</p>
                </div>
                <p style="color: #6b7280; font-size: 0.875rem;">Please keep your credentials safe. Contact your administrator if you have any issues.</p>
            </div>
            """,
        })
        print(f"[Resend] Credentials sent to {to_email} (id: {r.get('id', 'unknown')})")
        return True
    except Exception as e:
        print(f"[Resend Error] Failed to send credentials to {to_email}: {e}")
        raise RuntimeError(f"Failed to send credentials email: {e}")
