"""Rule-based preparedness plan. Every step is a fixed, reviewed string with its source, so the
app never invents official guidance. Steps are chosen and ordered by the address's hazards and
the household's needs.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

READY_LA = {"name": "Ready LA County", "url": "https://ready.lacounty.gov"}
ALERT_LA = {"name": "Alert LA County", "url": "https://ready.lacounty.gov/alert-la-county/"}
RED_CROSS = {"name": "American Red Cross", "url": "https://www.redcross.org/get-help/how-to-prepare-for-emergencies.html"}
CAL_OES = {"name": "Cal OES", "url": "https://www.caloes.ca.gov"}
MYSHAKE = {"name": "Cal OES MyShake", "url": "https://myshake.berkeley.edu"}
READY_FIRE = {"name": "CAL FIRE Ready for Wildfire", "url": "https://www.readyforwildfire.org"}
EQ_COUNTRY = {"name": "Earthquake Country Alliance", "url": "https://www.earthquakecountry.org/sevensteps/"}
FLOODSMART = {"name": "FEMA FloodSmart", "url": "https://www.floodsmart.gov"}
READY_GOV_DISAB = {"name": "Ready.gov: People with Disabilities", "url": "https://www.ready.gov/disability"}
READY_GOV_PETS = {"name": "Ready.gov: Pets", "url": "https://www.ready.gov/pets"}
READY_GOV_SENIORS = {"name": "Ready.gov: Older Adults", "url": "https://www.ready.gov/older-adults"}


class Household(BaseModel):
    housing: Literal["house", "apartment", "mobile_home", "other"] = "house"
    floor: int = 1
    renter: bool = False
    adults: int = 1
    kids: int = 0
    seniors: int = 0
    mobility_needs: bool = False
    power_dependent_medical: bool = False  # oxygen, CPAP, powered wheelchair, dialysis
    daily_medications: bool = False
    hearing_or_vision_needs: bool = False
    dogs: int = 0
    cats: int = 0
    other_pets: bool = False
    has_car: bool = True
    language: str = "English"
    has_smartphone: bool = True


def _step(id, title, detail, why, priority, category, source):
    return {"id": id, "title": title, "detail": detail, "why": why,
            "priority": priority, "category": category, "source": source}


def build_plan(a: dict, h: Household) -> dict:
    lv = {x["key"]: x["level"] for x in a["hazards"]}
    steps: list[dict] = []
    add = steps.append

    # --- Everyone ------------------------------------------------------------------------
    add(_step("alerts", "Sign up for Alert LA County",
              "Register your phone and address so you get evacuation orders and warnings."
              + ("" if h.has_smartphone else " You can register a landline too."),
              "Evacuation orders come from officials. This is the fastest way to get them.",
              "now", "alerts", ALERT_LA))
    add(_step("myshake", "Install MyShake for earthquake early warning",
              "Gives you seconds of warning before shaking starts. Drop, Cover, Hold On.",
              "All of Glendale is near active faults.", "now", "earthquake", MYSHAKE))
    add(_step("gobag", "Pack a go-bag for each person",
              "Water, food, flashlight, radio, phone charger, copies of IDs, cash, masks, "
              "first aid kit, and a change of clothes.",
              "You may have minutes to leave.", "week", "supplies", RED_CROSS))
    add(_step("water", "Store 2 weeks of water and food at home",
              "About 1 gallon of water per person per day.",
              "After a big earthquake, water and stores may be out for days.",
              "month", "supplies", READY_LA))
    add(_step("meet", "Pick two meeting places and an out-of-area contact",
              "One spot near home, one outside your neighborhood. Write numbers on paper.",
              "Phones may not work and family may be apart.", "week", "plan", RED_CROSS))
    add(_step("secure", "Secure heavy furniture and water heater",
              "Strap bookcases, TVs and the water heater to wall studs.",
              "Falling objects cause many earthquake injuries.",
              "month", "earthquake", EQ_COUNTRY))

    # --- Hazard-specific -----------------------------------------------------------------
    if lv.get("wildfire", 0) >= 1:
        high = lv["wildfire"] >= 2
        add(_step("defensible", "Create defensible space around your home",
                  "Clear dead plants, leaves and anything burnable within 5 feet of the house; "
                  "clean gutters and roof.",
                  "Your address is in a mapped fire hazard zone. Embers ignite most homes.",
                  "now" if high else "week", "wildfire", READY_FIRE))
        add(_step("evac_routes", "Know two ways out of your neighborhood",
                  "Drive both routes once. Fires can block one road.",
                  "Hillside streets can jam during evacuations.",
                  "now" if high else "week", "wildfire", READY_FIRE))
        if high:
            add(_step("leave_early", "Plan to leave early. Don't wait for an order",
                      "If you feel unsafe, go. Keep your car fueled and facing out.",
                      "Very high fire zones can have little warning.",
                      "now", "wildfire", READY_FIRE))
    if lv.get("flood", 0) >= 1 or lv.get("dam", 0) >= 1 or lv.get("debris_flow", 0) >= 1:
        add(_step("flood_ins", "Check flood insurance" + (" (renters too)" if h.renter else ""),
                  "Regular home and renters insurance does not cover floods. Policies take "
                  "30 days to start.",
                  "Your address is in a mapped flood, dam or debris-flow area.",
                  "week", "flood", FLOODSMART))
        add(_step("high_ground", "Know your route to higher ground",
                  "Never walk or drive through moving water.",
                  "Flood water can rise fast.", "week", "flood", READY_LA))
    if lv.get("liquefaction", 0) or lv.get("fault", 0) or lv.get("landslide", 0):
        add(_step("retrofit", "Ask about a seismic inspection or retrofit",
                  "Especially for older houses, raised foundations and soft-story apartments.",
                  "Your address is in a mapped earthquake hazard zone.",
                  "month", "earthquake", EQ_COUNTRY))

    # --- Housing -------------------------------------------------------------------------
    if h.housing == "apartment":
        add(_step("stairs", "Learn your building's exits and stairwells",
                  "Elevators stop in emergencies." + (
                      f" You're on floor {h.floor}; practice the stairs." if h.floor > 2 else ""),
                  "Apartment residents usually evacuate by stairs.", "week", "plan", RED_CROSS))
    if h.housing == "mobile_home":
        add(_step("mobile", "Check your mobile home's tie-downs and bracing",
                  "Mobile homes can shift off their supports in earthquakes.",
                  "Mobile homes are more vulnerable to shaking and wind.",
                  "month", "earthquake", EQ_COUNTRY))
    if h.renter:
        add(_step("renters", "Get renters insurance and photograph your belongings",
                  "Your landlord's insurance doesn't cover your things.",
                  "Makes recovery much faster.", "month", "plan", READY_LA))

    # --- People --------------------------------------------------------------------------
    if h.mobility_needs or h.seniors:
        add(_step("buddy", "Set up a neighbor buddy",
                  "Ask 2–3 neighbors to check on you and help you evacuate. Use the Neighbors tab.",
                  "Red Cross advises building a personal support network.",
                  "now", "people", READY_GOV_SENIORS if h.seniors else READY_GOV_DISAB))
    if h.mobility_needs:
        add(_step("mobility", "Plan evacuation transport for mobility needs",
                  "Arrange who will drive you, and keep a spare cane, walker or wheelchair "
                  "battery ready." + ("" if h.has_car else " Ask about paratransit and "
                                      "evacuation help when you register for alerts."),
                  "You may need extra time and help to leave.", "now", "people", READY_GOV_DISAB))
    if h.power_dependent_medical:
        add(_step("power", "Plan for power outages for medical devices",
                  "Get backup batteries, tell your utility you use life-support equipment, "
                  "and know where you can charge.",
                  "Outages can happen during fires and heat, including planned shutoffs.",
                  "now", "people", READY_GOV_DISAB))
    if h.daily_medications:
        add(_step("meds", "Keep a 7-day supply of medicines and a list",
                  "Include doses, doctors and pharmacy. Keep a copy in your go-bag.",
                  "Pharmacies may be closed after a disaster.", "week", "people", RED_CROSS))
    if h.hearing_or_vision_needs:
        add(_step("sensory", "Set up alerts you can see or feel",
                  "Use vibration and flashing alerts; keep extra hearing aid batteries or "
                  "glasses in your go-bag.",
                  "You need to get warnings in a way that works for you.",
                  "week", "people", READY_GOV_DISAB))
    if h.kids:
        add(_step("kids", "Know your kids' school emergency plan",
                  "Find out where they'll go and who is allowed to pick them up.",
                  "Disasters can happen during the school day.", "week", "people", RED_CROSS))

    # --- Pets ----------------------------------------------------------------------------
    if h.dogs or h.cats or h.other_pets:
        add(_step("pets", "Pack a pet go-kit",
                  "Carrier or leash, 3 days of food and water, meds, vet records and a photo. "
                  "Microchip and ID tags.",
                  "Many shelters need proof of vaccinations. Never leave pets behind.",
                  "week", "pets", READY_GOV_PETS))

    if not h.has_car:
        add(_step("nocar", "Plan a ride out ahead of time",
                  "Ask a neighbor with a car (see Neighbors) or learn where evacuation buses pick up.",
                  "Evacuations assume you can drive.", "now", "plan", READY_LA))

    order = {"now": 0, "week": 1, "month": 2}
    steps.sort(key=lambda s: order[s["priority"]])
    return {"steps": steps, "speech": _speech(a, steps)}


def _speech(a: dict, steps: list[dict]) -> str:
    risky = [x for x in a["hazards"] if x["level"] >= 1]
    lines = [f"Here is your emergency plan for {a['address'].split(',')[0].title()}."]
    if risky:
        lines.append(" ".join(x["summary"] for x in risky))
    else:
        lines.append("Your address is not in any mapped hazard zone, but earthquakes can affect "
                     "everyone in Glendale.")
    now = [s for s in steps if s["priority"] == "now"]
    lines.append(f"You have {len(now)} things to do first.")
    for i, s in enumerate(now, 1):
        lines.append(f"{i}. {s['title']}. {s['detail']}")
    lines.append("Open the app to see the rest of your checklist.")
    return " ".join(lines)
