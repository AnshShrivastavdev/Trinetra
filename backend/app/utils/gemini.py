import logging
import json
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Gemini model if key is provided
gemini_available = False
if settings.GEMINI_API_KEY:
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        gemini_available = True
        logger.info("Gemini API configured successfully.")
    except Exception as e:
        logger.error(f"Error configuring Gemini API: {e}")

async def analyze_report_with_ai(report: dict, nearby_reports: list[dict]) -> dict:
    """
    Calls Gemini API to analyze a crime report for validity, fake indicators, 
    and checks if it is a duplicate of nearby historical reports.
    """
    report_id = str(report.get("_id", "new"))
    category = report.get("category", "")
    description = report.get("description", "")
    address = report.get("location", {}).get("address", "Unknown Location")
    created_at = report.get("createdAt")
    date_str = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)

    # Format historical/nearby reports for the AI comparison
    history_summary = []
    for r in nearby_reports:
        r_id = str(r.get("_id"))
        if r_id == report_id:
            continue
        history_summary.append({
            "report_id": r_id,
            "category": r.get("category"),
            "description": r.get("description"),
            "address": r.get("location", {}).get("address"),
            "status": r.get("status"),
            "date": str(r.get("createdAt"))
        })

    # Fallback to mock AI assessment if Gemini is not configured or fails
    if not gemini_available:
        logger.info("Gemini API not configured. Running mock AI assessment.")
        return get_mock_analysis(description, category, history_summary)

    # Prepare Prompt
    prompt = f"""
    You are an AI assistant helping a municipal civic-safety department verify emergency and incident reports.
    Analyze the following new incident report:
    
    Category: {category}
    Description: {description}
    Location: {address}
    Reported Date: {date_str}

    Recent nearby incident reports for comparison:
    {json.dumps(history_summary, indent=2)}

    Evaluate:
    1. Is the report likely fake/spam/nonsense (e.g. gibberish description, obvious jokes, unrelated strings)?
    2. Is the report a duplicate of one of the recent nearby incidents? (A duplicate is an incident describing the same event, in the same location, around the same time).

    Return your assessment strictly as a JSON object with this exact structure:
    {{
        "isSuspicious": boolean,
        "suspicionScore": float (value between 0.0 and 1.0 indicating fake confidence),
        "reason": "String explaining your reasoning for the suspicious rating or duplicate checking",
        "isDuplicate": boolean,
        "duplicateOfReportId": "String report_id or null if not a duplicate"
    }}
    """

    try:
        # Run synchronous call in thread pool if needed, or directly since we are using generative model
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Requesting json mode
        response = model.generate_content(
            prompt, 
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        logger.info(f"Gemini analysis response: {result_text}")
        
        analysis = json.loads(result_text)
        return analysis

    except Exception as e:
        logger.error(f"Gemini API request failed: {e}. Falling back to mock analysis.")
        return get_mock_analysis(description, category, history_summary)

def get_mock_analysis(description: str, category: str, nearby_reports: list) -> dict:
    """Provides a deterministic mock analysis for testing without calling API keys."""
    desc_lower = description.lower()
    
    # 1. Simple fake checks
    is_suspicious = False
    suspicion_score = 0.0
    reason = "Report analysis: description looks consistent and authentic."

    if len(description.strip()) < 10:
        is_suspicious = True
        suspicion_score = 0.9
        reason = "AI Warning: Description is too short to be descriptive of a real incident."
    elif any(word in desc_lower for word in ["haha", "lol", "fake", "joke", "prank", "testing 123", "dummy"]):
        is_suspicious = True
        suspicion_score = 0.8
        reason = "AI Warning: Description contains keywords suggesting a prank or test."

    # 2. Simple duplicate checks
    is_duplicate = False
    duplicate_id = None

    for r in nearby_reports:
        r_desc = r["description"].lower()
        # High similarity mock match: same category and word overlap
        if r["category"].lower() == category.lower():
            # Check if descriptions share key words or are highly similar
            words_this = set(desc_lower.split())
            words_other = set(r_desc.split())
            common = words_this.intersection(words_other)
            if len(common) >= 3 or desc_lower in r_desc or r_desc in desc_lower:
                is_duplicate = True
                duplicate_id = r["report_id"]
                reason += f" AI Warning: Potential duplicate of report {duplicate_id} based on category and description similarity."
                break

    return {
        "isSuspicious": is_suspicious,
        "suspicionScore": suspicion_score,
        "reason": reason,
        "isDuplicate": is_duplicate,
        "duplicateOfReportId": duplicate_id
    }
