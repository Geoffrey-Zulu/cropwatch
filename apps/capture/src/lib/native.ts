import { Capacitor } from '@capacitor/core'

export const isNativeApp = () => Capacitor.isNativePlatform()

export async function nativePhoto(source: 'camera' | 'photos'): Promise<File> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  const photo = await Camera.getPhoto({
    source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    resultType: CameraResultType.Uri,
    quality: 85,
    width: 1600,
    correctOrientation: true,
    saveToGallery: false,
  })
  if (!photo.webPath) throw new Error('The selected photo could not be opened')
  const response = await fetch(photo.webPath)
  if (!response.ok) throw new Error('The selected photo could not be read')
  const blob = await response.blob()
  return new File([blob], `crop.${photo.format}`, { type: blob.type || `image/${photo.format}` })
}

export async function nativePosition(timeout: number) {
  const { Geolocation } = await import('@capacitor/geolocation')
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout,
    maximumAge: 60_000,
  })
  return { latitude: position.coords.latitude, longitude: position.coords.longitude }
}
