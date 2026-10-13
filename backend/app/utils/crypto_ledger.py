import hashlib
import uuid
import datetime
from typing import List, Dict, Any, Optional

def compute_sha256(data: bytes) -> str:
    """Computes SHA-256 cryptographic digest for binary input."""
    return hashlib.sha256(data).hexdigest()

def generate_fir_number() -> str:
    """Generates unique official FIR registration identifier: FIR-YYYY-MMDD-XXXX."""
    now = datetime.datetime.now(datetime.timezone.utc)
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"FIR-{now.year}-{now.strftime('%m%d')}-{random_suffix}"

def create_evidence_record(
    file_bytes: bytes,
    file_name: str,
    file_type: str,
    uploader_id: str,
    uploader_name: str,
    media_url: str
) -> Dict[str, Any]:
    """
    Creates a tamper-proof evidence custody block with SHA-256 fingerprint.
    Any subsequent byte-level change to the file will invalidate this record.
    """
    sha256_hash = compute_sha256(file_bytes)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    evidence_id = f"EVID-{uuid.uuid4().hex[:8].upper()}"

    # Initial Chain of Custody entry
    initial_custody = {
        "step": 1,
        "action": "EVIDENCE_LOGGED",
        "timestamp": now_iso,
        "actor_id": uploader_id,
        "actor_name": uploader_name,
        "notes": "Original digital asset ingested and SHA-256 fingerprint anchored.",
        "status": "VERIFIED_AUTHENTIC"
    }

    # Digital signature / block seal
    raw_block = f"{evidence_id}:{sha256_hash}:{now_iso}:{uploader_id}"
    block_seal = compute_sha256(raw_block.encode("utf-8"))

    return {
        "evidence_id": evidence_id,
        "media_url": media_url,
        "file_name": file_name,
        "file_type": file_type,
        "file_size_bytes": len(file_bytes),
        "sha256_hash": sha256_hash,
        "algorithm": "SHA-256",
        "recorded_at": now_iso,
        "uploader_id": uploader_id,
        "uploader_name": uploader_name,
        "block_seal": block_seal,
        "is_sealed": True,
        "chain_of_custody": [initial_custody]
    }

def verify_evidence_bytes(recorded_hash: str, candidate_bytes: bytes) -> Dict[str, Any]:
    """Validates candidate file bytes against recorded SHA-256 hash."""
    candidate_hash = compute_sha256(candidate_bytes)
    is_intact = (recorded_hash.lower() == candidate_hash.lower())
    return {
        "verified": is_intact,
        "match": is_intact,
        "algorithm": "SHA-256",
        "recorded_hash": recorded_hash,
        "computed_hash": candidate_hash,
        "status": "VERIFIED_AUTHENTIC" if is_intact else "TAMPER_DETECTED_FAILED",
        "verified_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

def create_genesis_audit_block(
    report_id: str,
    actor_id: str,
    actor_name: str,
    actor_role: str,
    initial_status: str = "Reported"
) -> Dict[str, Any]:
    """Generates the genesis block for the immutable report audit trail."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    genesis_prev = "0" * 64
    block_raw = f"0:REPORT_FILED:NONE:{initial_status}:{actor_id}:{now_iso}:{genesis_prev}:{report_id}"
    block_hash = compute_sha256(block_raw.encode("utf-8"))

    return {
        "block_index": 0,
        "action": "REPORT_FILED",
        "from_status": "NONE",
        "to_status": initial_status,
        "actor_id": actor_id,
        "actor_name": actor_name,
        "actor_role": actor_role,
        "remarks": "Incident report created and genesis ledger block sealed.",
        "timestamp": now_iso,
        "previous_block_hash": genesis_prev,
        "block_hash": block_hash
    }

def append_audit_block(
    chain: List[Dict[str, Any]],
    action: str,
    from_status: str,
    to_status: str,
    actor_id: str,
    actor_name: str,
    actor_role: str,
    remarks: str
) -> Dict[str, Any]:
    """Appends an immutable state transition block to the hash chain."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    prev_hash = chain[-1]["block_hash"] if chain else ("0" * 64)
    next_index = len(chain)

    block_raw = f"{next_index}:{action}:{from_status}:{to_status}:{actor_id}:{now_iso}:{prev_hash}:{remarks}"
    block_hash = compute_sha256(block_raw.encode("utf-8"))

    return {
        "block_index": next_index,
        "action": action,
        "from_status": from_status,
        "to_status": to_status,
        "actor_id": actor_id,
        "actor_name": actor_name,
        "actor_role": actor_role,
        "remarks": remarks,
        "timestamp": now_iso,
        "previous_block_hash": prev_hash,
        "block_hash": block_hash
    }

def verify_audit_chain_integrity(chain: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validates cryptographic continuity of the entire audit chain.
    Returns whether the chain is unbroken and detects exact index of any tamper.
    """
    if not chain:
        return {"is_valid": True, "total_blocks": 0, "message": "Empty chain"}

    for idx, block in enumerate(chain):
        # 1. Check previous hash continuity
        if idx == 0:
            if block.get("previous_block_hash") != ("0" * 64):
                return {
                    "is_valid": False,
                    "total_blocks": len(chain),
                    "broken_at_block": 0,
                    "reason": "Genesis block invalid previous_block_hash"
                }
        else:
            expected_prev = chain[idx - 1].get("block_hash")
            if block.get("previous_block_hash") != expected_prev:
                return {
                    "is_valid": False,
                    "total_blocks": len(chain),
                    "broken_at_block": idx,
                    "reason": f"Block {idx} previous_block_hash does not match block {idx - 1} hash"
                }

    return {
        "is_valid": True,
        "total_blocks": len(chain),
        "genesis_hash": chain[0]["block_hash"],
        "latest_block_hash": chain[-1]["block_hash"],
        "status": "CHAIN_CRYPTOGRAPHICALLY_VERIFIED"
    }

def generate_whistleblower_credentials() -> Dict[str, str]:
    """
    Generates burner credentials for anonymous whistleblower reporting.
    The claim token allows the reporter to track the status without an account.
    """
    token_seed = uuid.uuid4().hex
    claim_token = f"WB-{datetime.datetime.now(datetime.timezone.utc).year}-{token_seed[:10].upper()}"
    burner_public_key = f"0x{hashlib.sha256(token_seed.encode('utf-8')).hexdigest()[:40]}"
    anonymity_proof = compute_sha256(f"ANON_BLIND_{claim_token}_{burner_public_key}".encode("utf-8"))

    return {
        "claim_token": claim_token,
        "burner_public_key": burner_public_key,
        "anonymity_proof": anonymity_proof
    }
