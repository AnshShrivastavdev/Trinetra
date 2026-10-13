import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

async def dispatch_otp(identifier: str, otp_code: str) -> dict:
    """
    Dispatches 6-digit OTP code to specified recipient via Email or SMS.
    Returns dict with status and delivery details.
    """
    clean_id = identifier.strip()
    
    if "@" in clean_id:
        return await send_email_otp(clean_id, otp_code)
    else:
        return await send_sms_otp(clean_id, otp_code)

async def send_email_otp(recipient_email: str, otp_code: str) -> dict:
    smtp_user = settings.SMTP_USERNAME
    smtp_pass = settings.SMTP_PASSWORD
    sender = settings.SENDER_EMAIL or smtp_user
    
    if not smtp_user or not smtp_pass:
        logger.warning(f"SMTP credentials not configured in .env. Generated OTP [{otp_code}] for {recipient_email}")
        return {
            "status": "warning",
            "message": f"OTP generated. Configure SMTP_USERNAME & SMTP_PASSWORD in backend/.env to send real emails."
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Trinetra - Your Verification Code is {otp_code}"
        msg["From"] = sender
        msg["To"] = recipient_email

        html_content = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #09090b; color: #ffffff; border-radius: 10px; max-width: 500px;">
          <h2 style="color: #f59e0b; margin-bottom: 10px;">Trinetra Security Verification</h2>
          <p style="color: #a1a1aa; font-size: 14px;">Your 6-digit access code for logging in is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ffffff; background-color: #18181b; padding: 15px; text-align: center; border-radius: 8px; border: 1px solid #27272a; margin: 20px 0;">
            {otp_code}
          </div>
          <p style="color: #71717a; font-size: 12px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
        """
        msg.attach(MIMEText(html_content, "html"))

        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(sender, [recipient_email], msg.as_string())
        server.quit()

        logger.info(f"Successfully sent OTP email to {recipient_email}")
        return {
            "status": "success",
            "message": f"Verification OTP code sent to your email inbox: {recipient_email}"
        }
    except Exception as e:
        logger.error(f"Failed to send email OTP: {e}")
        return {
            "status": "error",
            "message": f"Failed to send email OTP: {str(e)}"
        }

async def send_sms_otp(phone_number: str, otp_code: str) -> dict:
    # 1. Fast2SMS API integration (India)
    if settings.FAST2SMS_API_KEY:
        try:
            clean_num = phone_number.replace("+91", "").replace(" ", "").strip()
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://www.fast2sms.com/dev/bulkV2",
                    headers={"authorization": settings.FAST2SMS_API_KEY},
                    json={
                        "variables_values": otp_code,
                        "route": "otp",
                        "numbers": clean_num
                    }
                )
                if resp.status_code == 200:
                    logger.info(f"Successfully sent SMS via Fast2SMS to {phone_number}")
                    return {
                        "status": "success",
                        "message": f"Verification OTP SMS sent to {phone_number}"
                    }
        except Exception as e:
            logger.error(f"Fast2SMS delivery error: {e}")

    # 2. Twilio API integration
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_PHONE_NUMBER:
        try:
            async with httpx.AsyncClient() as client:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
                resp = await client.post(
                    url,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    data={
                        "From": settings.TWILIO_PHONE_NUMBER,
                        "To": phone_number if phone_number.startswith("+") else f"+91{phone_number}",
                        "Body": f"Your Trinetra verification code is {otp_code}."
                    }
                )
                if resp.status_code in [200, 201]:
                    logger.info(f"Successfully sent SMS via Twilio to {phone_number}")
                    return {
                        "status": "success",
                        "message": f"Verification OTP SMS sent to {phone_number}"
                    }
        except Exception as e:
            logger.error(f"Twilio delivery error: {e}")

    logger.warning(f"No active SMS provider credentials. Generated OTP [{otp_code}] for {phone_number}")
    return {
        "status": "warning",
        "message": f"OTP generated. Configure FAST2SMS_API_KEY / Twilio in backend/.env for real SMS, or use Email OTP."
    }
