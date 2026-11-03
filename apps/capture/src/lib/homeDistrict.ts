// The district this phone last reported from: the default for the next report and for area
// alerts until the farmer's reports load.
const KEY = 'cropwatch.district'

export function readHomeDistrict() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveHomeDistrict(district: string) {
  try {
    localStorage.setItem(KEY, district)
  } catch {
    // Private mode or storage blocked: the picker simply starts empty next time.
  }
}
