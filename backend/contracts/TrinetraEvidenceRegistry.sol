// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrinetraEvidenceRegistry
 * @dev Immutable on-chain registry for criminal incident evidence hashes, FIR records,
 * and deterministic lifecycle state transitions. Compliant with electronic record admissibility.
 */
contract TrinetraEvidenceRegistry {

    enum IncidentState {
        Reported,
        FIRFiled,
        Investigating,
        ChargesheetSubmitted,
        Resolved,
        Closed
    }

    struct EvidenceRecord {
        bytes32 fileHash;        // SHA-256 cryptographic digest of the media file
        string evidenceId;       // Internal identifier (e.g. EVID-XXXXX)
        address recordedBy;      // Officer or citizen public address
        uint256 timestamp;       // Block timestamp of registration
        bool exists;
    }

    struct FIRRecord {
        string firNumber;        // Deterministic FIR identifier (FIR-YYYY-MMDD-XXXX)
        bytes32 reportId;        // Report unique hash
        string policeStation;    // Station jurisdiction
        address officer;         // Registering officer
        uint256 lodgedAt;        // Timestamp
        IncidentState state;
        bool exists;
    }

    struct AuditBlock {
        uint256 blockIndex;
        string action;
        IncidentState fromState;
        IncidentState toState;
        bytes32 blockHash;       // SHA-256 hash of block contents
        bytes32 prevBlockHash;   // Hash of preceding block
        address actor;
        uint256 timestamp;
    }

    address public owner;
    
    // Mapping from file SHA-256 hash to Evidence Record
    mapping(bytes32 => EvidenceRecord) public evidenceRegistry;

    // Mapping from Report ID hash to FIR Record
    mapping(bytes32 => FIRRecord) public firRegistry;

    // Mapping from Report ID hash to array of Audit Blocks
    mapping(bytes32 => AuditBlock[]) public auditChains;

    // Events for off-chain indexing (The Graph / Webhooks)
    event EvidenceAnchored(bytes32 indexed fileHash, string evidenceId, address indexed recordedBy, uint256 timestamp);
    event FIRLodged(bytes32 indexed reportId, string firNumber, string policeStation, address indexed officer, uint256 timestamp);
    event LifecycleAdvanced(bytes32 indexed reportId, IncidentState fromState, IncidentState toState, bytes32 blockHash, address indexed actor);

    modifier onlyOwner() {
        require(msg.sender == owner, "Trinetra: Caller is not contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Anchors a file's SHA-256 hash permanently onto the blockchain.
     */
    function recordEvidence(
        bytes32 _fileHash,
        string calldata _evidenceId
    ) external returns (bool) {
        require(!evidenceRegistry[_fileHash].exists, "Trinetra: Evidence hash already registered");

        evidenceRegistry[_fileHash] = EvidenceRecord({
            fileHash: _fileHash,
            evidenceId: _evidenceId,
            recordedBy: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        emit EvidenceAnchored(_fileHash, _evidenceId, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @dev Records a formal First Information Report (FIR) on-chain.
     */
    function lodgeFIR(
        bytes32 _reportId,
        string calldata _firNumber,
        string calldata _policeStation
    ) external returns (bool) {
        require(!firRegistry[_reportId].exists, "Trinetra: FIR already lodged for this report");

        firRegistry[_reportId] = FIRRecord({
            firNumber: _firNumber,
            reportId: _reportId,
            policeStation: _policeStation,
            officer: msg.sender,
            lodgedAt: block.timestamp,
            state: IncidentState.FIRFiled,
            exists: true
        });

        emit FIRLodged(_reportId, _firNumber, _policeStation, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @dev Appends an immutable lifecycle transition block to the on-chain audit chain.
     */
    function appendAuditBlock(
        bytes32 _reportId,
        string calldata _action,
        IncidentState _fromState,
        IncidentState _toState,
        bytes32 _blockHash,
        bytes32 _prevBlockHash
    ) external returns (uint256) {
        uint256 newIndex = auditChains[_reportId].length;

        auditChains[_reportId].push(AuditBlock({
            blockIndex: newIndex,
            action: _action,
            fromState: _fromState,
            toState: _toState,
            blockHash: _blockHash,
            prevBlockHash: _prevBlockHash,
            actor: msg.sender,
            timestamp: block.timestamp
        }));

        if (firRegistry[_reportId].exists) {
            firRegistry[_reportId].state = _toState;
        }

        emit LifecycleAdvanced(_reportId, _fromState, _toState, _blockHash, msg.sender);
        return newIndex;
    }

    /**
     * @dev Verification helper: checks if an evidence hash exists and returns its custody details.
     */
    function verifyEvidence(bytes32 _fileHash) external view returns (
        bool isAuthentic,
        string memory evidenceId,
        address recordedBy,
        uint256 timestamp
    ) {
        EvidenceRecord memory record = evidenceRegistry[_fileHash];
        if (record.exists) {
            return (true, record.evidenceId, record.recordedBy, record.timestamp);
        }
        return (false, "", address(0), 0);
    }

    /**
     * @dev Returns the full length of audit blocks for a given report.
     */
    function getAuditChainLength(bytes32 _reportId) external view returns (uint256) {
        return auditChains[_reportId].length;
    }
}
