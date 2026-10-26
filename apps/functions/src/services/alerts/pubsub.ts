import { GoogleAuth } from 'google-auth-library'

// Publishes {alert_id} to the alerts topic; a push subscription delivers it back to this service
// (/internal/events/alerts), so dispatch retries independently of the report that raised it.
export function pubsubPublisher(
  { projectId, topic }: { projectId: string; topic: string },
  auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' })
) {
  return async (alertId: string) => {
    const client = await auth.getClient()
    await client.request({
      url: `https://pubsub.googleapis.com/v1/projects/${projectId}/topics/${topic}:publish`,
      method: 'POST',
      data: {
        messages: [{ data: Buffer.from(JSON.stringify({ alert_id: alertId })).toString('base64') }],
      },
      timeout: 10_000,
    })
  }
}
