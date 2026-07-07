import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

    @classmethod
    async def connect_db(cls):
        """Establish MongoDB connection and create necessary indexes."""
        if cls.client is not None:
            return

        logger.info(f"Connecting to MongoDB at {settings.MONGO_URI}...")
        try:
            cls.client = AsyncIOMotorClient(settings.MONGO_URI)
            cls.db = cls.client[settings.MONGO_DB_NAME]
            
            # Ping database to verify connection
            await cls.db.command("ping")
            logger.info("Successfully connected to MongoDB!")
            
            # Create indexes
            await cls._create_indexes()
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise e

    @classmethod
    async def close_db(cls):
        """Close MongoDB connection."""
        if cls.client is not None:
            cls.client.close()
            cls.client = None
            cls.db = None
            logger.info("MongoDB connection closed.")

    @classmethod
    async def _create_indexes(cls):
        """Create database collections indexes."""
        logger.info("Creating MongoDB indexes...")
        
        # 1. Users collection indexes
        # Unique index on firebase_uid
        await cls.db.users.create_index("firebase_uid", unique=True)
        # Index on role and approval status
        await cls.db.users.create_index([("role", 1), ("is_approved", 1)])
        
        # 2. Reports collection indexes
        # 2dsphere index for location-based nearby queries
        await cls.db.reports.create_index([("geo_location", "2dsphere")])
        # Compound index for sorting by emergencyFlag (desc) and createdAt (desc)
        await cls.db.reports.create_index([("emergencyFlag", -1), ("createdAt", -1)])
        # Status index
        await cls.db.reports.create_index("status")
        # Anonymity index
        await cls.db.reports.create_index("anonymityFlag")
        
        # 3. Votes collection indexes
        # Compound unique index to prevent duplicate voting (one vote per user per report)
        await cls.db.votes.create_index([("userId", 1), ("reportId", 1)], unique=True)
        
        # 4. Notifications collection indexes
        # Index on userId for fast delivery queries
        await cls.db.notifications.create_index("userId")
        # TTL index or sorting index on createdAt
        await cls.db.notifications.create_index([("createdAt", -1)])
        
        logger.info("MongoDB indexes created successfully.")

    @property
    def users(self):
        return self.db.users

    @property
    def reports(self):
        return self.db.reports

    @property
    def votes(self):
        return self.db.votes

    @property
    def notifications(self):
        return self.db.notifications

# Singleton instance access
db = Database()
