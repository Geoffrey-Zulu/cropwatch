import type { Issue, VerifyRequest } from '@repo/shared'
import { API_BASE } from './apiBase'
import { auth } from './firebase'

// Officer verify through the frozen REST contract (POST /observations/{id}/verify): the same
// call the mobile app makes. A changed issue re-runs the recommendation and the cluster rule.
export async function verifyObservation(obsId: string, verifiedIssue: Issue, notes: string) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Not signed in')
  const body: VerifyRequest = { verified_issue: verifiedIssue, notes: notes || null }
  const response = await fetch(`${API_BASE}/api/v1/observations/${obsId}/verify`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Verify failed (HTTP ${response.status}): ${text.slice(0, 160)}`)
  }
  return response.json()
}
