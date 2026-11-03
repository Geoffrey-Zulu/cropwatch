import type { Issue } from './issues'

// Library photos for simulated reports (seed realism pass, 30 Oct): openly licensed field
// photos from Wikimedia Commons, one per simulated report, matching the issue the report really
// has. They are not the farm's own photo, so the dashboard always says so and credits the
// author and licence. Uploaded once to Storage by `pnpm --filter @repo/seed upload-photos`.
export interface SimPhoto {
  id: string
  issue: Issue
  author: string
  licence: string
  licence_url: string | null
  page_url: string
}

export const SIM_PHOTO_ROOT = 'observations/sim-library'

// Matches PHOTO_PATH_PATTERN: the id stands in for the report id (16 to 64 characters).
export const simPhotoPath = (id: string) => `${SIM_PHOTO_ROOT}/${id}/0.jpg`

// Chosen and checked by eye on 30 Oct: CC0, public domain, CC BY or CC BY-SA only. Bugwood photos
// had their ID stamp cropped, and two panels were cropped from a figure; the licence notes it.
export const SIM_PHOTOS: SimPhoto[] = [
  {
    id: 'library-fall_armyworm-01',
    issue: 'fall_armyworm',
    author: 'Wee Hong',
    licence: 'CC BY-SA 4.0',
    licence_url: 'https://creativecommons.org/licenses/by-sa/4.0',
    page_url:
      'https://commons.wikimedia.org/wiki/File:Zea_mays_damaged_by_Spodoptera_frugiperda_(200218-0814).jpg',
  },
  {
    id: 'library-fall_armyworm-02',
    issue: 'fall_armyworm',
    author: 'Ernani Zimmermann',
    licence: 'CC BY-SA 4.0',
    licence_url: 'https://creativecommons.org/licenses/by-sa/4.0',
    page_url: 'https://commons.wikimedia.org/wiki/File:Ataque_por_lagarta_01.jpg',
  },
  {
    id: 'library-fall_armyworm-03',
    issue: 'fall_armyworm',
    author: 'Ernani Zimmermann',
    licence: 'CC BY-SA 4.0',
    licence_url: 'https://creativecommons.org/licenses/by-sa/4.0',
    page_url: 'https://commons.wikimedia.org/wiki/File:Ataque_por_lagarta_03.jpg',
  },
  {
    id: 'library-fall_armyworm-04',
    issue: 'fall_armyworm',
    author: 'Ernani Zimmermann',
    licence: 'CC BY-SA 4.0',
    licence_url: 'https://creativecommons.org/licenses/by-sa/4.0',
    page_url: 'https://commons.wikimedia.org/wiki/File:Lagarta_do_Cartucho_03.jpg',
  },
  {
    id: 'library-fall_armyworm-05',
    issue: 'fall_armyworm',
    author: 'Ernani Zimmermann',
    licence: 'CC BY-SA 4.0',
    licence_url: 'https://creativecommons.org/licenses/by-sa/4.0',
    page_url: 'https://commons.wikimedia.org/wiki/File:Lagarta_do_Cartucho_02.jpg',
  },
  {
    id: 'library-tuta_absoluta-01',
    issue: 'tuta_absoluta',
    author: 'Henry Van T. Cotter',
    licence: 'CC BY 4.0',
    licence_url: 'https://creativecommons.org/licenses/by/4.0',
    page_url: 'https://commons.wikimedia.org/wiki/File:Tuta_absoluta_43651829.jpg',
  },
  {
    id: 'library-late_blight-01',
    issue: 'late_blight',
    author: 'Scot Nelson',
    licence: 'CC0',
    licence_url: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
    page_url:
      'https://commons.wikimedia.org/wiki/File:Tomato_late_blight_leaf_sporulating_lesions_1_(5816170621).jpg',
  },
  {
    id: 'library-late_blight-02',
    issue: 'late_blight',
    author: 'Dwight Sipler',
    licence: 'CC BY 2.0',
    licence_url: 'https://creativecommons.org/licenses/by/2.0',
    page_url: 'https://commons.wikimedia.org/wiki/File:Late_blight_on_tomato_leaf_(7871756748).jpg',
  },
  {
    id: 'library-late_blight-03',
    issue: 'late_blight',
    author: 'Schneebiene',
    licence: 'CC0',
    licence_url: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
    page_url:
      'https://commons.wikimedia.org/wiki/File:Unreife_Tomaten_mit_Kraut-_und_Braunf%C3%A4ule.jpg',
  },
  {
    id: 'library-late_blight-04',
    issue: 'late_blight',
    author: 'Natalka Ukraine',
    licence: 'CC BY 4.0',
    licence_url: 'https://creativecommons.org/licenses/by/4.0',
    page_url:
      'https://commons.wikimedia.org/wiki/File:Phytophthora_infestans_on_Solanum_lycopersicum_in_Dnipro_by_baby-bear.org.jpg',
  },
  {
    id: 'library-late_blight-05',
    issue: 'late_blight',
    author: 'Goldlocki',
    licence: 'CC BY-SA 3.0',
    licence_url: 'http://creativecommons.org/licenses/by-sa/3.0/',
    page_url:
      'https://commons.wikimedia.org/wiki/File:TomateTrossKrautundBraunf%C3%A4ulePhytophtorainfestans.jpg',
  },
  {
    id: 'library-early_blight-01',
    issue: 'early_blight',
    author: 'Jerzy Opioła',
    licence: 'CC BY-SA 4.0',
    licence_url: 'https://creativecommons.org/licenses/by-sa/4.0',
    page_url: 'https://commons.wikimedia.org/wiki/File:Alternaria_solani_a1_(2).jpg',
  },
  {
    id: 'library-early_blight-02',
    issue: 'early_blight',
    author: 'Dwight Sipler',
    licence: 'CC BY 2.0',
    licence_url: 'https://creativecommons.org/licenses/by/2.0',
    page_url:
      'https://commons.wikimedia.org/wiki/File:Early_blight_on_tomato_leaves_(7871930010).jpg',
  },
  {
    id: 'library-diamondback_moth-01',
    issue: 'diamondback_moth',
    author: 'Fk (Wikimedia Commons user)',
    licence: 'CC BY-SA 2.5',
    licence_url: 'https://creativecommons.org/licenses/by-sa/2.5',
    page_url: 'https://commons.wikimedia.org/wiki/File:Plutella_xylostella_Juvenile.jpg',
  },
  {
    id: 'library-cassava_brown_streak-01',
    issue: 'cassava_brown_streak',
    author: 'Phillip Abidrabo',
    licence: 'CC BY-SA 3.0',
    licence_url: 'https://creativecommons.org/licenses/by-sa/3.0',
    page_url:
      'https://commons.wikimedia.org/wiki/File:Distribution_of_cassava_brown_streak_disease_(CBSD)_symptoms_on_cassava.JPG',
  },
  {
    id: 'library-unknown-01',
    issue: 'unknown',
    author: 'Alandmanson',
    licence: 'CC BY-SA 4.0',
    licence_url: 'https://creativecommons.org/licenses/by-sa/4.0',
    page_url:
      'https://commons.wikimedia.org/wiki/File:K-deficient_soyabean_Cedara_2013_02_08_08_22_39_7474.jpg',
  },
  {
    id: 'library-unknown-02',
    issue: 'unknown',
    author: 'Alandmanson',
    licence: 'CC BY-SA 4.0',
    licence_url: 'https://creativecommons.org/licenses/by-sa/4.0',
    page_url:
      'https://commons.wikimedia.org/wiki/File:K-deficient_soyabean_Cedara_2013_02_08_08_24_24_7488.jpg',
  },
  {
    id: 'library-unknown-03',
    issue: 'unknown',
    author: 'Ron Nichols, USDA NRCS',
    licence: 'Public domain',
    licence_url: null,
    page_url:
      'https://commons.wikimedia.org/wiki/File:NRCSUT03013_-_Arkansas_(6397)(NRCS_Photo_Gallery).jpg',
  },
  {
    id: 'library-tuta_absoluta-02',
    issue: 'tuta_absoluta',
    author: 'Metin GULESCI, Leaf Tobacco, Bugwood.org',
    licence: 'CC BY 3.0 US, cropped',
    licence_url: 'https://creativecommons.org/licenses/by/3.0/us/deed.en',
    page_url: 'https://commons.wikimedia.org/wiki/File%3ATuta_absoluta_Tomato_loss.jpg',
  },
  {
    id: 'library-tuta_absoluta-03',
    issue: 'tuta_absoluta',
    author: 'Maneno Chidege et al.',
    licence: 'CC BY 4.0, one panel cropped',
    licence_url: 'https://creativecommons.org/licenses/by/4.0',
    page_url: 'https://commons.wikimedia.org/wiki/File%3ATomatoes_damaged_by_Tuta_absoluta.jpg',
  },
  {
    id: 'library-tuta_absoluta-04',
    issue: 'tuta_absoluta',
    author: 'Maneno Chidege et al.',
    licence: 'CC BY 4.0, one panel cropped',
    licence_url: 'https://creativecommons.org/licenses/by/4.0',
    page_url: 'https://commons.wikimedia.org/wiki/File%3ATomatoes_damaged_by_Tuta_absoluta.jpg',
  },
  {
    id: 'library-diamondback_moth-02',
    issue: 'diamondback_moth',
    author: 'Whitney Cranshaw, Colorado State University, Bugwood.org',
    licence: 'CC BY 3.0 US, cropped',
    licence_url: 'https://creativecommons.org/licenses/by/3.0/us/deed.en',
    page_url:
      'https://commons.wikimedia.org/wiki/File%3APlutella_xylostella_caterpillar_on_cabbage_%2801%29.jpg',
  },
  {
    id: 'library-diamondback_moth-03',
    issue: 'diamondback_moth',
    author: 'Alton N. Sparks, Jr., University of Georgia, Bugwood.org',
    licence: 'CC BY 3.0 US, cropped',
    licence_url: 'https://creativecommons.org/licenses/by/3.0/us/deed.en',
    page_url:
      'https://commons.wikimedia.org/wiki/File%3APlutella_xylostella_caterpillar_on_cabbage_%2802%29.jpg',
  },
  {
    id: 'library-diamondback_moth-04',
    issue: 'diamondback_moth',
    author: 'Alton N. Sparks, Jr., University of Georgia, Bugwood.org',
    licence: 'CC BY 3.0 US, cropped',
    licence_url: 'https://creativecommons.org/licenses/by/3.0/us/deed.en',
    page_url:
      'https://commons.wikimedia.org/wiki/File%3APlutella_xylostella_caterpillar_on_cabbage_%2810%29.jpg',
  },
  {
    id: 'library-diamondback_moth-05',
    issue: 'diamondback_moth',
    author: 'Alton N. Sparks, Jr., University of Georgia, Bugwood.org',
    licence: 'CC BY 3.0 US, cropped',
    licence_url: 'https://creativecommons.org/licenses/by/3.0/us/deed.en',
    page_url:
      'https://commons.wikimedia.org/wiki/File%3APlutella_xylostella_on_Brassica_oleracea_%2801%29.jpg',
  },
  {
    id: 'library-early_blight-03',
    issue: 'early_blight',
    author: 'Clemson University - USDA Cooperative Extension Slide Series',
    licence: 'CC BY 3.0 US, cropped',
    licence_url: 'https://creativecommons.org/licenses/by/3.0/us/deed.en',
    page_url: 'https://commons.wikimedia.org/wiki/File%3AAlternaria_solani_-_leaf_lesions.jpg',
  },
]

const byPath = new Map(SIM_PHOTOS.map(p => [simPhotoPath(p.id), p]))
export const simPhotoFor = (path: string) => byPath.get(path) ?? null
