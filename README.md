# ReadyBlock: Glendale emergency preparedness app (Jewel City Hacks 5)

Enter your address → see the official hazards there → get a plan made for your household → prepare with your neighbors.

## Run it

0. One-time setup:
   ```
   python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
   .venv/bin/glendale-gis-mcp --fetch-snapshot
   (cd mobile && npm install)
   ```
1. Backend (laptop):
   ```
   .venv/bin/uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend
   ```
   Put your ElevenLabs key in `backend/.env` for "Listen to my plan".
2. App:
   ```
   cd mobile && npx expo start
   ```
   Scan the QR code with Expo Go (phone and laptop on the same WiFi, or laptop on the phone's hotspot).
   Browser preview: `npx expo start --web`.

## Structure
- `backend/app.py`: address → hazards (organizers' Glendale GIS data), neighbors (in-memory), ElevenLabs text-to-speech
- `backend/plan.py`: rule-based plan. Every step is a fixed string with an official source (Ready LA County, Red Cross, Cal OES, CAL FIRE, FEMA). Nothing is AI-generated, so there are no invented facts.
- `mobile/`: Expo (React Native) app: Risks · Plan · Neighbors · Info
