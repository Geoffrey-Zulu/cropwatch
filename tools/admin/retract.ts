import { commit, PROJECT_ID, query, queryArrayContainsAny, type Write } from '@repo/tools-gcp'
import { CLUSTER_MIN_REPORTS } from '@repo/shared'

// E2E test reports are real API traffic in the demo district, so the API tracks them like any
// other report. On cleanup they must stop counting: marked retracted in BigQuery (the
// observations_latest view drops them) and taken out of any cluster built with them. A cluster
// left with fewer than five reports goes, with its alert; a seeded cluster that only gained
// test members keeps its id, so the next report does not see it as new and re-alert.
// District risk docs refresh with the next report, or when the seed re-arms the demo.
export async function retractTestReports(obsIds: string[]) {
  if (obsIds.length === 0) return { retracted: 0, clustersTrimmed: 0, removed: 0 }
  if (!obsIds.every(id => /^[A-Za-z0-9_-]{1,64}$/.test(id)))
    throw new Error('retractTestReports: unexpected observation id')
  const ids = obsIds.map(id => `'${id}'`).join(', ')
  const retracted = await query(
    `INSERT INTO \`${PROJECT_ID}.cropwatch.retracted_observations\` (obs_id, retracted_at, reason)
     SELECT id, CURRENT_TIMESTAMP(), 'e2e test report' FROM UNNEST([${ids}]) AS id`
  )

  const test = new Set(obsIds)
  const writes: Write[] = []
  const goneClusters = new Set<string>()
  let clustersTrimmed = 0
  for (const { path, data } of await queryArrayContainsAny('clusters', 'members', obsIds)) {
    const members = (data.members as string[]).filter(id => !test.has(id))
    if (members.length < CLUSTER_MIN_REPORTS) {
      goneClusters.add(path.split('/')[1])
      writes.push({ delete: path })
    } else {
      clustersTrimmed++
      writes.push({ patch: path, data: { members, size: members.length } })
    }
  }
  let removed = goneClusters.size
  for (const { path, data } of await queryArrayContainsAny('alerts', 'observation_ids', obsIds)) {
    const cluster = data.cluster_id as string | null
    // A cluster alert stays while its cluster does; any other alert a test report raised goes.
    if (cluster && !goneClusters.has(cluster)) continue
    removed++
    writes.push({ delete: `${path}/internal/dispatch` }, { delete: path })
  }
  await commit(writes)
  return { retracted, clustersTrimmed, removed }
}
