import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FieldEvidence as Evidence, FieldRecord } from '@repo/shared'
import { FieldEvidence } from './FieldEvidence'
import { fieldApi } from '../lib/fieldApi'
vi.mock('../lib/fieldApi', () => ({
  fieldApi: { list: vi.fn(), context: vi.fn(), report: vi.fn(), create: vi.fn(), refresh: vi.fn() },
}))
const regional: Evidence = {
  field_id: null,
  scope: 'regional',
  retrieved_at: '2026-11-01T00:00:00Z',
  catalogue_source: 'Sentinel-2 L2A / Earth Search',
  catalogue_status: 'ok',
  vegetation_source: 'Copernicus Sentinel Hub Statistical API',
  vegetation_status: 'not_configured',
  readings: [],
  review_status: 'officer_review_required',
  scenes: [
    {
      id: 'real-scene',
      acquired_at: '2026-10-30T08:00:00Z',
      scene_cloud_pct: 35,
      preview_url: null,
    },
  ],
}
const field: FieldRecord = {
  id: 'own-field',
  name: 'North plot',
  crop: 'soybean',
  season: '2026/27',
  planting_date: null,
  capture_method: 'imported',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [27.48, -16.28],
        [27.482, -16.28],
        [27.482, -16.278],
        [27.48, -16.278],
        [27.48, -16.28],
      ],
    ],
  },
  area_ha: 4.75,
  boundary_status: 'claimed',
  created_at: '2026-11-01T00:00:00Z',
}
beforeEach(() => {
  localStorage.clear()
  vi.mocked(fieldApi.list).mockResolvedValue([])
  vi.mocked(fieldApi.context).mockResolvedValue(regional)
  vi.mocked(fieldApi.report).mockResolvedValue(null)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.resetAllMocks()
})
it('shows actual regional acquisition dates and keeps scene cloud cover separate from field verification', async () => {
  render(<FieldEvidence uid="user" onExample={vi.fn()} />)
  expect(await screen.findByText('30 Oct 2026')).toBeInTheDocument()
  expect(screen.getByText('35.0% scene cloud cover')).toBeInTheDocument()
  expect(screen.getByText('Not a farm')).toBeInTheDocument()
  expect(screen.queryByText('Field vegetation index')).not.toBeInTheDocument()
})
it('shows missing NDVI processing honestly and keeps officer review required', async () => {
  vi.mocked(fieldApi.list).mockResolvedValue([field])
  vi.mocked(fieldApi.report).mockResolvedValue({ ...regional, field_id: field.id, scope: 'field' })
  render(<FieldEvidence uid="user" onExample={vi.fn()} />)
  expect(
    await screen.findByText(/Field-level NDVI processing is not connected/)
  ).toBeInTheDocument()
  expect(screen.getByText('Officer review required')).toBeInTheDocument()
  expect(screen.queryByText('0.00')).not.toBeInTheDocument()
})
it('saves an explicitly imported polygon as a claimed field, not a town-centre pin', async () => {
  vi.mocked(fieldApi.create).mockResolvedValue(field)
  render(<FieldEvidence uid="user" onExample={vi.fn()} />)
  await screen.findByText('30 Oct 2026')
  fireEvent.click(screen.getByRole('button', { name: 'Register your field' }))
  fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'North plot' } })
  fireEvent.click(screen.getByText('Import a GeoJSON boundary instead'))
  fireEvent.change(
    screen.getByLabelText('Polygon or Feature, coordinates in longitude, latitude'),
    { target: { value: JSON.stringify(field.geometry) } }
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save field boundary' }))
  await waitFor(() =>
    expect(fieldApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'North plot',
        capture_method: 'imported',
        geometry: field.geometry,
      })
    )
  )
  expect(await screen.findByText('Unattested')).toBeInTheDocument()
})

it('does not treat vegetation before planting as verification of the current crop', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-01T00:00:00Z'))
  vi.mocked(fieldApi.list).mockResolvedValue([{ ...field, planting_date: '2026-10-25' }])
  vi.mocked(fieldApi.report).mockResolvedValue({
    ...regional,
    field_id: field.id,
    scope: 'field',
    vegetation_status: 'ok',
    readings: [
      {
        from: '2026-10-20T00:00:00Z',
        to: '2026-10-24T00:00:00Z',
        ndvi: 0.65,
        valid_pixel_pct: 90,
        valid_pixels: 100,
      },
    ],
  })
  render(<FieldEvidence uid="user" onExample={vi.fn()} />)
  expect(await screen.findByText(/vegetation interval predates planting/)).toBeInTheDocument()
  expect(screen.getByText('Officer review required')).toBeInTheDocument()
})
