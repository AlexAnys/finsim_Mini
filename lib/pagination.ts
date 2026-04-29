const DEFAULT_TAKE = 100;
const MAX_TAKE = 200;

function toPositiveInt(value: string | number | null | undefined) {
  const raw = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(raw) || raw < 1) return undefined;
  return Math.floor(raw);
}

export function clampTake(
  value: string | number | null | undefined,
  defaultTake = DEFAULT_TAKE,
  maxTake = MAX_TAKE,
) {
  const parsed = toPositiveInt(value) ?? defaultTake;
  return Math.min(Math.max(parsed, 1), maxTake);
}

export function parseListTake(
  searchParams: URLSearchParams,
  defaultTake = DEFAULT_TAKE,
  maxTake = MAX_TAKE,
) {
  return clampTake(searchParams.get("take") ?? searchParams.get("pageSize"), defaultTake, maxTake);
}

export function clampPage(value: string | number | null | undefined) {
  return toPositiveInt(value) ?? 1;
}
