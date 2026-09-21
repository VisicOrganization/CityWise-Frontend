#!/usr/bin/env python3
"""Build the committed CD2 Neighborhood Map data files from the CD2 asset spreadsheet.

Run once by hand before the demo; nothing here runs at request time. There is no local
Nominatim in dev (`CityWise-Backend/.env.example` ships `GEOCODER_PROVIDER=` empty), so a
runtime geocode would be a live dependency on a service that is not there. The outputs are
committed instead.

    python3 scripts/build_cd2_assets.py

Outputs, all relative to CityWise-Frontend/:
    public/data/cd2-civic-assets.geojson   validated pins only
    public/data/cd2-neighborhoods.geojson  the 7 CD2 CSA polygons, properties stripped
    scripts/cd2-geocode-report.md          every dropped row and why  <- the hand-fix worklist

Geocode results are cached in `scripts/.cd2-geocode-cache.json` keyed by query, so re-runs
are free, offline and byte-identical. Delete the cache to force a fresh geocode.

On why District 2 is not a filter:

28 of the 81 rows geocode outside CD2 -- 13 in CD4, 12 in CD6, 2 in CD7, 1 in CD5 -- and none
of them are mistakes. The CD2 website lists the facilities that SERVE each neighbourhood, not
the ones contained in the district: a Valley Glen resident's police station is the Van Nuys
one, which sits in CD6. Filtering on containment emptied Van Nuys entirely (0 of 6) and cut
Public Safety to 3 of 13, so containment is recorded per pin and used as a tiebreaker between
geocoder candidates, never as a reason to drop a row.

`find_district_id_for_point` is imported from CityWise-Backend rather than reimplemented --
the ray-casting already exists twice (api/boundaries.py and shared/map/districtBoundaries.ts)
and CITYWISE_ARCHITECTURE.md flags that nothing keeps the two in sync. A third copy is worse.

Every input row lands in exactly one output: a feature or a report entry. The counts are
asserted before anything is written, so no row can go missing quietly.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

FRONTEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = FRONTEND_ROOT.parent
BACKEND_ROOT = REPO_ROOT / "CityWise-Backend"

sys.path.insert(0, str(BACKEND_ROOT))
from api.boundaries import find_district_id_for_point  # noqa: E402
from ingestion.address_resolution import street_names_match  # noqa: E402

DEFAULT_XLSX = Path("/Users/rehaananjaria/Visic/cd2Demo/lacity_cd2_map_labels_addresses.xlsx")
CSA_GEOJSON = FRONTEND_ROOT / "public" / "data" / "lahsa-2020-csa.geojson"
OUT_ASSETS = FRONTEND_ROOT / "public" / "data" / "cd2-civic-assets.geojson"
OUT_NEIGHBORHOODS = FRONTEND_ROOT / "public" / "data" / "cd2-neighborhoods.geojson"
OUT_REPORT = Path(__file__).resolve().parent / "cd2-geocode-report.md"
CACHE_PATH = Path(__file__).resolve().parent / ".cd2-geocode-cache.json"

DISTRICT_ID = 2

# Mirrors ingestion/jurisdictions.py LOS_ANGELES: lon_min, lat_max, lon_max, lat_min.
# Deliberately the whole-city box, not CD2's: bounding to CD2 would make the geocoder reject
# out-of-district rows for us, and the report needs to tell "did not geocode" apart from
# "geocoded, but outside CD2" -- those need different fixes from whoever edits the sheet.
VIEWBOX = (-118.6682, 34.3373, -118.1553, 33.7037)
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "CityWise-CD2-demo-build/1.0 (anjaria@usc.edu)"
THROTTLE_SECONDS = 1.1  # nominatim.openstreetmap.org usage policy: max 1 req/s

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# The sheet spells the same category two ways; collapse to one key per colour.
CATEGORY_ALIASES = {
    "RECREATION AND PARKS": "RECREATION & PARKS",
    "NEIGHBORHOOD ORGANIZATIONS": "NEIGHBORHOOD ORGANIZATIONS AND RESOURCES",
}
# The 18 district-level rows carry no category of their own.
DISTRICT_CATEGORY = "DISTRICT PROJECTS & OFFICE"
CATEGORY_KEYS = (
    "NEIGHBORHOOD ORGANIZATIONS AND RESOURCES",
    "RECREATION & PARKS",
    "PUBLIC SAFETY",
    DISTRICT_CATEGORY,
)

# Cross-street locations with no house number: three query tiers all failed, so these come
# from the OSM node where the two named ways actually meet, found via Overpass. Node ids are
# recorded so any one of them can be re-checked. A sheet row that later gains a real street
# address takes precedence -- see resolve_row().
MANUAL_COORDINATES = {
    # San Fernando Rd x Arvilla Ave. Three ways cross here, which is what "grade crossing"
    # describes; this is the northernmost of the three nodes.
    "Improved Intersection & Grade Crossing": (-118.356492, 34.2111121),  # node/122848444
    "Keswick Pocket Park": (-118.3965139, 34.2102809),  # node/123370742
    "Tujunga/Kittridge": (-118.3790592, 34.1903207),  # node/123180234
    "Jamie Beth Slaven Park": (-118.4052731, 34.2157403),  # node/122628464
}

DISTRICTWIDE = "Districtwide"
MULTIPLE = "Multiple neighborhoods"

DISTRICT_LEVEL = "District"
LEVEL_ALIASES = {"NorthHollywood": "North Hollywood"}

FIELDS = ("label", "address", "phone", "email", "meeting_information", "website", "category")

# Row data source: currently reads from an xlsx file. A future read_rows_from_cd2_pages()
# function will be swapped in here to regenerate the dataset from cd2.lacity.gov instead.
ROW_SOURCE = read_rows_from_xlsx

STREET_SUFFIX_EXPANSIONS = {
    "st": "street", "ave": "avenue", "av": "avenue", "blvd": "boulevard",
    "dr": "drive", "rd": "road", "pl": "place", "ln": "lane", "ct": "court",
    "hwy": "highway", "pkwy": "parkway", "ter": "terrace", "cyn": "canyon",
    "cir": "circle", "sq": "square", "plz": "plaza", "trl": "trail",
}


def expand_suffixes(value: str) -> str:
    """"Burbank Blvd." -> "burbank boulevard", so abbreviated and spelled-out forms compare."""
    words = re.sub(r"[^a-z0-9 ]", " ", value.casefold()).split()
    return " ".join(STREET_SUFFIX_EXPANSIONS.get(word, word) for word in words)


# --------------------------------------------------------------------------- xlsx


def read_rows_from_xlsx(path: Path) -> list[dict[str, str]]:
    """Parse a single flat sheet with the stdlib. openpyxl would be a dependency for nothing."""
    with zipfile.ZipFile(path) as archive:
        shared = [
            "".join(node.text or "" for node in si.iter(NS + "t"))
            for si in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall(NS + "si")
        ]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))

    raw_rows: list[dict[str, str]] = []
    for row in sheet.iter(NS + "row"):
        cells: dict[str, str] = {}
        for cell in row.findall(NS + "c"):
            column = re.match(r"[A-Z]+", cell.get("r") or "")
            if column is None:
                continue
            value_node = cell.find(NS + "v")
            if cell.get("t") == "inlineStr":
                value = "".join(node.text or "" for node in cell.iter(NS + "t"))
            elif value_node is None or value_node.text is None:
                value = ""
            elif cell.get("t") == "s":
                value = shared[int(value_node.text)]
            else:
                value = value_node.text
            cells[column.group()] = value
        raw_rows.append(cells)

    if not raw_rows:
        raise SystemExit(f"{path} has no rows")

    header = raw_rows[0]
    return [
        {header[key]: row.get(key, "").strip() for key in header if header.get(key)}
        for row in raw_rows[1:]
    ]


def normalize(row: dict[str, str]) -> dict[str, str]:
    level = LEVEL_ALIASES.get(row.get("Level", ""), row.get("Level", "")).strip()
    category = row.get("category", "").strip().upper()
    if not category:
        category = DISTRICT_CATEGORY
    category = CATEGORY_ALIASES.get(category, category)

    website = row.get("website", "").strip()
    if "|" in website:  # one cell holds two URLs for the same park
        website = website.split("|")[0].strip()

    record = {
        "label": row.get("label", "").strip(),
        "address": row.get("address", "").strip(),
        "phone": row.get("phone", "").strip(),
        "email": row.get("email", "").strip(),
        "meeting_information": row.get("meeting_information", "").strip(),
        "website": website,
        "category": category,
        "neighborhood": DISTRICTWIDE if level == DISTRICT_LEVEL else level,
        "level": level,
        # The CD2 page each block of rows was transcribed from. Per Level, not per row: all 8
        # rows of Sun Valley carry the same URL. It is emitted onto the CSA polygon rather than
        # onto every pin, since that is the grain it actually has.
        "source_url": row.get("source_url", "").strip(),
    }
    return record


# ----------------------------------------------------------------- address triage

PO_BOX_RE = re.compile(r"\bP\.?\s?O\.?\s?BOX\b", re.I)
HOUSE_NUMBER_RE = re.compile(r"^\d+")
INTERSECTION_RE = re.compile(r"\s(?:&|and|/)\s|^[A-Za-z ]+/[A-Za-z ]+$", re.I)
STATE_RE = re.compile(r"\bCA\b")


def classify(address: str) -> str:
    """One of: 'po_box', 'too_coarse', 'intersection', 'street'."""
    if not address:
        return "too_coarse"
    if PO_BOX_RE.search(address):
        return "po_box"
    if HOUSE_NUMBER_RE.match(address):
        return "street"
    if INTERSECTION_RE.search(address):
        return "intersection"
    return "too_coarse"


UNIT_RE = re.compile(
    r"\s*(?:#\s*\w+|\b(?:suite|ste|unit|apt|apartment|room|rm|bldg|ed)\.?\s*[\w.]+)\s*$",
    re.I,
)


def strip_unit(street: str) -> str:
    """"3330 Cahuenga Blvd W #505" -> "3330 Cahuenga Blvd W". Nominatim has no unit field."""
    previous = None
    while previous != street:
        previous = street
        street = UNIT_RE.sub("", street).strip(" ,")
    return street


PLACE_HINTS = (
    "park", "plaza", "library", "station", "center", "centre", "complex", "path",
    "trail", "greenbelt", "green belt", "gallery", "mural", "site", "field", "pool",
)


def looks_like_place(label: str) -> bool:
    """Only try a POI lookup for labels that name a place, not an association or a council."""
    lowered = label.casefold()
    return any(hint in lowered for hint in PLACE_HINTS)


def full_address(address: str) -> str:
    if not STATE_RE.search(address):
        return f"{address}, Los Angeles, CA"
    return address


def build_query(address: str, kind: str) -> dict[str, str]:
    """Structured params for a street address, free-form for an intersection.

    Structured (street/city/state) rather than `q` for street addresses, the same choice
    ingestion/geocoding.py makes. Intersections have no house number to key on, so they go
    free-form and are accepted only at street precision.
    """
    # The 8 rows that carry a street but no state token are clearly City of LA; adding the
    # city is the only address rewrite this script performs.
    if not STATE_RE.search(address):
        address = f"{address}, Los Angeles, CA"

    if kind == "intersection":
        return {"q": address}

    parts = [part.strip() for part in address.split(",") if part.strip()]
    street = strip_unit(parts[0])
    # Anchor the city on the "CA <zip>" segment rather than on position: unit and suite
    # segments ("Ed.2", "Suite F") sit between the street and the city in this sheet.
    city = "Los Angeles"
    for index, part in enumerate(parts):
        if STATE_RE.search(part) and index > 0:
            city = parts[index - 1]
            break
    # No postalcode on purpose: the sheet's ZIPs are unreliable (Atoll Ave carries 91436,
    # Westpark Dr carries 91601) and a wrong one turns a good query into zero results.
    return {"street": street, "city": city, "state": "CA"}


# --------------------------------------------------------------------- geocoding


def load_cache() -> dict[str, object]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def geocode(params: dict[str, str], cache: dict[str, object], *, offline: bool) -> list[dict]:
    query = {
        **params,
        "format": "jsonv2",
        "addressdetails": "1",
        "limit": "5",
        "countrycodes": "us",
        "viewbox": ",".join(str(value) for value in VIEWBOX),
        "bounded": "1",
    }
    key = urllib.parse.urlencode(sorted(query.items()))
    if key in cache:
        return cache[key]  # type: ignore[return-value]
    if offline:
        return []

    url = f"{NOMINATIM_URL}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:  # noqa: BLE001 - a geocode outage must not abort the build
        print(f"  ! geocode failed: {error}", file=sys.stderr)
        payload = []

    if not isinstance(payload, list):
        payload = []
    cache[key] = payload
    CACHE_PATH.write_text(json.dumps(cache, indent=0, sort_keys=True), encoding="utf-8")
    time.sleep(THROTTLE_SECONDS)
    return payload


def pick_candidate(
    candidates: list[dict], street: str, kind: str
) -> tuple[dict | None, str, int | None]:
    """Return (candidate, precision, council_district).

    Two passes. The first keeps only candidates inside District 2, the second accepts any.
    That makes containment a tiebreaker rather than a filter: "Whitsett Ave" exists in both
    North Hollywood (CD2) and Studio City (CD4), so when the geocoder offers several the CD2
    one wins -- but a facility that genuinely sits in CD6 still gets a pin.

    For a street address the returned road must match the requested street, because the
    boundary test alone lets a dropped house number resolve to a different street nearby.
    """
    wanted_street = strip_house_number(street)

    for cd2_only in (True, False):
        for candidate in candidates:
            try:
                longitude = float(candidate["lon"])
                latitude = float(candidate["lat"])
            except (KeyError, TypeError, ValueError):
                continue

            details = candidate.get("address") or {}
            road = str(details.get("road") or "")
            if kind == "street" and wanted_street and road:
                if not street_names_match(expand_suffixes(wanted_street), expand_suffixes(road)):
                    continue

            district = find_district_id_for_point(longitude, latitude)
            if cd2_only and district != DISTRICT_ID:
                continue

            house = str(details.get("house_number") or "").strip()
            wanted_house = HOUSE_NUMBER_RE.match(street)
            precision = (
                "rooftop"
                if kind == "street" and wanted_house and house == wanted_house.group()
                else "street"
            )
            return candidate, precision, district

    return None, "", None


def strip_house_number(street: str) -> str:
    """"11640 Burbank Blvd." -> "Burbank Blvd." Nominatim returns the road without it."""
    return HOUSE_NUMBER_RE.sub("", street).strip(" ,")


# ------------------------------------------------------------------------ dedupe

MERGE_FIELDS = ("address", "phone", "email", "meeting_information", "website")


def dedupe(kept: list[dict]) -> tuple[list[dict], list[dict]]:
    """Collapse rows that geocoded to the same point; return (features, conflicts).

    The sheet lists a facility once per neighbourhood it serves, so North Hollywood Police
    Station appears three times and would stack three pins on one coordinate with only the
    top one clickable. Grouping on the resolved point rather than on the address string also
    merges "5211 Tujunga Ave." with "5211 Tujunga Avenue" for free.

    Grouping on the point is what makes the third case work: two rows sharing a label but
    landing far apart are a contradiction in the sheet, not a duplicate, so they stay as two
    pins and get reported.
    """
    groups: dict[tuple[float, float], list[dict]] = {}
    for record in kept:
        key = (round(record["longitude"], 5), round(record["latitude"], 5))
        groups.setdefault(key, []).append(record)

    merged: list[dict] = []
    for group in groups.values():
        primary = next(
            (row for row in group if row["precision"] == "rooftop"), group[0]
        )
        combined = dict(primary)
        for field in MERGE_FIELDS:
            if not combined.get(field):
                combined[field] = next((row[field] for row in group if row.get(field)), "")
        neighborhoods = sorted({row["neighborhood"] for row in group if row["neighborhood"]})
        # Colour axis is the neighbourhood, so a facility serving three of them cannot take
        # one of their colours without lying about the other two. It gets its own.
        combined["neighborhood"] = neighborhoods[0] if len(neighborhoods) == 1 else MULTIPLE
        combined["neighborhoods"] = neighborhoods
        combined["merged_from"] = len(group)
        merged.append(combined)

    by_label: dict[str, list[dict]] = {}
    for record in merged:
        by_label.setdefault(record["label"], []).append(record)
    conflicts = [
        record for group in by_label.values() if len(group) > 1 for record in group
    ]
    return merged, conflicts


# ----------------------------------------------------------------------- outputs

REASON_HEADINGS = {
    "po_box": "NOT A LOCATION - PO box",
    "too_coarse": "TOO COARSE - no street address",
    "no_match": "NO GEOCODE - Nominatim returned nothing usable",
}
REASON_NOTES = {
    "po_box": "A PO box has no location to pin. Needs the real street address, or drop the row.",
    "too_coarse": "Needs a house number, or a cross street, or hand-supplied coordinates.",
    "no_match": "Try a cross-street format (`Foo Ave and Bar St, Los Angeles, CA`), or supply coordinates.",
}


def write_report(
    dropped: list[dict], kept: list[dict], total: int, features: list[dict], conflicts: list[dict]
) -> None:
    lines = [
        "# CD2 geocode report",
        "",
        f"Generated by `scripts/build_cd2_assets.py` from `{DEFAULT_XLSX.name}`.",
        "",
        f"- **{total}** rows in the sheet",
        f"- **{len(kept)}** located",
        f"- **{len(features)}** pins on the map "
        f"({len(kept) - len(features)} rows merged as the same location)",
        f"- **{len(dropped)}** dropped, listed below",
        "",
        "Fix these in the spreadsheet, save it, then re-run the script.",
        "",
    ]

    by_reason: dict[str, list[dict]] = {}
    for record in dropped:
        by_reason.setdefault(record["reason"], []).append(record)

    for reason in ("no_match", "too_coarse", "po_box"):
        group = by_reason.get(reason)
        if not group:
            continue
        lines += [f"## {REASON_HEADINGS[reason]} ({len(group)})", "", REASON_NOTES[reason], ""]
        lines.append("| Level | Label | Address in sheet |")
        lines.append("| --- | --- | --- |")
        for record in sorted(group, key=lambda item: (item["level"], item["label"])):
            address = record["address"] or "_(blank)_"
            lines.append(f"| {record['level']} | {record['label']} | {address} |")
        lines.append("")

    outside = [record for record in features if record.get("council_district") != DISTRICT_ID]
    if outside:
        lines += [
            f"## On the map, but not inside District 2 ({len(outside)})",
            "",
            "Not errors, and not dropped. The CD2 site lists the facilities that SERVE each",
            "neighbourhood; some of them sit in a neighbouring district. Recorded per pin as",
            "`council_district` so the popup can say so.",
            "",
            "| Neighborhood | Label | Actually in |",
            "| --- | --- | --- |",
        ]
        for record in sorted(outside, key=lambda item: (item["neighborhood"], item["label"])):
            district = record.get("council_district")
            where = f"CD{district}" if district else "outside the City of LA"
            lines.append(f"| {record['neighborhood']} | {record['label']} | {where} |")
        lines.append("")

    if conflicts:
        lines += [
            f"## Same name, different place ({len(conflicts)} rows)",
            "",
            "These share a label but geocoded to different points, so the sheet disagrees with",
            "itself about where they are. They are both on the map right now. Pick one address.",
            "",
            "| Label | Address in sheet | Lon, Lat |",
            "| --- | --- | --- |",
        ]
        for record in sorted(conflicts, key=lambda item: (item["label"], item["address"])):
            point = f"{record['longitude']:.5f}, {record['latitude']:.5f}"
            lines.append(f"| {record['label']} | {record['address']} | {point} |")
        lines.append("")

    street_level = [record for record in features if record["precision"] != "rooftop"]
    if street_level:
        lines += [
            f"## Kept, but street-level not rooftop ({len(street_level)})",
            "",
            "These are on the map. The pin sits on the street or on the named feature, not a",
            "verified rooftop - fine for a park or an intersection, worth a look for an office.",
            "",
            "| Level | Label | Address in sheet |",
            "| --- | --- | --- |",
        ]
        for record in sorted(street_level, key=lambda item: (item["level"], item["label"])):
            lines.append(f"| {record['level']} | {record['label']} | {record['address']} |")
        lines.append("")

    OUT_REPORT.write_text("\n".join(lines), encoding="utf-8")


def write_assets(kept: list[dict]) -> None:
    features = []
    for record in sorted(kept, key=lambda item: (item["neighborhood"], item["label"])):
        properties = {
            "label": record["label"],
            "category": record["category"],
            "neighborhood": record["neighborhood"],
        }
        if record.get("council_district"):
            properties["council_district"] = record["council_district"]
        if len(record.get("neighborhoods", [])) > 1:
            properties["serves"] = ", ".join(record["neighborhoods"])
        for field in ("address", "phone", "email", "meeting_information", "website"):
            value = record.get(field, "")
            if value:  # absent beats empty: the popup branches on presence
                properties[field] = value
        properties["precision"] = record["precision"]
        features.append(
            {
                "type": "Feature",
                "properties": properties,
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(record["longitude"], 6), round(record["latitude"], 6)],
                },
            }
        )
    payload = {"type": "FeatureCollection", "features": features}
    OUT_ASSETS.write_text(json.dumps(payload, indent=1, sort_keys=True), encoding="utf-8")


def collect_source_urls(rows: list[dict[str, str]]) -> dict[str, str]:
    """Level -> the CD2 page it came from, asserted to be one URL per level.

    A level whose rows disagree is a sheet bug, not something to pick a winner for: the panel
    would link some readers to the wrong neighbourhood's page and nothing would say so.
    """
    by_level: dict[str, set[str]] = {}
    for row in rows:
        url = row.get("source_url", "")
        if url:
            by_level.setdefault(row["level"], set()).add(url)

    conflicts = {level: sorted(urls) for level, urls in by_level.items() if len(urls) > 1}
    if conflicts:
        raise SystemExit(f"source_url differs within a level: {conflicts}")
    return {level: urls.pop() for level, urls in by_level.items()}


def write_neighborhoods(labels: list[str], source_urls: dict[str, str]) -> None:
    """The 7 CD2 CSAs, properties reduced to CSA_Label plus the page each came from.

    1198 KB -> 20 KB, so /map never pulls the 304-feature county file. Dropping the LAHSA
    count columns is also deliberate: CsaDistrictSummary.tsx records that LAHSA's metadata
    forbids aggregating those counts to other geographies, and they have no business in a
    civic-assets context.
    """
    collection = json.loads(CSA_GEOJSON.read_text(encoding="utf-8"))
    wanted = set(labels)
    features = []
    for feature in collection.get("features", []):
        label = (feature.get("properties") or {}).get("CSA_Label")
        if label in wanted:
            properties = {"CSA_Label": label}
            source_url = source_urls.get(label[len("Los Angeles - "):], "")
            if source_url:
                properties["source_url"] = source_url
            features.append(
                {
                    "type": "Feature",
                    "properties": properties,
                    "geometry": feature["geometry"],
                }
            )
    found = {(feature["properties"]["CSA_Label"]) for feature in features}
    missing = wanted - found
    if missing:
        raise SystemExit(f"CSA labels not found in {CSA_GEOJSON.name}: {sorted(missing)}")

    features.sort(key=lambda feature: feature["properties"]["CSA_Label"])
    payload = {"type": "FeatureCollection", "features": features}
    # The District Overview panel's link has no polygon to hang on -- "Districtwide" is a pin
    # grouping, not a CSA. A foreign member on the collection is legal GeoJSON (RFC 7946 s6.1)
    # and keeps the sheet the single source of both URLs; the frontend reads it by this name.
    district_url = source_urls.get(DISTRICT_LEVEL, "")
    if district_url:
        payload["district_source_url"] = district_url
    OUT_NEIGHBORHOODS.write_text(json.dumps(payload, indent=1, sort_keys=True), encoding="utf-8")


# -------------------------------------------------------------------------- main


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument(
        "--offline",
        action="store_true",
        help="use only the cache; do not call Nominatim",
    )
    args = parser.parse_args()

    if not args.xlsx.exists():
        raise SystemExit(f"spreadsheet not found: {args.xlsx}")

    rows = [normalize(row) for row in ROW_SOURCE(args.xlsx) if row.get("label")]
    total = len(rows)
    print(f"{total} rows in {args.xlsx.name}")

    unexpected = sorted({row["category"] for row in rows} - set(CATEGORY_KEYS))
    if unexpected:
        raise SystemExit(f"unexpected category values: {unexpected}")

    cache = load_cache()
    kept: list[dict] = []
    dropped: list[dict] = []

    for index, row in enumerate(rows, start=1):
        label = row["label"][:44]
        manual = MANUAL_COORDINATES.get(row["label"])
        kind = classify(row["address"])

        candidate = None
        precision = ""
        district = None

        if kind not in ("po_box", "too_coarse"):
            params = build_query(row["address"], kind)
            street = params.get("street") or params.get("q", "")
            candidate, precision, district = pick_candidate(
                geocode(params, cache, offline=args.offline), street, kind
            )

            if candidate is None and kind == "street":
                # Tier 2: free-form over the whole address, street precision only.
                candidate, precision, district = pick_candidate(
                    geocode({"q": full_address(row["address"])}, cache, offline=args.offline),
                    street,
                    "intersection",
                )

            if candidate is None and looks_like_place(row["label"]):
                # Tier 3: the label as a POI name. The cross-street rows are all named parks
                # and Nominatim knows them by name.
                candidate, precision, district = pick_candidate(
                    geocode(
                        {"q": f"{row['label']}, Los Angeles, CA"}, cache, offline=args.offline
                    ),
                    "",
                    "intersection",
                )
                if candidate is not None:
                    precision = "name"

        if candidate is not None:
            longitude = float(candidate["lon"])
            latitude = float(candidate["lat"])
        elif manual is not None:
            # Tier 4: hand-supplied OSM intersection node.
            longitude, latitude = manual
            precision = "intersection"
            district = find_district_id_for_point(longitude, latitude)
        else:
            reason = kind if kind in ("po_box", "too_coarse") else "no_match"
            dropped.append({**row, "reason": reason, "landed_district": None})
            print(f"[{index:2d}/{total}] drop  {label:46s} {reason}")
            continue

        kept.append(
            {
                **row,
                "longitude": longitude,
                "latitude": latitude,
                "precision": precision,
                "council_district": district,
            }
        )
        where = f"CD{district}" if district else "outside the city"
        print(f"[{index:2d}/{total}] keep  {label:46s} {precision:12s} {where}")

    # Every row lands in exactly one output, or we do not write anything.
    if len(kept) + len(dropped) != total:
        raise SystemExit(f"row accounting failed: {len(kept)} + {len(dropped)} != {total}")

    features, conflicts = dedupe(kept)

    # "Districtwide" is a pin grouping, not a CSA; only the 7 real neighbourhoods have polygons.
    neighborhoods = sorted(
        {
            f"Los Angeles - {row['neighborhood']}"
            for row in rows
            if row["neighborhood"] not in ("", DISTRICTWIDE)
        }
    )
    source_urls = collect_source_urls(rows)
    write_neighborhoods(neighborhoods, source_urls)
    write_assets(features)
    write_report(dropped, kept, total, features, conflicts)

    print()
    print(f"kept    {len(kept):3d}  located")
    print(f"pins    {len(features):3d}  -> {OUT_ASSETS.relative_to(FRONTEND_ROOT)}"
          f"  ({len(kept) - len(features)} merged as same location)")
    print(f"dropped {len(dropped):3d}  -> {OUT_REPORT.relative_to(FRONTEND_ROOT)}")
    print(f"CSAs    {len(neighborhoods):3d}  -> {OUT_NEIGHBORHOODS.relative_to(FRONTEND_ROOT)}")
    rooftop = sum(1 for row in features if row["precision"] == "rooftop")
    print(f"        {rooftop:3d}  rooftop, {len(features) - rooftop} street-level")
    if conflicts:
        print(f"        {len(conflicts):3d}  rows share a label but not a location - see report")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
