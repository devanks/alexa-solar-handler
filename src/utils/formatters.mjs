// src/utils/formatters.mjs

export const formatPower = (watts) => {
  if (watts == null || typeof watts !== 'number' || !Number.isFinite(watts)) {
    return 'an unknown amount of power';
  }

  // --- FIX: Handle exactly 0 explicitly ---
  if (watts === 0) {
    return '0 watts';
  }
  // --- FIX: Handle near-zero *after* checking for exact 0 ---
  if (Math.abs(watts) < 1) {
    return 'almost zero watts';
  }
  if (Math.abs(watts) >= 1000) {
    return `${(watts / 1000).toFixed(1)} kilowatts`;
  }
  // --- FIX: Handle exactly 1 watt for correct pluralization ---
  const roundedWatts = Math.round(watts);
  if (roundedWatts === 1) {
    return '1 watt'; // Singular
  }
  return `${roundedWatts} watts`; // Plural (or zero, handled above)
};

// formatEnergy remains the same
export const formatEnergy = (kWh) => {
  // ... (previous correct code) ...
  if (kWh == null || typeof kWh !== 'number' || !Number.isFinite(kWh)) {
    return 'an unknown amount of energy';
  }
  return `${kWh.toFixed(1)} kilowatt hours`;
};
