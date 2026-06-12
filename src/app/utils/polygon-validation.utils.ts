import { LatLng } from '../models/geo';

export function isSimplePolygon(coordinates: Array<LatLng>): boolean {
  if (coordinates.length < 3) return false;

  const segments = getSegments(coordinates);

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 2; j < segments.length; j++) {
      if (i === 0 && j === segments.length - 1) continue;

      if (segmentsIntersect(segments[i], segments[j])) {
        return false;
      }
    }
  }

  return true;
}

function getSegments(coordinates: Array<LatLng>): Array<[LatLng, LatLng]> {
  const segments: Array<[LatLng, LatLng]> = [];

  for (let i = 0; i < coordinates.length; i++) {
    const next = (i + 1) % coordinates.length;
    segments.push([coordinates[i], coordinates[next]]);
  }

  return segments;
}

function segmentsIntersect(seg1: [LatLng, LatLng], seg2: [LatLng, LatLng]): boolean {
  const [p1, p2] = seg1;
  const [p3, p4] = seg2;

  // Verificar si comparten un punto extremo
  if (pointsEqual(p1, p3) || pointsEqual(p1, p4) || pointsEqual(p2, p3) || pointsEqual(p2, p4)) {
    return false;
  }

  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(p3, p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p4, p2)) return true;

  return false;
}

function direction(p1: LatLng, p2: LatLng, p3: LatLng): number {
  return (p3[0] - p1[0]) * (p2[1] - p1[1]) - (p2[0] - p1[0]) * (p3[1] - p1[1]);
}

function onSegment(p1: LatLng, p: LatLng, p2: LatLng): boolean {
  return (
    p[0] <= Math.max(p1[0], p2[0]) &&
    p[0] >= Math.min(p1[0], p2[0]) &&
    p[1] <= Math.max(p1[1], p2[1]) &&
    p[1] >= Math.min(p1[1], p2[1])
  );
}

function pointsEqual(p1: LatLng, p2: LatLng): boolean {
  const epsilon = 1e-10;
  return Math.abs(p1[0] - p2[0]) < epsilon && Math.abs(p1[1] - p2[1]) < epsilon;
}
