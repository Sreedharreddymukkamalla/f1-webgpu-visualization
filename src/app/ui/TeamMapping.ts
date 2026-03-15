/**
 * Maps driver codes to their respective teams dynamically based on loaded race data
 */

// Dynamic team mapping loaded from API
let DRIVER_TO_TEAM: { [driverCode: string]: string } = {};

/**
 * Set the driver team mapping from loaded race data
 * @param teamData - Team data from API { "VER": { "name": "Red Bull Racing", "key": "redbull" }, ... }
 */
export function setDriverTeams(teamData: { [driverCode: string]: { name: string; key: string } }): void {
  DRIVER_TO_TEAM = {};
  for (const [driverCode, info] of Object.entries(teamData)) {
    DRIVER_TO_TEAM[driverCode] =`${capitalizeTeamKey(info.key)}.svg`;
  }
}

/**
 * Capitalize team key for filename (e.g., "redbull" -> "Redbull")
 */
function capitalizeTeamKey(teamKey: string): string {
  // Handle special cases
  const specialCases: { [key: string]: string } = {
    'redbull': 'Redbull',
    'mercedes': 'Mercedes',
    'ferrari': 'Ferrari',
    'mclaren': 'McLaren',
    'astonmartin': 'AstonMartin',
    'alpine': 'Alpine',
    'williams': 'Williams',
    'racingbulls': 'RacingBulls',
    'kicksauber': 'KickSauber',
    'haas': 'Haas',
  };
  
  return specialCases[teamKey] || teamKey.charAt(0).toUpperCase() + teamKey.slice(1);
}

/**
 * Get the team logo filename for a given driver code
 * @param driverCode - Three-letter driver code (e.g., 'VER', 'HAM')
 * @returns The team logo filename or null if not found
 */
export function getTeamLogo(driverCode: string): string | null {
  return DRIVER_TO_TEAM[driverCode.toUpperCase()] || null;
}

/**
 * Get the full path to the team logo for a given driver code
 * @param driverCode - Three-letter driver code (e.g., 'VER', 'HAM')
 * @returns The full path to the team logo or null if not found
 */
export function getTeamLogoPath(driverCode: string): string | null {
  const logo = getTeamLogo(driverCode);
  return logo ? `/images/teams/${logo}` : null;
}

/**
 * Get the team color CSS class for a given driver code
 * @param driverCode - Three-letter driver code (e.g., 'VER', 'HAM')
 * @returns The team color CSS class or 'team-color-default' if not found
 */
export function getTeamColorClass(driverCode: string): string {
  const logo = getTeamLogo(driverCode);
  if (!logo) return 'team-color-default';
  
  const teamName = logo.replace('.svg', '').toLowerCase();
  return `team-color-${teamName}`;
}

/**
 * Get the full driver name for a given driver code
 * @param driverCode - Three-letter driver code (e.g., 'VER', 'HAM')
 */
export function getDriverName(driverCode: string): string {
  const drivers: { [key: string]: string } = {
    'VER': 'Verstappen',
    'PER': 'Perez',
    'HAM': 'Hamilton',
    'RUS': 'Russell',
    'LEC': 'Leclerc',
    'SAI': 'Sainz',
    'NOR': 'Norris',
    'PIA': 'Piastri',
    'ALO': 'Alonso',
    'STR': 'Stroll',
    'GAS': 'Gasly',
    'OCO': 'Ocon',
    'ALB': 'Albon',
    'SAR': 'Sargeant',
    'TSU': 'Tsunoda',
    'RIC': 'Ricciardo',
    'BOT': 'Bottas',
    'ZHO': 'Zhou',
    'MAG': 'Magnussen',
    'HUL': 'Hulkenberg'
  };
  
  return drivers[driverCode.toUpperCase()] || driverCode;
}
