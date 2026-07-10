# Trinetra - Smart Crime Reporting System Backend

This is the production-ready backend for the **Smart Crime Reporting System**, built on top of FastAPI, MongoDB (Motor), Firebase Authentication, and Socket.IO.

It handles anonymous/public civic incident reports, geolocates coordinates to physical addresses, enforces upvoting boundaries, uses Google Gemini for duplicate/fake incident scanning, and sends real-time system alerts.

---

## 🛠️ Tech Stack
*   **Framework**: FastAPI (Python)
*   **Web Server**: Uvicorn
*   **Database**: MongoDB Atlas (Async Motor driver)
*   **Authentication**: Firebase Admin SDK
*   **Real-time Communication**: python-socketio (ASGI integrated)
*   **AI Scan Engine**: Google Gemini API (`gemini-1.5-flash`)
*   **Location Services**: Google Geocoding API / OSM Nominatim
*   **Testing**: pytest / pytest-asyncio / mongomock

---

## 📂 Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Application bootstrap & ASGI pipeline mapping
│   ├── config.py            # Environment configurations validation via Pydantic
│   ├── db.py                # Motor MongoDB database wrapper & index managers
│   ├── firebase.py          # Firebase Auth SDK and role verification middleware
│   ├── models/              # Pydantic data schemas
│   │   ├── __init__.py
│   │   ├── user.py          # Onboarding and profiles schemas
│   │   ├── report.py        # Crime reports payload validation
│   │   ├── vote.py          # Upvote registry validators
│   │   └── notification.py  # System notifications models
│   ├── routes/              # API endpoints
│   │   ├── __init__.py
│   │   ├── auth.py          # Onboarding, Profile, and Admin authority approvals
│   │   ├── reports.py       # Crime reports, voting, status workflows & AI scans
│   │   └── admin.py         # Stats dashboard & flagged reports review queue
│   └── utils/               # Services & utilities
│       ├── __init__.py
│       ├── socket_manager.py # Socket.IO connection event & room broadcasts
│       ├── geocoding.py      # Lat/Lng to physical address resolver
│       └── gemini.py         # Google Gemini API duplicate checking agent
├── tests/                   # Automated unit testing suite
│   ├── __init__.py
│   └── test_api.py          # Mock verification tests
├── requirements.txt         # Package dependencies list
├── .env.example             # Template setup parameters
└── README.md                # Documentation guide
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the `backend/` directory.

```ini
PORT=8000
HOST=0.0.0.0
ENVIRONMENT=development

# Database connection
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=trinetra

# Firebase Auth Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
# Path to service account key JSON file
FIREBASE_CREDENTIALS_PATH=firebase-credentials.json

# External Service Integrations
GEMINI_API_KEY=your-gemini-api-key
MAPBOX_API_KEY=your-mapbox-api-key

# Local Testing Mock Mode
MOCK_AUTH_ENABLED=true
MOCK_AUTH_SECRET=trinetra_development_secret
```

### Mock Authentication Mode (Development)
If `MOCK_AUTH_ENABLED=true`, you can skip configuring Firebase and external keys for testing. Simply pass a Bearer token matching this pattern:
*   Format: `mock_token_<role>_<uid>_<email>`
*   Examples:
    *   Citizen: `Authorization: Bearer mock_token_citizen_user123_citizen@test.com`
    *   Authority: `Authorization: Bearer mock_token_authority_auth123_auth@test.com`
    *   Admin: `Authorization: Bearer mock_token_admin_admin001_admin@test.com`

---

## 🚀 Installation & Running

### 1. Install Dependencies
Make sure you have python 3.12 or above. If running Python 3.14 (or similar newer version on Windows), relaxed pins in `requirements.txt` prevent compilation failures:
```bash
pip install -r backend/requirements.txt
```

### 2. Run MongoDB Locally
Ensure MongoDB is active on `localhost:27017` or insert your MongoDB Atlas URI in `.env`.

