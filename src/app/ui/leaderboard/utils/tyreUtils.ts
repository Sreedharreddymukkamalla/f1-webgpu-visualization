/**
 * Tyre compound names mapped by code
 */
const TYRE_COMPOUNDS: { [key: number]: string } = {
  0: 'SOFT',
  1: 'MEDIUM',
  2: 'HARD',
  3: 'INTERMEDIATE',
  4: 'WET',
  5: 'UNKNOWN',
  6: 'TEST_UNKNOWN',
};

/**
 * Tyre image paths mapped by code
 */
const TYRE_IMAGES: { [key: number]: string } = {
  0: '/images/tyres/Soft.svg',
  1: '/images/tyres/Medium.svg',
  2: '/images/tyres/Hard.svg',
  3: '/images/tyres/Inters.svg',
  4: '/images/tyres/Wets.svg',
};

/**
 * Get the tyre compound name from its code
 */
export function getTyreCompound(tyreCode: number): string {
  return TYRE_COMPOUNDS[tyreCode] || 'UNKNOWN';
}

/**
 * Get the tyre image path from its code
 */
export function getTyreImagePath(tyreCode: number): string {
  return TYRE_IMAGES[tyreCode] || '/images/tyres/Hard.svg';
}
