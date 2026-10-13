import logging
from math import radians, sin, cos, sqrt, atan2
import mongomock
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

logger = logging.getLogger(__name__)

def haversine_distance(coord1, coord2):
    # coord = [lng, lat]
    lng1, lat1 = coord1
    lng2, lat2 = coord2
    R = 6371000.0 # Earth radius in meters
    phi1, phi2 = radians(lat1), radians(lat2)
    delta_phi = radians(lat2 - lat1)
    delta_lambda = radians(lng2 - lng1)
    a = sin(delta_phi / 2)**2 + cos(phi1) * cos(phi2) * sin(delta_lambda / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

class MockListCursor:
    def __init__(self, items):
        self._items = items

    def limit(self, val):
        self._items = self._items[:val]
        return self

    def sort(self, *args, **kwargs):
        return self

    def skip(self, val):
        self._items = self._items[val:]
        return self

    async def to_list(self, length=None):
        if length is not None:
            return self._items[:length]
        return self._items

    def __aiter__(self):
        self._iterator = iter(self._items)
        return self

    async def __anext__(self):
        try:
            return next(self._iterator)
        except StopIteration:
            raise StopAsyncIteration

class MockAsyncCursor:
    def __init__(self, sync_cursor):
        self._sync_cursor = sync_cursor

    def limit(self, val):
        self._sync_cursor.limit(val)
        return self

    def sort(self, *args, **kwargs):
        self._sync_cursor.sort(*args, **kwargs)
        return self

    def skip(self, val):
        self._sync_cursor.skip(val)
        return self

    async def to_list(self, length=None):
        docs = list(self._sync_cursor)
        if length is not None:
            docs = docs[:length]
        return docs

    def __aiter__(self):
        self._iterator = iter(self._sync_cursor)
        return self

    async def __anext__(self):
        try:
            return next(self._iterator)
        except StopIteration:
            raise StopAsyncIteration

class MockAsyncCollection:
    def __init__(self, sync_collection):
        self._sync_collection = sync_collection

    async def find_one(self, *args, **kwargs):
        return self._sync_collection.find_one(*args, **kwargs)

    async def insert_one(self, *args, **kwargs):
        return self._sync_collection.insert_one(*args, **kwargs)

    async def insert_many(self, *args, **kwargs):
        return self._sync_collection.insert_many(*args, **kwargs)

    async def update_one(self, *args, **kwargs):
        return self._sync_collection.update_one(*args, **kwargs)

    async def update_many(self, *args, **kwargs):
        return self._sync_collection.update_many(*args, **kwargs)

    async def find_one_and_update(self, filter, update, projection=None, sort=None, return_document=False, **kwargs):
        from pymongo import ReturnDocument
        if return_document is True:
            ret_doc = ReturnDocument.AFTER
        elif return_document is False:
            ret_doc = ReturnDocument.BEFORE
        else:
            ret_doc = return_document

        return self._sync_collection.find_one_and_update(
            filter, update, projection=projection, sort=sort, return_document=ret_doc, **kwargs
        )

    async def delete_one(self, *args, **kwargs):
        return self._sync_collection.delete_one(*args, **kwargs)

    async def delete_many(self, *args, **kwargs):
        return self._sync_collection.delete_many(*args, **kwargs)

    async def count_documents(self, *args, **kwargs):
        return self._sync_collection.count_documents(*args, **kwargs)

    def find(self, query=None, *args, **kwargs):
        query = query or {}
        geo_query = query.get("geo_location", {})
        near_sphere = geo_query.get("$nearSphere") if isinstance(geo_query, dict) else None
        if near_sphere:
            geometry = near_sphere.get("$geometry", {})
            center = geometry.get("coordinates")
            max_dist = near_sphere.get("$maxDistance", float('inf'))
            all_docs = list(self._sync_collection.find())
            matching_docs = []
            for doc in all_docs:
                geo = doc.get("geo_location")
                if geo and geo.get("type") == "Point":
                    coords = geo.get("coordinates")
                    if coords:
                        dist = haversine_distance(center, coords)
                        if dist <= max_dist:
                            doc_copy = doc.copy()
                            doc_copy["_distance"] = dist
                            matching_docs.append(doc_copy)
            matching_docs.sort(key=lambda x: x.get("_distance", 0))
            for doc in matching_docs:
                doc.pop("_distance", None)
            return MockListCursor(matching_docs)

        sync_cursor = self._sync_collection.find(query, *args, **kwargs)
        return MockAsyncCursor(sync_cursor)

    async def create_index(self, *args, **kwargs):
        return self._sync_collection.create_index(*args, **kwargs)

class MockAsyncDatabase:
    def __init__(self, sync_db):
        self._sync_db = sync_db

    def __getattr__(self, name):
        return MockAsyncCollection(getattr(self._sync_db, name))

    async def command(self, cmd, *args, **kwargs):
        if cmd == "ping":
            return {"ok": 1.0}
        return {}

class MockAsyncMongoClient:
    def __init__(self, *args, **kwargs):
        self._sync_client = mongomock.MongoClient()

    def __getitem__(self, name):
        return MockAsyncDatabase(self._sync_client[name])

    def close(self):
        pass

class Database:
    client = None
    db = None

    @classmethod
    async def connect_db(cls):
        """Establish MongoDB connection and create necessary indexes."""
        if cls.client is not None:
            return

        logger.info(f"Connecting to MongoDB at {settings.MONGO_URI}...")
        try:
            cls.client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=2000)
            cls.db = cls.client[settings.MONGO_DB_NAME]
            
            # Ping database to verify connection
            await cls.db.command("ping")
            logger.info("Successfully connected to MongoDB!")
            
            # Create indexes
            await cls._create_indexes()
        except Exception as e:
            logger.warning(f"Failed to connect to MongoDB: {e}. Falling back to In-Memory Mock Database.")
            cls.client = MockAsyncMongoClient()
            cls.db = cls.client[settings.MONGO_DB_NAME]
            await cls._create_indexes()

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
