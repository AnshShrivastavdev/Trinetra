# 🗺️ TRINETRA — Project Implementation & Engineering Roadmap

This document outlines the multi-phase engineering plan, current operational state, and future milestones for the **Trinetra Smart Crime Reporting & Immutable Evidence Custody System**.

---

## 📌 1. Project Overview & Core Objectives

| Metric | Target |
| :--- | :--- |
| **Primary Goal** | Bridge citizen incident reporting with tamper-proof digital evidence custody and transparent police handling. |
| **Target Users** | Citizens, Whistleblowers, Law Enforcement Officers, Forensics Teams, Judiciary. |
| **Legal Admissibility** | Adheres to **Section 65B of the Indian Evidence Act / Bharatiya Sakshya Adhiniyam** standards for cryptographic electronic evidence integrity. |
| **System Availability** | High-availability ASGI pipeline with MongoDB 2dsphere indexing and WebSocket push notifications. |

---

## 🚦 2. Phase-by-Phase Implementation Status

```
[Phase 1: Core Foundation] ───► [Phase 2: Real-time & AI] ───► [Phase 3: Cryptography & FIR]
         ✅ COMPLETED                    ✅ COMPLETED                      ✅ COMPLETED
                                                                                 │
                                                                                 ▼
[Phase 6: Prod Cloud Deploy] ◄── [Phase 5: Mobile & WebRTC] ◄── [Phase 4: EVM Blockchain]
          ✅ COMPLETED                    ✅ COMPLETED                      ✅ COMPLETED
```

---

### ✅ Phase 1: Core Platform Foundation & Spatial Indexing (COMPLETED)
- [x] **FastAPI ASGI Backend Architecture**: Modular routing structure (`auth`, `reports`, `admin`).
- [x] **MongoDB 2dsphere Geospatial Engine**: Proximity searches within 5km radius with coordinates to physical address resolution.
- [x] **Role-Based Access Control (RBAC)**: Support for `Citizen`, `Authority`, and `Admin` permissions.
- [x] **Dual Authentication Pipeline**: Firebase Authentication SDK + Email OTP Service + Local mock developer authentication.
- [x] **Database Resilience**: Motor Async MongoDB client with automated fallback to in-memory `mongomock` database when offline.

---

### ✅ Phase 2: Real-Time Dispatch & AI Verification (COMPLETED)
- [x] **WebSocket Event Gateway**: python-socketio integration broadcasting critical emergency alerts and lifecycle updates to active client rooms.
- [x] **Google Gemini 1.5 AI Scan Engine**: Automated duplicate detection and suspicion scoring comparing new reports against incidents in a 5km radius.
- [x] **Cloudinary Digital Vault**: Media upload pipeline with MIME detection for photos, audio, and CCTV video clips.
- [x] **Community Upvoting Engine**: Anti-sybil validation preventing self-voting and duplicate voting with compound unique database indexes.

---

### ✅ Phase 3: Cryptographic Custody, FIR Tracking & Whistleblower Protocol (COMPLETED)
- [x] **Tamper-Proof Evidence Auditing (SHA-256)**:
  - Real-time cryptographic digest generation upon media ingestion.
  - Creation of digital Chain of Custody entries (`EVID-XXXXX`) detailing timestamps, file byte-size, and officer ID.
  - Interactive **Evidence Audit Tool** verifying byte-level authenticity against the ledger.
- [x] **Transparent FIR & Deterministic Lifecycle**:
  - Deterministic state machine:
    $$\text{Reported} \longrightarrow \text{FIR Filed} \longrightarrow \text{Investigating} \longrightarrow \text{Charge-Sheet Submitted} \longrightarrow \text{Resolved}$$
  - Official FIR registration API generating `FIR-YYYY-MMDD-XXXX` identifiers with legal sections (BNS 303, IT Act 66D).
  - Cryptographic hash-chained audit blocks with continuity validation:
    $$\text{block\_hash} = \text{SHA-256}(\text{index} : \text{action} : \text{from\_status} : \text{to\_status} : \text{actor} : \text{prev\_hash})$$
- [x] **Anonymous Whistleblower Protection (Burner Secret Key)**:
  - Whistleblower protocol completely strips user UID, email, and IP address.
  - Generates a unique Claim Secret (`WB-YYYY-XXXXXX`).
  - Zero-auth public portal allowing whistleblowers to query police handling and audit blocks without logging in.
- [x] **Multi-Agency Access Control**:
  - Routing logic across `Local Police`, `Cyber Crime Cell`, `Forensics Bureau`, and `Judiciary`.

---

### ✅ Phase 4: Public EVM Blockchain Testnet Anchoring (COMPLETED)
- [x] **Solidity Smart Contract (`contracts/TrinetraEvidenceRegistry.sol`)**:
  - Implements `recordEvidence`, `lodgeFIR`, `appendAuditBlock`, and `verifyEvidence`.
  - Compliant with electronic record admissibility and gas-optimized for EVM testnets.
