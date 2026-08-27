import type { GroundStation, Vec3 } from './types'
import { EARTH_RADIUS, EARTH_TILT } from './constants'
import { earthRotation, latLonToVec } from './orbits'

/**
 * Downlink cities — the world's 100 most populous urban agglomerations,
 * sorted DESCENDING by population (approx. millions, mid-2020s estimates).
 * The net lights them up in this order as it grows: `activeCityCount(year)`
 * says how many of the head of this list are receiving data in a given year.
 */
export const GROUND_STATIONS: GroundStation[] = [
  { id: 'tokyo', name: 'Tokyo', latDeg: 35.68, lonDeg: 139.69, popM: 37.0 },
  { id: 'delhi', name: 'Delhi', latDeg: 28.61, lonDeg: 77.21, popM: 34.7 },
  { id: 'shanghai', name: 'Shanghai', latDeg: 31.23, lonDeg: 121.47, popM: 30.5 },
  { id: 'dhaka', name: 'Dhaka', latDeg: 23.81, lonDeg: 90.41, popM: 24.7 },
  { id: 'cairo', name: 'Cairo', latDeg: 30.04, lonDeg: 31.24, popM: 23.1 },
  { id: 'saopaulo', name: 'Sao Paulo', latDeg: -23.55, lonDeg: -46.63, popM: 22.8 },
  { id: 'mexicocity', name: 'Mexico City', latDeg: 19.43, lonDeg: -99.13, popM: 22.8 },
  { id: 'beijing', name: 'Beijing', latDeg: 39.9, lonDeg: 116.41, popM: 22.6 },
  { id: 'mumbai', name: 'Mumbai', latDeg: 19.08, lonDeg: 72.88, popM: 22.1 },
  { id: 'ny', name: 'New York', latDeg: 40.71, lonDeg: -74.01, popM: 18.9 },
  { id: 'osaka', name: 'Osaka', latDeg: 34.69, lonDeg: 135.5, popM: 18.9 },
  { id: 'chongqing', name: 'Chongqing', latDeg: 29.56, lonDeg: 106.55, popM: 18.2 },
  { id: 'karachi', name: 'Karachi', latDeg: 24.86, lonDeg: 67.01, popM: 18.0 },
  { id: 'kinshasa', name: 'Kinshasa', latDeg: -4.44, lonDeg: 15.27, popM: 17.8 },
  { id: 'lagos', name: 'Lagos', latDeg: 6.52, lonDeg: 3.38, popM: 17.2 },
  { id: 'istanbul', name: 'Istanbul', latDeg: 41.01, lonDeg: 28.98, popM: 16.2 },
  { id: 'kolkata', name: 'Kolkata', latDeg: 22.57, lonDeg: 88.36, popM: 15.8 },
  { id: 'buenosaires', name: 'Buenos Aires', latDeg: -34.6, lonDeg: -58.38, popM: 15.7 },
  { id: 'manila', name: 'Manila', latDeg: 14.6, lonDeg: 120.98, popM: 15.2 },
  { id: 'guangzhou', name: 'Guangzhou', latDeg: 23.13, lonDeg: 113.26, popM: 14.9 },
  { id: 'tianjin', name: 'Tianjin', latDeg: 39.34, lonDeg: 117.36, popM: 14.7 },
  { id: 'lahore', name: 'Lahore', latDeg: 31.55, lonDeg: 74.34, popM: 14.5 },
  { id: 'bangalore', name: 'Bangalore', latDeg: 12.97, lonDeg: 77.59, popM: 14.4 },
  { id: 'rio', name: 'Rio de Janeiro', latDeg: -22.91, lonDeg: -43.17, popM: 13.9 },
  { id: 'shenzhen', name: 'Shenzhen', latDeg: 22.54, lonDeg: 114.06, popM: 13.5 },
  { id: 'moscow', name: 'Moscow', latDeg: 55.76, lonDeg: 37.62, popM: 12.8 },
  { id: 'la', name: 'Los Angeles', latDeg: 34.05, lonDeg: -118.24, popM: 12.6 },
  { id: 'chennai', name: 'Chennai', latDeg: 13.08, lonDeg: 80.27, popM: 12.5 },
  { id: 'bogota', name: 'Bogota', latDeg: 4.71, lonDeg: -74.07, popM: 11.9 },
  { id: 'jakarta', name: 'Jakarta', latDeg: -6.21, lonDeg: 106.85, popM: 11.6 },
  { id: 'lima', name: 'Lima', latDeg: -12.05, lonDeg: -77.04, popM: 11.5 },
  { id: 'bangkok', name: 'Bangkok', latDeg: 13.76, lonDeg: 100.5, popM: 11.5 },
  { id: 'paris', name: 'Paris', latDeg: 48.86, lonDeg: 2.35, popM: 11.4 },
  { id: 'hyderabad', name: 'Hyderabad', latDeg: 17.39, lonDeg: 78.49, popM: 11.3 },
  { id: 'seoul', name: 'Seoul', latDeg: 37.57, lonDeg: 126.98, popM: 10.0 },
  { id: 'nagoya', name: 'Nagoya', latDeg: 35.18, lonDeg: 136.91, popM: 9.6 },
  { id: 'london', name: 'London', latDeg: 51.51, lonDeg: -0.13, popM: 9.6 },
  { id: 'chengdu', name: 'Chengdu', latDeg: 30.57, lonDeg: 104.07, popM: 9.6 },
  { id: 'hcmc', name: 'Ho Chi Minh City', latDeg: 10.82, lonDeg: 106.63, popM: 9.6 },
  { id: 'tehran', name: 'Tehran', latDeg: 35.69, lonDeg: 51.39, popM: 9.5 },
  { id: 'luanda', name: 'Luanda', latDeg: -8.84, lonDeg: 13.23, popM: 9.3 },
  { id: 'wuhan', name: 'Wuhan', latDeg: 30.59, lonDeg: 114.31, popM: 8.9 },
  { id: 'xian', name: 'Xian', latDeg: 34.34, lonDeg: 108.94, popM: 8.6 },
  { id: 'ahmedabad', name: 'Ahmedabad', latDeg: 23.02, lonDeg: 72.57, popM: 8.6 },
  { id: 'kl', name: 'Kuala Lumpur', latDeg: 3.14, lonDeg: 101.69, popM: 8.5 },
  { id: 'hangzhou', name: 'Hangzhou', latDeg: 30.27, lonDeg: 120.16, popM: 8.4 },
  { id: 'suzhou', name: 'Suzhou', latDeg: 31.3, lonDeg: 120.58, popM: 8.3 },
  { id: 'hongkong', name: 'Hong Kong', latDeg: 22.32, lonDeg: 114.17, popM: 7.6 },
  { id: 'riyadh', name: 'Riyadh', latDeg: 24.71, lonDeg: 46.68, popM: 7.6 },
  { id: 'dongguan', name: 'Dongguan', latDeg: 23.02, lonDeg: 113.75, popM: 7.5 },
  { id: 'baghdad', name: 'Baghdad', latDeg: 33.31, lonDeg: 44.36, popM: 7.5 },
  { id: 'shenyang', name: 'Shenyang', latDeg: 41.8, lonDeg: 123.43, popM: 7.5 },
  { id: 'foshan', name: 'Foshan', latDeg: 23.02, lonDeg: 113.12, popM: 7.4 },
  { id: 'daressalaam', name: 'Dar es Salaam', latDeg: -6.79, lonDeg: 39.21, popM: 7.4 },
  { id: 'santiago', name: 'Santiago', latDeg: -33.45, lonDeg: -70.67, popM: 6.9 },
  { id: 'surat', name: 'Surat', latDeg: 21.17, lonDeg: 72.83, popM: 6.9 },
  { id: 'madrid', name: 'Madrid', latDeg: 40.42, lonDeg: -3.7, popM: 6.8 },
  { id: 'pune', name: 'Pune', latDeg: 18.52, lonDeg: 73.86, popM: 6.8 },
  { id: 'harbin', name: 'Harbin', latDeg: 45.8, lonDeg: 126.53, popM: 6.7 },
  { id: 'houston', name: 'Houston', latDeg: 29.76, lonDeg: -95.37, popM: 6.6 },
  { id: 'dallas', name: 'Dallas', latDeg: 32.78, lonDeg: -96.8, popM: 6.6 },
  { id: 'toronto', name: 'Toronto', latDeg: 43.65, lonDeg: -79.38, popM: 6.4 },
  { id: 'singapore', name: 'Singapore', latDeg: 1.35, lonDeg: 103.82, popM: 6.1 },
  { id: 'miami', name: 'Miami', latDeg: 25.76, lonDeg: -80.19, popM: 6.1 },
  { id: 'belohorizonte', name: 'Belo Horizonte', latDeg: -19.92, lonDeg: -43.94, popM: 6.1 },
  { id: 'philadelphia', name: 'Philadelphia', latDeg: 39.95, lonDeg: -75.17, popM: 5.8 },
  { id: 'atlanta', name: 'Atlanta', latDeg: 33.75, lonDeg: -84.39, popM: 5.8 },
  { id: 'barcelona', name: 'Barcelona', latDeg: 41.39, lonDeg: 2.17, popM: 5.6 },
  { id: 'fukuoka', name: 'Fukuoka', latDeg: 33.59, lonDeg: 130.4, popM: 5.5 },
  { id: 'khartoum', name: 'Khartoum', latDeg: 15.5, lonDeg: 32.56, popM: 5.5 },
  { id: 'johannesburg', name: 'Johannesburg', latDeg: -26.2, lonDeg: 28.05, popM: 5.5 },
  { id: 'stpetersburg', name: 'Saint Petersburg', latDeg: 59.93, lonDeg: 30.34, popM: 5.4 },
  { id: 'qingdao', name: 'Qingdao', latDeg: 36.07, lonDeg: 120.38, popM: 5.4 },
  { id: 'dalian', name: 'Dalian', latDeg: 38.91, lonDeg: 121.61, popM: 5.3 },
  { id: 'dc', name: 'Washington DC', latDeg: 38.91, lonDeg: -77.04, popM: 5.3 },
  { id: 'yangon', name: 'Yangon', latDeg: 16.87, lonDeg: 96.2, popM: 5.3 },
  { id: 'alexandria', name: 'Alexandria', latDeg: 31.2, lonDeg: 29.92, popM: 5.2 },
  { id: 'jinan', name: 'Jinan', latDeg: 36.65, lonDeg: 117.12, popM: 5.2 },
  { id: 'guadalajara', name: 'Guadalajara', latDeg: 20.66, lonDeg: -103.35, popM: 5.2 },
  { id: 'chittagong', name: 'Chittagong', latDeg: 22.36, lonDeg: 91.78, popM: 5.1 },
  { id: 'ankara', name: 'Ankara', latDeg: 39.93, lonDeg: 32.86, popM: 5.1 },
  { id: 'melbourne', name: 'Melbourne', latDeg: -37.81, lonDeg: 144.96, popM: 5.1 },
  { id: 'sydney', name: 'Sydney', latDeg: -33.87, lonDeg: 151.21, popM: 5.0 },
  { id: 'nairobi', name: 'Nairobi', latDeg: -1.29, lonDeg: 36.82, popM: 5.0 },
  { id: 'abidjan', name: 'Abidjan', latDeg: 5.36, lonDeg: -4.01, popM: 5.0 },
  { id: 'monterrey', name: 'Monterrey', latDeg: 25.69, lonDeg: -100.32, popM: 5.0 },
  { id: 'casablanca', name: 'Casablanca', latDeg: 33.57, lonDeg: -7.59, popM: 4.9 },
  { id: 'phoenix', name: 'Phoenix', latDeg: 33.45, lonDeg: -112.07, popM: 4.9 },
  { id: 'boston', name: 'Boston', latDeg: 42.36, lonDeg: -71.06, popM: 4.9 },
  { id: 'addisababa', name: 'Addis Ababa', latDeg: 9.01, lonDeg: 38.75, popM: 4.8 },
  { id: 'capetown', name: 'Cape Town', latDeg: -33.92, lonDeg: 18.42, popM: 4.8 },
  { id: 'amman', name: 'Amman', latDeg: 31.96, lonDeg: 35.95, popM: 4.7 },
  { id: 'jeddah', name: 'Jeddah', latDeg: 21.49, lonDeg: 39.19, popM: 4.7 },
  { id: 'hanoi', name: 'Hanoi', latDeg: 21.03, lonDeg: 105.85, popM: 4.7 },
  { id: 'sf', name: 'San Francisco', latDeg: 37.77, lonDeg: -122.42, popM: 4.7 },
  { id: 'kuwaitcity', name: 'Kuwait City', latDeg: 29.38, lonDeg: 47.99, popM: 4.6 },
  { id: 'berlin', name: 'Berlin', latDeg: 52.52, lonDeg: 13.41, popM: 4.6 },
  { id: 'rome', name: 'Rome', latDeg: 41.9, lonDeg: 12.5, popM: 4.3 },
  { id: 'montreal', name: 'Montreal', latDeg: 45.5, lonDeg: -73.57, popM: 4.3 },
  { id: 'recife', name: 'Recife', latDeg: -8.05, lonDeg: -34.88, popM: 4.2 },
]

