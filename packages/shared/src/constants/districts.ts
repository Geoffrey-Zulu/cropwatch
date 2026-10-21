import type { Province } from './provinces'

// Major districts for demo scope: not exhaustive (Zambia has 116). Any other district name
// is still accepted and normalised by districtSlug(); this list gives the app its picker, the
// server its canonical names, and maps their placement. Extend by appending only.
//
// Coordinates are approximate district towns (±~20 km): for placing simulated data and
// district-level aggregates on a map, never as a farm location.
type Entry = [name: string, latitude: number, longitude: number]

const BY_PROVINCE: Record<Province, Entry[]> = {
  Central: [
    ['Kabwe', -14.44, 28.45],
    ['Kapiri Mposhi', -13.97, 28.67],
    ['Mkushi', -13.62, 29.39],
    ['Serenje', -13.23, 30.24],
    ['Mumbwa', -14.98, 27.06],
    ['Chibombo', -14.66, 28.09],
    ['Chisamba', -14.98, 28.38],
  ],
  Copperbelt: [
    ['Ndola', -12.97, 28.64],
    ['Kitwe', -12.8, 28.21],
    ['Chingola', -12.53, 27.85],
    ['Mufulira', -12.55, 28.24],
    ['Luanshya', -13.14, 28.41],
    ['Kalulushi', -12.84, 28.09],
    ['Chililabombwe', -12.37, 27.83],
    ['Masaiti', -13.27, 28.46],
    ['Mpongwe', -13.51, 28.15],
    ['Lufwanyama', -12.95, 27.65],
  ],
  Eastern: [
    ['Chipata', -13.63, 32.65],
    ['Katete', -14.06, 32.05],
    ['Lundazi', -12.29, 33.17],
    ['Petauke', -14.25, 31.32],
    ['Nyimba', -14.55, 30.81],
    ['Chadiza', -14.07, 32.44],
    ['Mambwe', -13.12, 31.78],
    ['Sinda', -14.21, 31.76],
    ['Vubwi', -14.07, 32.83],
  ],
  Luapula: [
    ['Mansa', -11.2, 28.89],
    ['Kawambwa', -9.79, 29.08],
    ['Nchelenge', -9.35, 28.73],
    ['Samfya', -11.36, 29.56],
    ['Mwense', -10.38, 28.7],
  ],
  Lusaka: [
    ['Lusaka', -15.42, 28.28],
    ['Chongwe', -15.33, 28.68],
    ['Kafue', -15.77, 28.18],
    ['Luangwa', -15.62, 30.41],
    ['Chilanga', -15.56, 28.27],
    ['Rufunsa', -15.08, 29.63],
  ],
  Muchinga: [
    ['Chinsali', -10.55, 32.07],
    ['Mpika', -11.83, 31.45],
    ['Nakonde', -9.33, 32.75],
    ['Isoka', -10.16, 32.63],
    ['Chama', -11.22, 33.16],
  ],
  Northern: [
    ['Kasama', -10.21, 31.18],
    ['Mbala', -8.84, 31.37],
    ['Mporokoso', -9.37, 30.12],
    ['Mungwi', -10.17, 31.37],
    ['Luwingu', -10.26, 29.92],
    ['Kaputa', -8.47, 29.66],
    ['Mpulungu', -8.76, 31.11],
  ],
  'North-Western': [
    ['Solwezi', -12.18, 26.4],
    ['Kasempa', -13.46, 25.83],
    ['Mwinilunga', -11.74, 24.43],
    ['Zambezi', -13.55, 23.11],
    ['Kabompo', -13.59, 24.2],
    ['Chavuma', -13.08, 22.68],
    ['Mufumbwe', -13.68, 24.8],
  ],
  Southern: [
    ['Livingstone', -17.85, 25.86],
    ['Choma', -16.81, 26.98],
    ['Mazabuka', -15.86, 27.75],
    ['Monze', -16.28, 27.48],
    ['Kalomo', -17.03, 26.49],
    ['Namwala', -15.75, 26.44],
    ['Gwembe', -16.5, 27.6],
    ['Siavonga', -16.54, 28.71],
    ['Sinazongwe', -17.26, 27.46],
    ['Kazungula', -17.78, 25.27],
  ],
  Western: [
    ['Mongu', -15.25, 23.13],
    ['Kaoma', -14.8, 24.8],
    ['Senanga', -16.12, 23.27],
    ['Sesheke', -17.47, 24.3],
    ['Kalabo', -14.99, 22.68],
    ['Lukulu', -14.38, 23.24],
  ],
}

// The aggregation key for clusters, alerts and FCM topics: lowercase, a trailing
// " district" dropped, runs of anything else replaced by "-". Idempotent on slugs.
// "Kapiri Mposhi" → "kapiri-mposhi", "Chongwe District" → "chongwe".
export function districtSlug(district: string) {
  return district
    .trim()
    .toLowerCase()
    .replace(/\s+district$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const DISTRICT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface District {
  name: string
  slug: string
  province: Province
  // Approximate district town; see the note above.
  center: { latitude: number; longitude: number }
}

export const DISTRICTS: District[] = Object.entries(BY_PROVINCE).flatMap(([province, entries]) =>
  entries.map(([name, latitude, longitude]) => ({
    name,
    slug: districtSlug(name),
    province: province as Province,
    center: { latitude, longitude },
  }))
)

const BY_SLUG = new Map(DISTRICTS.map(d => [d.slug, d]))

// The known district for a name or slug, or undefined for one outside the list.
export function findDistrict(nameOrSlug: string): District | undefined {
  return BY_SLUG.get(districtSlug(nameOrSlug))
}
