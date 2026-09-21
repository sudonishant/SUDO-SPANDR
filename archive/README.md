# Archive Directory

This directory preserves historical development, patching, and operational tooling used during the rapid prototyping and security hardening of **SUDO SPANDR** (SIH 2026 Problem Statement #26106).

## Directory Structure
- `dev-scripts/`: Historical automation, UI patching, regex fixing, and local component test scripts.
- `ops/`: Legacy Docker sandbox startup scripts and isolated VNC desktop launcher scripts.

## Active Production Codebase
- `backend/`: Production FastAPI microservice, deterministic triage engines, cryptographic verifiers, and test suite.
- `api/`: Vercel Serverless Function endpoints for edge deployment (`/api/v1/analyze-eml`, `/api/v1/health`, `/api/v1/mitre/navigator-layer`, `/api/gateway-milter-check`, etc.).
- `contracts/`: Solidity smart contracts for immutable blockchain notarization (`EvidenceNotary.sol`).
- `demo/`: Judge presentation script, Q&A defense cheat sheet, failure runbooks, and 5 forensic EML fixtures.
- `index.html`: High-performance, offline-resilient single-page forensic console.