export const CITIES = GROUND_STATIONS
export const MAX_CITIES = GROUND_STATIONS.length

/** how many cities (head of the population-sorted list) the net serves per year */
const CITY_COUNT_KEYFRAMES: [number, number][] = [
  [2026.999, 0], [2027, 3], [2028, 5], [2030, 8], [2033, 12], [2035, 16], [2040, 28],
  [2045, 38], [2050, 50], [2056, 66], [2064, 84], [2072, 96], [2078, 100], [2084, 100],
]

export function activeCityCount(year: number): number {
  const kf = CITY_COUNT_KEYFRAMES
  if (year <= kf[0][0]) return kf[0][1]
  for (let i = 1; i < kf.length; i++) {
    if (year <= kf[i][0]) {
      const [y0, c0] = kf[i - 1]
      const [y1, c1] = kf[i]
      const u = (year - y0) / (y1 - y0)
      return Math.min(MAX_CITIES, Math.max(1, Math.floor(c0 + (c1 - c0) * u)))
    }
  }
  return kf[kf.length - 1][1]
}

const cosTilt = Math.cos(EARTH_TILT)
const sinTilt = Math.sin(EARTH_TILT)

/** World-frame position of a city on the rotating, axially-tilted Earth
 * (matches the rendered globe: Rz(tilt) · Ry(spin) · latlon). */
export function stationWorldPos(st: GroundStation, t: number, out: Vec3): Vec3 {
  latLonToVec(st.latDeg, st.lonDeg, EARTH_RADIUS, out)
  const rot = earthRotation(t)
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const x1 = out[0] * c + out[2] * s
  const z1 = -out[0] * s + out[2] * c
  const y1 = out[1]
  out[0] = x1 * cosTilt - y1 * sinTilt
  out[1] = x1 * sinTilt + y1 * cosTilt
  out[2] = z1
  return out
}

const scratch: Vec3 = [0, 0, 0]

/** Line-of-sight: city sees the satellite when it is above the local horizon. */
export function stationVisible(st: GroundStation, satPos: Vec3, t: number): boolean {
  stationWorldPos(st, t, scratch)
  const dx = satPos[0] - scratch[0]
  const dy = satPos[1] - scratch[1]
  const dz = satPos[2] - scratch[2]
  return scratch[0] * dx + scratch[1] * dy + scratch[2] * dz > 0
}

export function slantRange(st: GroundStation, satPos: Vec3, t: number): number {
  stationWorldPos(st, t, scratch)
  return Math.hypot(satPos[0] - scratch[0], satPos[1] - scratch[1], satPos[2] - scratch[2])
}
