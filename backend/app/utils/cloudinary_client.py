import cloudinary
import cloudinary.uploader
from app.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)


def upload_image(file, folder="trinetra/reports"):
    result = cloudinary.uploader.upload(file, folder=folder)
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
    }


def upload_video(file, folder="trinetra/reports"):
    result = cloudinary.uploader.upload(
        file,
        folder=folder,
        resource_type="video",
    )
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
    }


def delete_image(public_id):
    return cloudinary.uploader.destroy(public_id)


def delete_video(public_id):
    return cloudinary.uploader.destroy(public_id, resource_type="video")