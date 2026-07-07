import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

async def reverse_geocode(lat: float, lng: float) -> str:
    """
    Resolves latitude and longitude coordinates into a human-readable address.
    Tries Google Geocoding API first, then falls back to OpenStreetMap (Nominatim), 
    and finally uses a mock string if both fail or keys are absent.
    """
    # 1. Google Geocoding API
    if settings.GOOGLE_GEOCODING_API_KEY:
        try:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                "latlng": f"{lat},{lng}",
                "key": settings.GOOGLE_GEOCODING_API_KEY
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "OK" and data.get("results"):
                        address = data["results"][0]["formatted_address"]
                        logger.info(f"Google Geocoding succeeded for ({lat}, {lng}): {address}")
                        return address
                    else:
                        logger.warning(f"Google Geocoding API returned non-OK status: {data.get('status')}")
        except Exception as e:
            logger.error(f"Google Geocoding request failed: {e}")

    # 2. OpenStreetMap Nominatim Fallback
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "format": "json",
            "lat": lat,
            "lon": lng,
            "zoom": 18,
            "addressdetails": 1
        }
        # Nominatim requires a user-agent to prevent blocking
        headers = {
            "User-Agent": "TrinetraCrimeReportingSystem/1.0 (contact: info@trinetrasystem.org)"
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params, headers=headers)
            if response.status_code == 200:
                data = response.json()
                address = data.get("display_name")
                if address:
                    logger.info(f"Nominatim Geocoding succeeded for ({lat}, {lng}): {address}")
                    return address
    except Exception as e:
        logger.error(f"Nominatim Geocoding request failed: {e}")

    # 3. Last resort mock fallback
    mock_address = f"Street near coordinates ({lat:.4f}, {lng:.4f})"
    logger.info(f"Geocoding fallback triggered. Generated mock address: {mock_address}")
    return mock_address
