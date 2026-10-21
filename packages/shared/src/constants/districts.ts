import type { Province } from './provinces'

// Major districts for demo scope: not exhaustive (Zambia has 116). Any other district name
// is still accepted and normalised by districtSlug(); this list gives the app its picker
// and the server its canonical names. Extend by appending only.
const BY_PROVINCE: Record<Province, string[]> = {
  Central: ['Kabwe', 'Kapiri Mposhi', 'Mkushi', 'Serenje', 'Mumbwa', 'Chibombo', 'Chisamba'],
  Copperbelt: [
    'Ndola',
    'Kitwe',
    'Chingola',
    'Mufulira',
    'Luanshya',
    'Kalulushi',
    'Chililabombwe',
    'Masaiti',
    'Mpongwe',
    'Lufwanyama',
  ],
  Eastern: [
    'Chipata',
    'Katete',
    'Lundazi',
    'Petauke',
    'Nyimba',
    'Chadiza',
    'Mambwe',
    'Sinda',
    'Vubwi',
  ],
  Luapula: ['Mansa', 'Kawambwa', 'Nchelenge', 'Samfya', 'Mwense'],
  Lusaka: ['Lusaka', 'Chongwe', 'Kafue', 'Luangwa', 'Chilanga', 'Rufunsa'],
  Muchinga: ['Chinsali', 'Mpika', 'Nakonde', 'Isoka', 'Chama'],
  Northern: ['Kasama', 'Mbala', 'Mporokoso', 'Mungwi', 'Luwingu', 'Kaputa', 'Mpulungu'],
  'North-Western': [
    'Solwezi',
    'Kasempa',
    'Mwinilunga',
    'Zambezi',
    'Kabompo',
    'Chavuma',
    'Mufumbwe',
  ],
  Southern: [
    'Livingstone',
    'Choma',
    'Mazabuka',
    'Monze',
    'Kalomo',
    'Namwala',
    'Gwembe',
    'Siavonga',
    'Sinazongwe',
    'Kazungula',
  ],
  Western: ['Mongu', 'Kaoma', 'Senanga', 'Sesheke', 'Kalabo', 'Lukulu'],
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
}

export const DISTRICTS: District[] = Object.entries(BY_PROVINCE).flatMap(([province, names]) =>
  names.map(name => ({ name, slug: districtSlug(name), province: province as Province }))
)

const BY_SLUG = new Map(DISTRICTS.map(d => [d.slug, d]))

// The known district for a name or slug, or undefined for one outside the list.
export function findDistrict(nameOrSlug: string): District | undefined {
  return BY_SLUG.get(districtSlug(nameOrSlug))
}
