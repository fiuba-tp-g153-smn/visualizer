#!/usr/bin/env python3
"""Build `public/geo/metarea-vi.json` from the Metarea VI shapefiles in `source/`.

The output is the boundary lines of the SMN marine-forecast zones of METAREA VI
(coastal zones and oceanic areas), one GeoJSON Feature per source shapefile, with
`{id, name}` properties, followed by one label Point per zone with
`{id, label, minZoom}`: the short name the SHN map uses, and the zoom from which
the frontend shows it. It is a committed, same-origin static asset: rerun this
script only when the sources or the tables below change, and commit the result.

Usage:
    python3 scripts/metarea-vi/build-geojson.py           # (re)write the output
    python3 scripts/metarea-vi/build-geojson.py --check   # fail if it is stale

Standard library only: the sources are plain PolyLine shapefiles, so the `.shp`
is parsed directly instead of depending on GDAL.

Sources
-------
`source/` holds the SMN shapefiles (2017-09 and 2018-03), unmodified. Every
change to their geometry lives in `CORRECTIONS`, justified against the official
definitions published in the SHN/SMN METAREA VI bulletin, "Referencias METAREA
VI" (consulted 2026-11-23):
    https://www.hidro.gov.ar/smara/GP/BoletinOlasMetVI.asp?op=3

Known differences that are deliberately NOT corrected (all <= ~5 km; fixing them
needs a coastline, since those vertices are where a boundary meets the coast):
  - B/C boundary at 41°02'15"S in the source, 41°S in the official text.
  - D/E boundary at 47°57'06"S in the source, 48°S in the official text.
  - Río de la Plata/A boundary at 36°17'34"S; Punta Rasa is at 36°17'23"S.
  - The coastal zones' "300 nautical miles offshore" edge is approximated by
    straight segments in the source.
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

SCRIPT_DIR = Path(__file__).resolve().parent
SOURCE_DIR = SCRIPT_DIR / "source"
OUTPUT_PATH = SCRIPT_DIR.parent.parent / "public" / "geo" / "metarea-vi.json"

COORDINATE_PRECISION = 5  # ~1 m
VERTEX_MATCH_TOLERANCE = 1e-7  # degrees; absorbs float noise from the .shp doubles

# Sanity envelope for METAREA VI (lon_min, lat_min, lon_max, lat_max), slightly
# padded: 20°W..67°16'W, Uruguay/Brazil frontier (33°45'S)..60°S.
EXPECTED_BBOX = (-68.0, -61.0, -20.0, -33.0)

SHP_FILE_CODE = 9994
SHP_HEADER_SIZE = 100
SHP_NULL = 0
SHP_POLYLINE = 3

Coord = tuple[float, float]
ZoneKind = Literal["coastal", "oceanic"]

# Zoom from which each kind of label is shown. Coastal zones are a few degrees
# tall, so their labels would pile up below zoom 5; oceanic areas fit from the
# outset. The frontend only reads `minZoom`, so the rule lives here.
LABEL_MIN_ZOOM: dict[ZoneKind, int] = {"coastal": 5, "oceanic": 0}


@dataclass(frozen=True, slots=True)
class Zone:
    source: str  # shapefile basename, without extension
    id: str
    name: str  # readable form of the file name
    label: str  # short name, as on the SHN METAREA VI map (METAREAVI2023.png)
    kind: ZoneKind  # as classified by the official text: G is a coastal zone, Drake an area


# Output order: coastal zones north to south, then the oceanic areas.
ZONES: tuple[Zone, ...] = (
    Zone("RioDeLaPlata", "rio-de-la-plata", "Río de la Plata", "RIO DE LA PLATA", "coastal"),
    Zone("ZonaA", "zona-a", "Zona A", "A", "coastal"),
    Zone("ZonaB", "zona-b", "Zona B", "B", "coastal"),
    Zone("ZonaC", "zona-c", "Zona C", "C", "coastal"),
    Zone("ZonaD", "zona-d", "Zona D", "D", "coastal"),
    Zone("ZonaE", "zona-e", "Zona E", "E", "coastal"),
    Zone("ZonaF", "zona-f", "Zona F", "F", "coastal"),
    Zone("ZonaMalvinas", "zona-malvinas", "Zona Malvinas", "G", "coastal"),
    Zone("AreaNorte", "area-norte", "Área Norte", "NORTE", "oceanic"),
    Zone("AreaCentroOeste", "area-centro-oeste", "Área Centro Oeste", "CENTRO OESTE", "oceanic"),
    Zone("AreaCentroEste", "area-centro-este", "Área Centro Este", "CENTRO ESTE", "oceanic"),
    Zone("ZonaSudoesteB", "zona-sudoeste-b", "Zona Sudoeste B", "SUR OESTE", "oceanic"),
    Zone("AreaSudeste", "area-sudeste", "Área Sudeste", "SUR ESTE", "oceanic"),
    Zone("ZonaDrake", "zona-drake", "Zona Drake", "DRAKE", "oceanic"),
)

# Label anchors that override the computed centroid (see `label_anchor`), where
# the centroid lands on or against land. Each must still fall inside its zone.
LABEL_POSITIONS: dict[str, Coord] = {
    # The centroid (-59, -52) sits on the islands themselves; move it to open
    # water south of them, still inside the zone.
    "ZonaMalvinas": (-59.0, -53.2),
    # The centroid (-63.66, -54.50) is pressed against Isla de los Estados.
    "ZonaF": (-61.8, -54.5),
}

# Point on Zona B's eastern edge, (-50, -38.5) -> (-53, -41.0375), at 40°S.
_ZONA_B_EDGE_AT_40S: Coord = (-50.0 - 3.0 * 1.5 / 2.5375, -40.0)

# 67°16'W, the official western limit of Área Drake and of METAREA VI.
_DRAKE_WEST_LON = -(67.0 + 16.0 / 60.0)

# Vertex replacements per source shapefile: (vertex in the source, replacement).
# Every listed vertex MUST exist in its layer, or the build aborts, so a changed
# source can never silently receive a stale correction.
CORRECTIONS: dict[str, tuple[tuple[Coord, Coord], ...]] = {
    # Official text: Área Norte spans "desde límite oriental de Zonas A y B" and
    # Área Centro Oeste "desde límite oriental de Zonas B, C, D y E", i.e. their
    # western edge IS the coastal zones' eastern edge. The source puts it at
    # (-51.75, -40), ~2 km off Zona B's edge, leaving a sliver; snap it onto the
    # coastal edge, which the definition takes as the reference.
    "AreaNorte": (((-51.75, -40.0), _ZONA_B_EDGE_AT_40S),),
    "AreaCentroOeste": (((-51.75, -40.0), _ZONA_B_EDGE_AT_40S),),
    # Official text: Área Drake spans "desde latitud 55º Sur hasta 60º Sur y desde
    # longitud 67º16' Oeste hasta 60º Oeste" (also the WMO western limit of
    # METAREA VI, and the SHN 2023 map). The source stops at 66°44'W and starts
    # its northern edge at a coastal point at 55.0601°S.
    "ZonaDrake": (
        ((-66.73982, -55.0601), (_DRAKE_WEST_LON, -55.0)),
        ((-66.73982, -60.0), (_DRAKE_WEST_LON, -60.0)),
    ),
    # Keep the F/Drake boundary shared after moving Drake's north-west corner.
    "ZonaF": (((-66.73982, -55.0601), (_DRAKE_WEST_LON, -55.0)),),
}


class BuildError(Exception):
    """The sources or tables are inconsistent; the output must not be written."""


def read_polyline_parts(shp_path: Path) -> list[list[Coord]]:
    """Return every part of every PolyLine record in a `.shp` file."""
    data = shp_path.read_bytes()
    file_code, shape_type = _read_header(data, shp_path)
    if file_code != SHP_FILE_CODE or shape_type != SHP_POLYLINE:
        raise BuildError(f"{shp_path.name}: not a PolyLine shapefile (type {shape_type})")

    parts: list[list[Coord]] = []
    offset = SHP_HEADER_SIZE
    while offset < len(data):
        _, content_words = struct.unpack_from(">ii", data, offset)
        content_start = offset + 8
        parts.extend(_read_polyline_record(data, content_start, shp_path))
        offset = content_start + content_words * 2
    if not parts:
        raise BuildError(f"{shp_path.name}: no geometry")
    return parts


def _read_header(data: bytes, shp_path: Path) -> tuple[int, int]:
    if len(data) < SHP_HEADER_SIZE:
        raise BuildError(f"{shp_path.name}: truncated header")
    (file_code,) = struct.unpack_from(">i", data, 0)
    (shape_type,) = struct.unpack_from("<i", data, 32)
    return file_code, shape_type


def _read_polyline_record(data: bytes, start: int, shp_path: Path) -> list[list[Coord]]:
    (shape_type,) = struct.unpack_from("<i", data, start)
    if shape_type == SHP_NULL:
        return []
    if shape_type != SHP_POLYLINE:
        raise BuildError(f"{shp_path.name}: unsupported record shape type {shape_type}")

    num_parts, num_points = struct.unpack_from("<ii", data, start + 36)
    part_starts = list(struct.unpack_from(f"<{num_parts}i", data, start + 44))
    points_start = start + 44 + 4 * num_parts
    flat = struct.unpack_from(f"<{2 * num_points}d", data, points_start)
    points = [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]

    bounds = part_starts + [num_points]
    return [points[bounds[i] : bounds[i + 1]] for i in range(num_parts)]


def assert_wgs84(prj_path: Path) -> None:
    """Fail unless the `.prj` declares geographic WGS84 coordinates."""
    wkt = prj_path.read_text(encoding="utf-8")
    if not wkt.startswith("GEOGCS[") or "WGS_1984" not in wkt.replace(" ", "_"):
        raise BuildError(f"{prj_path.name}: expected geographic WGS84, got {wkt[:60]!r}")


def apply_corrections(source: str, parts: list[list[Coord]]) -> list[list[Coord]]:
    """Replace the vertices listed in `CORRECTIONS` for this layer."""
    corrected = [list(part) for part in parts]
    for original, replacement in CORRECTIONS.get(source, ()):
        hits = 0
        for part in corrected:
            for i, vertex in enumerate(part):
                if _same_vertex(vertex, original):
                    part[i] = replacement
                    hits += 1
        if hits == 0:
            raise BuildError(f"{source}: correction vertex {original} not found in the source")
    return corrected


def _same_vertex(a: Coord, b: Coord) -> bool:
    return abs(a[0] - b[0]) <= VERTEX_MATCH_TOLERANCE and abs(a[1] - b[1]) <= VERTEX_MATCH_TOLERANCE


def build_feature(zone: Zone) -> dict[str, object]:
    """Read, validate and correct one zone, as a GeoJSON Feature."""
    assert_wgs84(SOURCE_DIR / f"{zone.source}.prj")
    parts = read_polyline_parts(SOURCE_DIR / f"{zone.source}.shp")
    lines = [[_round(v) for v in part] for part in apply_corrections(zone.source, parts)]
    if any(len(line) < 2 for line in lines):
        raise BuildError(f"{zone.source}: a line has fewer than two vertices")

    geometry: dict[str, object] = (
        {"type": "LineString", "coordinates": lines[0]}
        if len(lines) == 1
        else {"type": "MultiLineString", "coordinates": lines}
    )
    return {
        "type": "Feature",
        "properties": {"id": zone.id, "name": zone.name},
        "geometry": geometry,
    }


def _round(vertex: Coord) -> list[float]:
    return [round(vertex[0], COORDINATE_PRECISION), round(vertex[1], COORDINATE_PRECISION)]


def zone_ring(line_feature: dict[str, object]) -> list[Coord]:
    """The zone as a closed ring.

    Oceanic areas already are closed rings. A coastal zone is an open line from
    one coast point to another (the coast closes it), so it is closed with the
    straight chord between its two ends: close enough to the real coastline to
    place a label and test containment, without needing a coastline.
    """
    geometry = line_feature["geometry"]
    if geometry["type"] != "LineString":  # type: ignore[index]
        raise BuildError("labels are only supported for single-line zones")
    ring = [(lon, lat) for lon, lat in geometry["coordinates"]]  # type: ignore[index]
    return ring if ring[0] == ring[-1] else ring + [ring[0]]


def ring_centroid(ring: list[Coord]) -> Coord:
    """Area centroid of a closed ring (shoelace formula)."""
    twice_area = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        cross = x0 * y1 - x1 * y0
        twice_area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if twice_area == 0:
        raise BuildError("degenerate zone ring (zero area)")
    return cx / (3 * twice_area), cy / (3 * twice_area)


def ring_contains(ring: list[Coord], point: Coord) -> bool:
    """Even-odd ray casting; the ring must be closed."""
    x, y = point
    inside = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            inside = not inside
    return inside


def build_label_feature(zone: Zone, line_feature: dict[str, object]) -> dict[str, object]:
    """The zone's label Point: a `LABEL_POSITIONS` override or the ring centroid."""
    ring = zone_ring(line_feature)
    anchor = LABEL_POSITIONS.get(zone.source) or ring_centroid(ring)
    if not ring_contains(ring, anchor):
        raise BuildError(f"{zone.source}: label anchor {anchor} falls outside the zone")
    return {
        "type": "Feature",
        "properties": {"id": zone.id, "label": zone.label, "minZoom": LABEL_MIN_ZOOM[zone.kind]},
        "geometry": {"type": "Point", "coordinates": _round(anchor)},
    }


