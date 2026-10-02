# Bali AI Studio Browser Worker

This service is the network worker endpoint for Bali AI Studio.

Current stage:
- Worker API: available
- Health endpoint: available
- Job claim endpoint: available
- Heartbeat endpoint: available
- Browser runtime: intentionally not attached yet

The browser runtime must be added separately because a hosted Render web service is not automatically a persistent logged-in browser. Login, CAPTCHA, payment and final publishing remain human-controlled.

Endpoints:
- GET /health
- POST /worker/claim
- POST /worker/heartbeat

Optional environment variable:
- WORKER_TOKEN