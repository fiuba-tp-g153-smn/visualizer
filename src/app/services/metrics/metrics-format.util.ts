export function secs(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return (value < 10 ? value.toFixed(2) : value.toFixed(1)) + 's';
}

export function pct(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return (value * 100).toFixed(1) + '%';
}

export function ago(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) {
    return '—';
  }
  const seconds = (now - new Date(iso).getTime()) / 1000;
  if (!isFinite(seconds)) {
    return '—';
  }
  if (seconds < 60) {
    return 'hace ' + Math.floor(seconds) + 's';
  }
  if (seconds < 3600) {
    return 'hace ' + Math.floor(seconds / 60) + 'm';
  }
  if (seconds < 86400) {
    return 'hace ' + Math.floor(seconds / 3600) + 'h';
  }
  return 'hace ' + Math.floor(seconds / 86400) + 'd';
}

export function fmtBucket(bucket: string): string {
  if (bucket.length >= 15) {
    return bucket.slice(5, 10) + ' ' + bucket.slice(11, 13) + ':' + bucket.slice(14, 15) + '0';
  }
  if (bucket.length >= 13) {
    return bucket.slice(5, 10) + ' ' + bucket.slice(11, 13) + 'h';
  }
  return bucket.slice(5, 10);
}