def check_sources_match_zones() -> None:
    """Every shapefile has a `ZONES` entry and vice versa; ids are unique."""
    on_disk = {path.stem for path in SOURCE_DIR.glob("*.shp")}
    declared = {zone.source for zone in ZONES}
    if on_disk != declared:
        raise BuildError(
            f"source/ and ZONES differ: missing in ZONES {sorted(on_disk - declared)}, "
            f"missing on disk {sorted(declared - on_disk)}"
        )
    if len({zone.id for zone in ZONES}) != len(ZONES):
        raise BuildError("duplicate ids in ZONES")
    for table_name, table in (("CORRECTIONS", CORRECTIONS), ("LABEL_POSITIONS", LABEL_POSITIONS)):
        unknown = set(table) - declared
        if unknown:
            raise BuildError(f"{table_name} for unknown layers: {sorted(unknown)}")


def check_within_bbox(features: list[dict[str, object]]) -> None:
    """Every vertex falls inside the METAREA VI envelope."""
    lon_min, lat_min, lon_max, lat_max = EXPECTED_BBOX
    for feature in features:
        for lon, lat in _vertices(feature):
            if not (lon_min <= lon <= lon_max and lat_min <= lat <= lat_max):
                name = feature["properties"]["name"]  # type: ignore[index]
                raise BuildError(f"{name}: vertex ({lon}, {lat}) outside METAREA VI")


