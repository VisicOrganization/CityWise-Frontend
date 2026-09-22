#!/usr/bin/env python3
"""Build the committed 311 encampment-report GeoJSON for the Homeless Count map.

Run once by hand; nothing here runs at request time. The input is the MyLA311 "Homeless
Encampment" export for one council district (a JSON array, Socrata field names):

    python3 scripts/build_encampment_reports.py ~/Visic/cd2Demo/data/cd2_homeless_encampments_2026.json

Output (relative to CityWise-Frontend/):
    public/data/cd2-encampment-reports.geojson

Every field is normalized here, deterministically, so the popup only formats and never cleans:

- Addresses arrive ALL CAPS in several shapes: "12345 W VANOWEN ST, LOS ANGELES, CA, 91605",
  intersections joined by "and" or "&", "Park Name : 7000 N WHITSETT AVE, NORTH HOLLYWOOD 91605",
  and a few with a pole/unit segment ("P 35104", "#3-40"). The city/state/ZIP tail is dropped
  (ZIP comes from `zipcode__c` instead, which is present even on intersections).
- `closeddate` equals `createddate` to the second in ~99.8% of rows and every row's status is
  "Reported", so it is NOT a close date. It is kept only where it differs.
- `status` and `resolution_code__c` are constant across the export and dropped.
- Neighborhood council, department and LAPD area names go through explicit maps. An unknown
  value fails the build rather than slipping through un-normalized.

Every input row lands in exactly one feature; counts are asserted before anything is written.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "public/data/cd2-encampment-reports.geojson"

# Loose CD2 envelope (the district spans roughly -118.45..-118.34, 34.13..34.23). A point outside
# it means a bad coordinate or the wrong district's export, not a real report.
BBOX = (-118.50, 34.10, -118.30, 34.28)

# Explicit rather than title-cased: title-casing gives "Noho", and "NC VALLEY VILLAGE" needs
# reordering. Keyed by the export's own spelling.
NEIGHBORHOOD_COUNCILS = {
    "NOHO NC": "NoHo NC",
    "NOHO WEST NC": "NoHo West NC",
    "NORTH HOLLYWOOD NORTH EAST NC": "North Hollywood Northeast NC",
    "STUDIO CITY NC": "Studio City NC",
    "GREATER TOLUCA LAKE NC": "Greater Toluca Lake NC",
    "GREATER VALLEY GLEN": "Greater Valley Glen Council",
    "NC VALLEY VILLAGE": "Valley Village NC",
    "SUN VALLEY AREA NC": "Sun Valley Area NC",
    "VAN NUYS NC": "Van Nuys NC",
    "HOLLYWOOD HILLS WEST NC": "Hollywood Hills West NC",
    "SHERMAN OAKS NC": "Sherman Oaks NC",
}

# "LSD" is LA Sanitation & Environment's Livability Services Division (sanitation.lacity.gov/livability).
DEPARTMENTS = {
    "LSD": "LA Sanitation – Livability Services",
    "RAP - Homeless Related Services Team": "Recreation & Parks – Homeless Related Services",
}

# `locator_sr_community_police` is the LAPD geographic area number.
LAPD_AREAS = {"9": "Van Nuys", "15": "North Hollywood", "16": "Foothill", "19": "Mission"}

DIRECTIONALS = {"N", "S", "E", "W"}
# Tail segments of the address that carry no information beyond `zip` / the district itself.
# City, state, ZIP, or "CITY 91601". The two-letter minimum on the last form keeps pole-number
# segments like "P 35104" (one letter + five digits), which would otherwise read as a ZIP tail.
LOCALITY_SEGMENT = re.compile(r"^([A-Z ]+|\d{5}|[A-Z][A-Z ]+ \d{5})$")


def title_token(token: str) -> str:
    if token in DIRECTIONALS or token.startswith("#") or any(ch.isdigit() for ch in token):
        return token  # "W", "1/2", "CA-170", "#A-F" stay as written
    return token.capitalize()


def normalize_street(text: str) -> str:
    text = re.sub(r"\s+(?:and|AND|&)\s+", " & ", text.strip())
    return " ".join(title_token(t) if t != "&" else t for t in text.split())


def normalize_address(raw: str) -> tuple[str, str | None]:
    """Returns (address, place). `place` is the facility name some records prefix with " : "."""
    place = None
    if " : " in raw:
        place, raw = (part.strip() for part in raw.split(" : ", 1))
    segments = [s.strip() for s in raw.split(",")]
    kept = [segments[0]] + [s for s in segments[1:] if not LOCALITY_SEGMENT.match(s)]
    return ", ".join(normalize_street(s) for s in kept), place


def build_feature(row: dict) -> dict:
    address, place = normalize_address(row["locator_gis_returned_address"])

    nc_raw = row.get("locator_sr_neigborhood_council_1")
    if row["locator_sr_neigborhood_council"] == "0":
        assert nc_raw is None, row["casenumber"]
        nc = None  # outside any neighborhood council
    else:
        nc = NEIGHBORHOOD_COUNCILS[nc_raw]

    props = {
        "caseNumber": row["casenumber"],
        "address": address,
        "zip": row["zipcode__c"],
        "nc": nc,
        "created": row["createddate"],
        "origin": row.get("origin"),
        "department": DEPARTMENTS[row["department_name__c"]],
        "anonymous": bool(row["reported_anonymously__c"]),
        "apc": row["locator_sr_area_planning"],
        "lapdArea": LAPD_AREAS[row["locator_sr_community_police"]],
    }
    if place:
        props["place"] = place
    if row["closeddate"] and row["closeddate"] != row["createddate"]:
        props["closed"] = row["closeddate"]

    lng = round(row["geolocation__longitude__s"], 6)
    lat = round(row["geolocation__latitude__s"], 6)
    assert BBOX[0] <= lng <= BBOX[2] and BBOX[1] <= lat <= BBOX[3], (row["casenumber"], lng, lat)
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lng, lat]}, "properties": props}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("input", type=Path)
    args = parser.parse_args()

    rows = json.loads(args.input.read_text())
    # Newest first, case number as tiebreak, so re-runs are byte-identical.
    features = [build_feature(r) for r in sorted(rows, key=lambda r: (r["createddate"], r["casenumber"]), reverse=True)]

    case_numbers = [f["properties"]["caseNumber"] for f in features]
    assert len(features) == len(rows), (len(features), len(rows))
    assert len(set(case_numbers)) == len(case_numbers), "duplicate case numbers"

    OUTPUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":"))
        + "\n"
    )

    by_nc: dict[str, int] = {}
    for f in features:
        key = f["properties"]["nc"] or "(outside any NC)"
        by_nc[key] = by_nc.get(key, 0) + 1
    print(f"{len(rows)} rows in, {len(features)} features out -> {OUTPUT} ({OUTPUT.stat().st_size / 1e6:.2f} MB)")
    print(f"distinct closed date: {sum('closed' in f['properties'] for f in features)}")
    print(f"with facility name: {sum('place' in f['properties'] for f in features)}")
    for name, count in sorted(by_nc.items(), key=lambda kv: -kv[1]):
        print(f"  {count:5d}  {name}")


if __name__ == "__main__":
    main()
