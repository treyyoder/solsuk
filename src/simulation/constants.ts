/** Single source of truth for world scale & timing. Stylized, not to scale. */

export const EARTH_RADIUS = 3.0
export const CLOUD_RADIUS = 3.02
/** outer bound of the limb-glow shell — the glow itself decays to ~0 long
 * before this radius, so the geometry edge is never visible */
export const ATMOSPHERE_RADIUS = 3.85

/** Earth's axial tilt, radians */
export const EARTH_TILT = (23.4 * Math.PI) / 180
/** seconds for one Earth rotation — a real mean solar day. Now that speed
 * level 1 is genuine real-time (see utils/time.ts), this and the periods
 * below must be actual astronomical durations or the clockwork reads as
 * "wildly off" the moment you compare it to a wall clock. */
export const EARTH_DAY = 86400

export const MOON_RADIUS = 0.9
export const MOON_ORBIT_RADIUS = 40
export const MOON_INCLINATION = (5.1 * Math.PI) / 180
/** seconds for one lunar orbit — real sidereal month (27.32 days) */
export const MOON_PERIOD = 27.321661 * 86400

export const SUN_DISTANCE = 300
export const SUN_VISUAL_RADIUS = 9
/** seconds for the sun direction to precess once around the ecliptic — a real year */
export const SUN_PERIOD = 365.25 * 86400

export const STAR_RADIUS = 460
export const CONSTELLATION_RADIUS = 455

export const DEFAULT_SPEED_LEVEL = 1
export const MAX_SPEED_LEVEL = 100

/**
 * Orbit slots — sun-riding deconflicted constellation.
 *
 * Every data center flies an orbit whose plane stays near the terminator plane
 * (normal within MAX_TILT of the sun line). Because the plane precesses with
 * the sun, a satellite on it never crosses Earth's umbra: it is ALWAYS sunlit
 * as long as r·cos(tilt) clears the shadow cylinder. Deconfliction is by
 * construction — every satellite owns a unique (radius, tilt, plane-azimuth,
 * phase) slot laid out with golden-angle spacing, so no two ever converge.
 */
export const ORBIT_MIN_RADIUS = 4.0
export const ORBIT_MAX_RADIUS = 6.6
/** max tilt of an orbit normal away from the sun line, radians. 33° keeps
 * ORBIT_MIN_RADIUS·cos(tilt)=3.35 > shadow cylinder (3.0)+penumbra (0.18). */
export const ORBIT_MAX_TILT = (33 * Math.PI) / 180
/** orbital period at ORBIT_MIN_RADIUS, seconds — a realistic ~90-minute LEO
 * period (Kepler r^1.5 scaling above it for the outer shells) */
export const ORBIT_BASE_PERIOD = 5400

export const DEFAULT_SAT_COUNT = 1024
export const MAX_SAT_COUNT = 4096
/** visual scale of one data center (1.0 = the original prototype size) */
export const DEFAULT_SAT_SCALE = 0.1