def _vertices(feature: dict[str, object]) -> list[list[float]]:
    geometry = feature["geometry"]
    coords = geometry["coordinates"]  # type: ignore[index]
    if geometry["type"] == "Point":  # type: ignore[index]
        return [coords]
    if geometry["type"] == "LineString":  # type: ignore[index]
        return coords
    return [vertex for line in coords for vertex in line]


def render(features: list[dict[str, object]]) -> str:
    """Serialize deterministically: one Feature per line, for readable diffs."""
    lines = [json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in features]
    body = ",\n".join(lines)
    return '{"type":"FeatureCollection","features":[\n' + body + "\n]}\n"


def build() -> str:
    """Build the output document from `source/`, or raise `BuildError`."""
    check_sources_match_zones()
    lines = [build_feature(zone) for zone in ZONES]
    labels = [build_label_feature(zone, line) for zone, line in zip(ZONES, lines)]
    features = lines + labels
    check_within_bbox(features)
    return render(features)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument(
        "--check",
        action="store_true",
        help="do not write; exit 1 if the committed output differs from a fresh build",
    )
    args = parser.parse_args()

    try:
        output = build()
    except BuildError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    relative = OUTPUT_PATH.relative_to(SCRIPT_DIR.parent.parent)
    if args.check:
        current = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else None
        if current != output:
            print(f"{relative} is stale: rerun scripts/metarea-vi/build-geojson.py", file=sys.stderr)
            return 1
        print(f"{relative} is up to date")
        return 0

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(output, encoding="utf-8")
    size = len(output.encode("utf-8"))
    print(f"wrote {relative} ({size} bytes, {len(ZONES)} zones, each a line and a label)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
