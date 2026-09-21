// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EvidenceNotary - Immutable Forensic Custody Notary
 * @notice SIH 2026 Problem Statement #26106
 * @dev Notarizes SHA-256 evidence digests on Polygon Amoy testnet for legal admissibility
 *      under Section 65B Indian Evidence Act / Bharatiya Sakshya Adhiniyam (BSA) 2023.
 */
contract EvidenceNotary {
    address public immutable authority;

    struct EvidenceRecord {
        bytes32 evidenceHash;
        string caseId;
        string originIp;
        uint8 threatScore;
        uint256 timestamp;
        address notarizedBy;
    }

    mapping(bytes32 => EvidenceRecord) public records;
    bytes32[] public evidenceList;

    event EvidenceNotarized(
        bytes32 indexed evidenceHash,
        string caseId,
        uint8 threatScore,
        uint256 timestamp,
        address indexed notarizedBy
    );

    error EvidenceAlreadyRegistered(bytes32 evidenceHash);
    error InvalidEvidenceHash();

    modifier onlyAuthority() {
        require(msg.sender == authority, "Not authorized notary authority");
        _;
    }

    constructor() {
        authority = msg.sender;
    }

    /**
     * @notice Registers a forensic evidence hash permanently on-chain.
     * @param evidenceHash SHA-256 digest of original EML / MSG file payload.
     * @param caseId Unique forensic case identifier (e.g. CS-26106-XXXX).
     * @param originIp Resolved originating SMTP relay IP address.
     * @param threatScore Calculated heuristic risk score (0-100).
     */
    function notarizeEvidence(
        bytes32 evidenceHash,
        string calldata caseId,
        string calldata originIp,
        uint8 threatScore
    ) external returns (bool) {
        if (evidenceHash == bytes32(0)) revert InvalidEvidenceHash();
        if (records[evidenceHash].timestamp != 0) revert EvidenceAlreadyRegistered(evidenceHash);

        records[evidenceHash] = EvidenceRecord({
            evidenceHash: evidenceHash,
            caseId: caseId,
            originIp: originIp,
            threatScore: threatScore,
            timestamp: block.timestamp,
            notarizedBy: msg.sender
        });

        evidenceList.push(evidenceHash);

        emit EvidenceNotarized(
            evidenceHash,
            caseId,
            threatScore,
            block.timestamp,
            msg.sender
        );

        return true;
    }

    /**
     * @notice Verifies if a given evidence digest exists in the immutable ledger.
     */
    function verifyEvidence(bytes32 evidenceHash)
        external
        view
        returns (
            bool exists,
            string memory caseId,
            string memory originIp,
            uint8 threatScore,
            uint256 timestamp,
            address notarizedBy
        )
    {
        EvidenceRecord memory r = records[evidenceHash];
        if (r.timestamp == 0) {
            return (false, "", "", 0, 0, address(0));
        }
        return (true, r.caseId, r.originIp, r.threatScore, r.timestamp, r.notarizedBy);
    }

    /**
     * @notice Returns total notarized evidence records.
     */
    function getEvidenceCount() external view returns (uint256) {
        return evidenceList.length;
    }
}
