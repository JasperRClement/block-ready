"""ReadyBlock backend: address -> hazards -> personal plan, plus neighbor features and voice.

Run from the repo root:
    GlendaleGisMcp/.venv/bin/uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import os
import time
import uuid
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from glendale_gis.core import hazards as hz
from glendale_gis.core import resources as rs
from glendale_gis.core.config import Settings
from glendale_gis.core.models import Location
from glendale_gis.core.snapshot import local_point
from glendale_gis.server import build_state

from backend.plan import Household, build_plan

load_dotenv(Path(__file__).parent / ".env")

app = FastAPI(title="ReadyBlock")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

STATE = build_state(Settings.from_env())
SNAP, GEO, _ = STATE.require_snapshot()

# --------------------------------------------------------------------------------------------
# Hazards
# --------------------------------------------------------------------------------------------

LEVELS = {0: "none", 1: "low", 2: "moderate", 3: "high"}


def _classes(result) -> list[str]:
    if not result.class_field:
        return []
    return [str(m.attributes.get(result.class_field)) for m in result.matches]


def _hazard(key, label, result, level, summary, source):
    return {
        "key": key,
        "label": label,
        "status": result.status,
        "level": level,
        "level_name": LEVELS[level],
        "summary": summary,
        "source": source,
        "disclaimer": result.disclaimer,
    }


def summarize_hazards(h) -> list[dict]:
    out = []

    fire = _classes(h.wildfire)
    fire_cls = next((c for c in ("Very High", "High", "Moderate") if c in fire), None)
    level = {"Very High": 3, "High": 2, "Moderate": 1}.get(fire_cls, 0)
    summary = (
        f"You are in a {fire_cls} Fire Hazard Severity Zone."
        if fire_cls
        else "You are not in a mapped fire hazard zone, but embers can still travel into "
        "neighborhoods during wildfires."
    )
    out.append(_hazard("wildfire", "Wildfire", h.wildfire, level, summary, "CAL FIRE, 2025 map"))

    zones = _classes(h.flood)
    subtypes = [str(m.attributes.get("ZONE_SUBTY") or "") for m in h.flood.matches]
    if any(z.startswith(("A", "V")) for z in zones):
        level, summary = 3, (
            f"You are in a FEMA high-risk flood zone ({', '.join(sorted(set(zones)))}). "
            "Standard home insurance does not cover floods."
        )
    elif any("0.2" in s for s in subtypes):
        level, summary = 1, "You are in a moderate (500-year) flood area."
    else:
        level, summary = 0, "You are in an area of minimal flood hazard."
    out.append(_hazard("flood", "Flood", h.flood, level, summary, "FEMA flood maps"))

    for key, label, result, yes, no in (
        ("fault", "Earthquake fault rupture", h.fault,
         "You are in an earthquake fault zone, where the ground can crack and shift.",
         "You are not in a fault rupture zone. All of Glendale can still shake hard in a quake."),
        ("liquefaction", "Liquefaction", h.liquefaction,
         "You are in a liquefaction zone: in a strong quake, wet soil here can act like liquid.",
         "You are not in a mapped liquefaction zone."),
        ("landslide", "Landslide", h.landslide,
         "You are in an earthquake-induced landslide zone.",
         "You are not in a mapped landslide zone."),
        ("dam", "Dam inundation", h.dam_inundation,
         "You are in an area that could flood if an upstream dam failed.",
         "You are not in a mapped dam inundation area."),
    ):
        inside = result.status == "in_zone"
        out.append(_hazard(key, label, result, 2 if inside else 0, yes if inside else no,
                           "California Geological Survey" if key != "dam" else "CA Dept. of Water Resources"))

    debris = _classes(h.debris_flow)
    level = {"High": 3, "Moderate": 2, "Low": 1}.get(
        next((c for c in ("High", "Moderate", "Low") if c in debris), ""), 0)
    out.append(_hazard(
        "debris_flow", "Post-fire debris flow", h.debris_flow, level,
        f"You are in a {LEVELS[level]} post-fire debris-flow basin." if level
        else "No current debris-flow assessment covers this spot.",
        "USGS",
    ))
    return out


def neighborhood_of(lat: float, lon: float) -> str | None:
    try:
        layer = SNAP.layer("neighborhood_zones")
    except Exception:
        return None
    for i in layer.containing(local_point(lat, lon)):
        name = layer.feature(i).attributes.get("NAME")
        if name:
            return str(name).title()
    return None


async def assess(address: str) -> dict:
    try:
        loc = await GEO.resolve(Location(address=address))
    except Exception as exc:  # geocoder raises actionable errors with a message
        raise HTTPException(400, str(exc)) from exc
    haz = summarize_hazards(hz.hazards_at_location(SNAP, loc))
    near = rs.nearest_resources(
        SNAP, loc, kinds=["fire_stations", "hospitals", "police_stations", "parks", "libraries"],
        limit=1)
    resources = [
        {"kind": g.kind, "title": g.title, "name": r.name, "address": r.address,
         "distance_m": r.distance_m}
        for g in near.groups for r in g.results
    ]
    overall = max(h["level"] for h in haz)
    return {
        "address": loc.matched_address or address,
        "lat": loc.lat,
        "lon": loc.lon,
        "in_city": loc.in_city,
        "neighborhood": neighborhood_of(loc.lat, loc.lon),
        "overall_level": overall,
        "overall_name": LEVELS[overall],
        "hazards": haz,
        "resources": resources,
    }


@app.get("/api/health")
def health():
    return {"ok": True, "snapshot": SNAP.built_at}


@app.get("/api/assess")
async def api_assess(address: str):
    return await assess(address)


class PlanRequest(BaseModel):
    address: str
    household: Household = Household()


@app.post("/api/plan")
async def api_plan(req: PlanRequest):
    a = await assess(req.address)
    return {"assessment": a, **build_plan(a, req.household)}


# --------------------------------------------------------------------------------------------
# Neighbors (in-memory for the demo). No incident/alert posts: official alerts only.
# --------------------------------------------------------------------------------------------

class Neighbor(BaseModel):
    id: str = ""
    name: str
    neighborhood: str
    role: Literal["can_help", "needs_help", "both"] = "can_help"
    skills: list[str] = []
    note: str = ""
    has_plan: bool = False
    has_go_bag: bool = False


class Post(BaseModel):
    id: str = ""
    neighborhood: str
    author: str
    kind: Literal["offer", "request", "checkin", "tip"]
    text: str
    ts: float = 0


NEIGHBORS: dict[str, Neighbor] = {}
POSTS: list[Post] = []


def _seed():
    for n in [
        Neighbor(name="Anahit K.", neighborhood="*", role="needs_help",
                 note="Uses a walker, lives alone. Speaks Armenian and some English.",
                 has_plan=True),
        Neighbor(name="Marco R.", neighborhood="*", role="can_help",
                 skills=["Has a truck", "CPR certified", "Speaks Spanish"],
                 has_plan=True, has_go_bag=True),
        Neighbor(name="Grace L.", neighborhood="*", role="can_help",
                 skills=["Nurse", "Speaks Korean"], has_plan=True, has_go_bag=True),
        Neighbor(name="Tom & Rita B.", neighborhood="*", role="both",
                 skills=["Generator"], note="Two dogs, one cat.", has_go_bag=True),
    ]:
        n.id = uuid.uuid4().hex[:8]
        NEIGHBORS[n.id] = n
    now = time.time()
    for i, (author, kind, text) in enumerate([
        ("Marco R.", "offer", "I have room in my truck for 2 people + pets if we ever need to evacuate. Message me."),
        ("Grace L.", "tip", "Reminder: sign up for Alert LA County so you get evacuation orders on your phone."),
        ("Tom & Rita B.", "request", "Anyone have a spare pet carrier? Ours broke."),
        ("Anahit K.", "checkin", "Finished my go-bag today with my grandson's help!"),
    ]):
        POSTS.append(Post(id=uuid.uuid4().hex[:8], neighborhood="*", author=author, kind=kind,
                          text=text, ts=now - (i + 1) * 3600))


_seed()


def _in(hood: str, item_hood: str) -> bool:
    return item_hood in ("*", hood)


@app.get("/api/community")
def community(neighborhood: str):
    ns = [n for n in NEIGHBORS.values() if _in(neighborhood, n.neighborhood)]
    ps = sorted((p for p in POSTS if _in(neighborhood, p.neighborhood)), key=lambda p: -p.ts)
    total = len(ns) or 1
    return {
        "neighborhood": neighborhood,
        "neighbors": ns,
        "posts": ps,
        "readiness": {
            "households": len(ns),
            "with_plan": sum(n.has_plan for n in ns),
            "with_go_bag": sum(n.has_go_bag for n in ns),
            "score": round(100 * sum(n.has_plan + n.has_go_bag for n in ns) / (2 * total)),
        },
    }


@app.post("/api/community/join")
def join(n: Neighbor):
    n.id = n.id or uuid.uuid4().hex[:8]
    NEIGHBORS[n.id] = n
    return n


@app.post("/api/community/post")
def post(p: Post):
    p.id, p.ts = uuid.uuid4().hex[:8], time.time()
    POSTS.append(p)
    return p


# --------------------------------------------------------------------------------------------
# Voice (ElevenLabs text-to-speech). The key stays on the server, never in the app.
# --------------------------------------------------------------------------------------------

class SpeakRequest(BaseModel):
    text: str
    voice_id: str | None = None


@app.post("/api/speak")
async def speak(req: SpeakRequest):
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        raise HTTPException(503, "ELEVENLABS_API_KEY is not set on the server")
    voice = req.voice_id or os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
            params={"output_format": "mp3_44100_128"},
            headers={"xi-api-key": key},
            json={"text": req.text[:4000], "model_id": "eleven_multilingual_v2"},
        )
    if r.status_code != 200:
        raise HTTPException(502, f"ElevenLabs error {r.status_code}: {r.text[:300]}")
    audio_id = uuid.uuid4().hex
    AUDIO[audio_id] = r.content
    return {"audio_url": f"/api/audio/{audio_id}.mp3"}


AUDIO: dict[str, bytes] = {}


@app.get("/api/audio/{audio_id}.mp3")
def audio(audio_id: str):
    if audio_id not in AUDIO:
        raise HTTPException(404, "Audio not found")
    return Response(AUDIO[audio_id], media_type="audio/mpeg")
