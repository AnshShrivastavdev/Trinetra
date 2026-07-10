import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


async def reverse_geocode(lat: float, lng: float) -> str:
    """
    Resolves latitude and longitude into a human-readable address.
    Tries Mapbox Geocoding API first, then falls back to
    OpenStreetMap (Nominatim), and finally returns a mock address.
    """

    # 1. Mapbox Reverse Geocoding API
    if settings.MAPBOX_API_KEY:
        try:
            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json"

            params = {
                "access_token": settings.MAPBOX_API_KEY,
                "limit": 1
            }

            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url, params=params)

                if response.status_code == 200:
                    data = response.json()

                    features = data.get("features", [])
                    if features:
                        address = features[0].get("place_name")

                        logger.info(
                            f"Mapbox Geocoding succeeded for ({lat}, {lng}): {address}"
                        )
                        return address

                    logger.warning("Mapbox returned no matching address.")

                else:
                    logger.warning(
                        f"Mapbox API returned status code {response.status_code}"
                    )

        except Exception as e:
            logger.error(f"Mapbox Geocoding request failed: {e}")

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

        headers = {
            "User-Agent": "TrinetraCrimeReportingSystem/1.0 (contact: info@trinetrasystem.org)"
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                url,
                params=params,
                headers=headers
            )

            if response.status_code == 200:
                data = response.json()
                address = data.get("display_name")

                if address:
                    logger.info(
                        f"Nominatim Geocoding succeeded for ({lat}, {lng}): {address}"
                    )
                    return address

    except Exception as e:
        logger.error(f"Nominatim Geocoding request failed: {e}")

    # 3. Mock fallback
    mock_address = f"Street near coordinates ({lat:.4f}, {lng:.4f})"

    logger.info(
        f"Geocoding fallback triggered. Generated mock address: {mock_address}"
    )

    return mock_address