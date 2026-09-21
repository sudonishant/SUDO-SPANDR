# 🛡️ SUDO SPANDR — Demo Failure Runbook

| Scenario | Symptom | Immediate 5-Second Fix |
| :--- | :--- | :--- |
| **Internet Drops / Wi-Fi Outage** | Live API fails to reach serverless | **Zero Panic.** SUDO SPANDR automatically executes client-side fallback. Explain to judges: *"Our tool is built for air-gapped forensic military labs; watch it run 100% offline."* |
| **Browser Cache Stale** | UI shows older version | Press `Ctrl + Shift + R` (Hard Reload) or launch an Incognito window (`Ctrl + Shift + N`). |
| **Local Port 8000 Conflict** | Backend fails to start | Run `fuser -k 8000/tcp` and re-run `python3 -m uvicorn backend.app.main:app --port 8000`. |
| **Vercel API 404** | Old rewrite cached | Use direct route `/api/v1/analyze-eml` or run on local backend. |
| **Judge asks for custom EML** | Judge brings their own file | Use the **Quick Ingest** drag-and-drop zone. Our parser accepts `.eml`, `.msg`, or raw header paste. |
