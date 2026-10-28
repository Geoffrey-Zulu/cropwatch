import { describe, it, expect } from 'vitest'
import { weatherConditions, weatherFactor, type DailyWeather, type WeatherWindow } from './weather'

const day = (date: string, over: Partial<DailyWeather> = {}): DailyWeather => ({
  date,
  tmean: 20,
  tmax: 26,
  tmin: 14,
  rain: 0,
  humidity: 50,
  ...over,
})

const window = (past: Partial<DailyWeather>, forecast: Partial<DailyWeather>, month = '10') => {
  const w: WeatherWindow = {
    past: Array.from({ length: 14 }, (_, i) =>
      day(`2026-${month}-${String(i + 1).padStart(2, '0')}`, past)
    ),
    forecast: Array.from({ length: 14 }, (_, i) =>
      day(`2026-${month}-${String(i + 15).padStart(2, '0')}`, forecast)
    ),
    fetched_at: `2026-${month}-15T06:00:00.000Z`,
  }
  return w
}

const find = (w: WeatherWindow, issue: string) => weatherConditions(w).find(c => c.issue === issue)!

describe('weather conditions', () => {
  it('flags the late dry season for Tuta absoluta only from August to November with little rain', () => {
    expect(find(window({ rain: 0 }, {}), 'tuta_absoluta').favourable).toBe(true)
    expect(find(window({ rain: 1 }, {}), 'tuta_absoluta').favourable).toBe(false)
    expect(find(window({ rain: 0 }, {}, '03'), 'tuta_absoluta').favourable).toBe(false)
  })

  it('flags warm days for fall armyworm and humid days for late blight', () => {
    expect(find(window({}, { tmean: 27 }), 'fall_armyworm').favourable).toBe(true)
    expect(find(window({}, { tmean: 33 }), 'fall_armyworm').favourable).toBe(false)
    expect(find(window({}, { humidity: 90 }), 'late_blight').favourable).toBe(true)
    expect(find(window({}, { humidity: 70 }), 'late_blight').favourable).toBe(false)
  })

  it('flags heavy rain for early blight and says when it fell', () => {
    const w = window({}, {})
    w.past[10].rain = 32
    const c = find(w, 'early_blight')
    expect(c.favourable).toBe(true)
    expect(c.observed).toBe('heaviest rain 32 mm on 11 Oct')
  })

  it('treats missing days as not meeting the rule', () => {
    expect(find(window({}, { humidity: null, tmean: null }), 'late_blight').favourable).toBe(false)
    expect(find(window({}, { humidity: null, tmean: null }), 'fall_armyworm').favourable).toBe(
      false
    )
  })

  it('writes factors that name the source and the guide, never odds, never an em dash', () => {
    const text = weatherFactor(find(window({ rain: 0 }, {}), 'tuta_absoluta'))
    expect(text).toBe(
      'Weather (Open-Meteo): 0 mm of rain in the last 14 days. Guide note: avoid growing tomato in the late dry season (Tuta absoluta management manual (icipe, 2020)).'
    )
    expect(text).not.toMatch(/probab|likel|chance|—/i)
  })
})
