// Season dates and names, free of any API client: shared by the dashboard and the farmer app.

// "12 Jan 2027"
export const seasonDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

// "14:05", the time of day on the season calendar (real time of day; Lusaka is UTC+2).
export const seasonTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lusaka',
  })

export const firstName = (name: string) => name.split(' ')[0]
