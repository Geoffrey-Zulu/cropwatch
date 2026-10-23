// Photos are resized on the phone before upload. A 12-megapixel shot is 4–6 MB, slow and costly
// on 4G; 1600 px on the long edge is plenty for diagnosis and stays far under the 10 MB Storage
// rule.
const MAX_EDGE = 1600
const QUALITY = 0.82

export async function resizeToJpeg(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas not available')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      QUALITY
    )
  )
}
