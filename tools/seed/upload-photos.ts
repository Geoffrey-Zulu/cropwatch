// Upload the library photos for simulated reports (SIM_PHOTOS in packages/shared) to Storage at
// observations/sim-library/<id>/0.jpg. Each file is <id>.jpg in the folder given. The objects
// get a Firebase download token, so the dashboard's getDownloadURL works for Command Center
// roles (infra/storage.rules). Re-running overwrites. Dry run unless --commit.
//
//   pnpm --filter @repo/seed upload-photos --from <folder> [--commit]
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { SIM_PHOTOS, simPhotoPath } from '@repo/shared'
import { authHeaders } from '@repo/tools-gcp'

const args = process.argv.slice(2)
const from = resolve(process.env.INIT_CWD ?? process.cwd(), args[args.indexOf('--from') + 1] ?? '')
const commit = args.includes('--commit')
const BUCKET = 'crop-watch01.firebasestorage.app'

const missing = SIM_PHOTOS.filter(p => !existsSync(join(from, `${p.id}.jpg`)))
if (missing.length) throw new Error(`missing files: ${missing.map(p => `${p.id}.jpg`).join(', ')}`)
console.log(`${SIM_PHOTOS.length} photos in ${from}`)
if (!commit) {
  console.log('Dry run: nothing uploaded. Add --commit.')
  process.exit(0)
}

for (const photo of SIM_PHOTOS) {
  const name = simPhotoPath(photo.id)
  const boundary = `phytos-${randomUUID()}`
  const metadata = {
    name,
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=86400',
    metadata: { firebaseStorageDownloadTokens: randomUUID(), sim: 'true', credit: photo.author },
  }
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\ncontent-type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\ncontent-type: image/jpeg\r\n\r\n`
    ),
    readFileSync(join(from, `${photo.id}.jpg`)),
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const res = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=multipart`,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': `multipart/related; boundary=${boundary}` },
      body,
    }
  )
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`)
  console.log(`uploaded ${name}`)
}