### 3. Run FastAPI Application
```bash
uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload
```
The server will bind on `http://localhost:8000`.

---

## ⚡ WebSocket Events & Rooms

Socket.IO connections are handled via ASGI mount at `/socket.io/`.
To authenticate, pass the token inside the connection auth payload:
`sio.connect("http://localhost:8000", auth={"token": "mock_token_..."})`

### Connection Rooms:
*   **`admins`**: Joined automatically by users with the `admin` role.
*   **`authorities`**: Joined automatically by verified authorities and admins.
*   **`user_{uid}`**: Private user room for direct state updates.

### Broadcast Events:
*   `new_report` (to `authorities` room): Fired when a standard report is created.
*   `emergency_alert` (to `authorities` room): Fired when an emergency report is created.
*   `global_emergency` (broadcast to everyone): Alerts all connected clients of a critical local incident.
*   `status_changed` (to `user_{uid}`): Pushes status updates (e.g. `Pending` -> `Ongoing` -> `Resolved`) directly to the citizen who filed the report.
*   `admin_notification` (to `admins` room): Triggers warning alerts to reviews when reports are flagged.

---

## 📡 API Reference

### 🔐 Authentication (`/auth`)
*   `POST /auth/sync`: Syncs current logged-in Firebase user metadata with MongoDB. Users request a `role` (`citizen` / `authority`). Citizen is auto-approved. Authority starts as pending.
    *   *Note on Admin Accounts*: Admins cannot request an `admin` role via the public sync API to prevent privilege escalation. Admins are pre-created using the seeding CLI script:
        ```bash
        python seed_admin.py <firebase_uid> <email> <name>
        ```
        Once seeded in the database, logging in via Firebase with that UID maps directly to the `"admin"` role.
*   `GET /auth/me`: Fetches the authenticated user profile.
*   `GET /auth/authority/pending`: (Admin-only) Lists pending authorities.
*   `POST /auth/authority/{firebase_uid}/approve`: (Admin-only) Approves a pending authority.

### 📋 Complaints & Reports (`/reports`)
*   `POST /reports`: Creates a crime report. Auto reverse-geocodes lat/lng into address strings.
*   `GET /reports`: Lists reports sorted by `emergencyFlag` (desc) and `createdAt` (desc). Filters by `category` and `status` are supported.
*   `GET /reports/nearby`: Geospatial query retrieving reports within a radius using MongoDB `$nearSphere`.
*   `POST /reports/{id}/vote`: Casts a vote. Blocks self-voting and double-voting.
*   `PATCH /reports/{id}/status`: (Authority/Admin-only) Progresses status (`Pending` -> `Ongoing` -> `Resolved`).
*   `POST /reports/{id}/flag`: (Authority/Admin-only) Flags report as suspicious.
*   `POST /reports/{id}/verify-ai`: (Authority/Admin-only) Invokes Google Gemini validation algorithms.

### 👑 Administration (`/admin`)
*   `GET /admin/stats`: (Admin-only) Totals for citizens, authorities, reports, and active status subsets.
*   `POST /admin/reports/{id}/review`: (Admin-only) Resolves flagged complaints (`Restored` to clean flag, or `Fake Report` to delete).
*   `GET /admin/export/csv`: (Admin-only) Downloads database exports as formatted CSV attachments (`type=citizens`, `type=authorities`, or `type=resolved_reports`).
*   `POST /admin/users/{firebase_uid}/toggle-active`: (Admin-only) Toggles user suspension state (`is_active` True/False). Blocked users are immediately locked out and receive HTTP 403 Forbidden.
*   `DELETE /admin/users/{firebase_uid}`: (Admin-only) Permanently deletes a user document and their corresponding voting histories from MongoDB.

---

## 🧪 Testing

Run the automated unit testing suite:
```bash
python -m pytest backend/tests -v
```
All tests verify endpoint validations, access checks, upvoting blocks, database modifications, and schema alignment.
