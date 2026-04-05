/**
 * Display-only utility functions.
 * These convert internal state values to human-readable labels
 * without mutating the actual state or API payloads.
 */

const DISASTER_LABELS: Record<string, string> = {
  earthquake: 'Quake',
  flood: 'Flood',
  fire: 'Fire',
};

export function getDisasterLabel(type: string): string {
  return DISASTER_LABELS[type] || type;
}
