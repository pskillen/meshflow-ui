/** MeshCore region scope validation (matches meshflow-api common/mc_region_scope.py). */

export function normalizeRegionScope(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const raw = value.trim().toLowerCase().replace(/^#+/, '');
  if (!raw || raw === '*' || raw === 'none' || raw === 'null') {
    return null;
  }
  if (new TextEncoder().encode(raw).length > 29) {
    throw new Error('Region scope exceeds 29 UTF-8 bytes.');
  }
  if (!/^[a-z0-9-]+$/.test(raw)) {
    throw new Error('Region scope must use lowercase letters, digits, and hyphens only.');
  }
  return raw;
}

export function formatRegionScopeSuffix(scope: string | null | undefined): string {
  const s = scope?.trim();
  return s ? ` · ${s}` : '';
}
