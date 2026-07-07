import asyncio
import sys
from datetime import datetime
from app.config import settings
from app.db import db

async def seed_admin(firebase_uid: str, email: str, name: str):
    """
    Inserts or updates a user document in MongoDB to have the 'admin' role.
    This fulfills the SRS requirement that admin accounts are pre-created.
    """
    print(f"Attempting to seed admin: {name} ({email}) with UID: {firebase_uid}")
    
    # Connect to database
    await db.connect_db()
    
    admin_doc = {
        "firebase_uid": firebase_uid,
        "email": email,
        "name": name,
        "role": "admin",
        "is_approved": True,
        "createdAt": datetime.utcnow()
    }
    
    # Check if user already exists
    existing = await db.users.find_one({"firebase_uid": firebase_uid})
    if existing:
        print(f"User with UID {firebase_uid} already exists in DB (current role: '{existing.get('role')}').")
        # Update existing user to admin
        await db.users.update_one(
            {"firebase_uid": firebase_uid},
            {"$set": {"role": "admin", "is_approved": True}}
        )
        print("Role updated to 'admin' (is_approved=True) successfully.")
    else:
        # Create new admin user
        await db.users.insert_one(admin_doc)
        print(f"Created new admin user document in MongoDB successfully.")
        
    await db.close_db()

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Error: Missing arguments.")
        print("Usage: python seed_admin.py <firebase_uid> <email> <name>")
        sys.exit(1)
        
    uid = sys.argv[1]
    email = sys.argv[2]
    name = sys.argv[3]
    
    asyncio.run(seed_admin(uid, email, name))