- [x] **Zero-Dependency EVM JSON-RPC Gateway (`app/utils/blockchain_anchor.py`)**:
  - Connects to Polygon Amoy Testnet (Chain ID 80002) / Sepolia JSON-RPC endpoints.
  - Generates verifiable EIP-155 transaction receipts, block confirmations, and Polygonscan explorer URLs (`https://amoy.polygonscan.com/tx/0x...`).
- [x] **On-Chain Endpoints & UI Explorer**:
  - `POST /reports/{id}/anchor-onchain` and `GET /reports/{id}/onchain-proof`.
  - Interactive "Anchor on Blockchain" button and live Polygonscan link in `AuditTrailModal.tsx`.

---

### ✅ Phase 5: On-Scene Hardware Capture & Direct WebRTC Ingest (COMPLETED)
- [x] **Direct In-Browser Camera & Audio Recording (`LiveCameraModal.tsx`)**:
  - Direct hardware access using `navigator.mediaDevices.getUserMedia` with front/back camera flipping.
  - High-res snapshot photography & live video recording via `MediaRecorder` API.
- [x] **Real-Time Client-Side SHA-256 Fingerprinting**:
  - Uses browser `window.crypto.subtle.digest("SHA-256", arrayBuffer)` to cryptographically seal media bytes right on the device before transmission.
- [x] **On-Scene Visual Watermarking**:
  - Canvas-rendered on-scene watermark embedding GPS coordinates (`Lat/Lng`), UTC ISO timestamp, and `TRINETRA LIVE ON-SCENE SECURE CAPTURE` header.
- [x] **Auto-Signing & Ingestion**:
  - Automatically pushes captured media and client-computed SHA-256 hash into the incident's immutable `evidenceLedger`.

---

### ✅ Phase 6: Production Hardening, CI/CD & Deployment (COMPLETED)
- [x] **Production Multi-Stage Containerization**:
  - [`backend/Dockerfile`](file:///c:/Users/Asus/OneDrive/Desktop/Trinetra/backend/Dockerfile): Minimalist `python:3.12-slim` image, non-root `appuser`, curl healthchecks, and ASGI socket server.
  - [`frontend/Dockerfile`](file:///c:/Users/Asus/OneDrive/Desktop/Trinetra/frontend/Dockerfile): Multi-stage build (`node:20-alpine` builder + `nginx:alpine-slim` runtime) with SPA routing, gzip compression, and security headers.
  - [`frontend/nginx.conf`](file:///c:/Users/Asus/OneDrive/Desktop/Trinetra/frontend/nginx.conf): High-performance Nginx reverse-proxy configuration handling `/api` and full-duplex `/socket.io` WebSockets.
  - [`docker-compose.yml`](file:///c:/Users/Asus/OneDrive/Desktop/Trinetra/docker-compose.yml): Fully orchestrated local and cloud runtime with MongoDB 7.0, Redis 7.0, FastAPI backend, and Nginx frontend.
- [x] **Automated CI/CD Pipeline ([`.github/workflows/ci.yml`](file:///c:/Users/Asus/OneDrive/Desktop/Trinetra/.github/workflows/ci.yml))**:
  - Automated `pytest` backend execution across matrix Python versions.
  - Frontend TypeScript compile (`tsc -b`) and Vite production bundling checks.
  - Automated Docker container build verification on pull request and merge.
- [x] **Observability & Health Monitoring**:
  - `/health` endpoint returning system uptime, DB connectivity, and runtime environment.
  - `/metrics` endpoint surfacing real-time incident counters, registered user statistics, and microservice status.

---

## 📊 3. Verification & Acceptance Testing Protocol

To ensure production compliance, every release candidate must satisfy the following test matrix:

| Test Scenario | Verification Command | Expected Output |
| :--- | :--- | :--- |
| **Backend Unit & Cryptographic Test Suite** | `pytest backend/tests` | `18 passed in < 3s` |
| **Health & Metrics Observability Test** | `test_health_alias_and_metrics` | Status 200, uptime, operational metrics reported. |
| **Evidence SHA-256 Byte Invariance Test** | `test_evidence_hashing_and_upload` | SHA-256 length == 64, sealed record generated. |
| **FIR Lifecycle Audit Continuity Test** | `test_lodge_fir_and_audit_trail_continuity` | `FIR-` generated, block sealed with matching parent hash. |
| **Whistleblower Privacy Test** | `test_whistleblower_anonymous_submission_and_lookup` | Zero UID/email leakage, anonymous query succeeds with claim token. |
| **Frontend Production Build** | `npm run build` (in `/frontend`) | Clean compilation with Vite & TypeScript. |

---

## 📝 4. Summary of Completed Deliverables

All deliverables under **Phases 1 through 6** are fully implemented, verified with automated tests, and committed across the codebase. Trinetra is ready for end-to-end demonstration, Docker multi-container deployment, and municipal / law enforcement production rollouts.
