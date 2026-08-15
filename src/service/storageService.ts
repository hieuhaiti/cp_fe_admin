import apiClient from './common/apiClient'

export type StorageCategory = 'layers' | 'raster' | 'documents' | 'field-photos'

interface PresignedUpload {
  uploadUrl: string
  id: number | string
}

/**
 * Upload a browser File using the storage handshake in the Postman collection:
 * presign -> PUT the bytes to the presigned URL -> commit the object.
 */
async function upload(file: File, category: StorageCategory): Promise<number | string> {
  const presign = await apiClient.post<PresignedUpload>('/storage/uploads/presign', {
    category,
    originalName: file.name,
    contentType: file.type || 'application/octet-stream',
    expireSeconds: 900,
  })
  const { uploadUrl, id } = presign.data ?? {}

  if (!uploadUrl || id === undefined || id === null) {
    throw new Error('Máy chủ không trả về URL tải tệp hoặc mã đối tượng lưu trữ.')
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: file.type ? { 'Content-Type': file.type } : undefined,
    body: file,
  })
  if (!uploadResponse.ok) {
    throw new Error(`Tải tệp lên thất bại (${uploadResponse.status}).`)
  }

  await apiClient.post(`/storage/uploads/${encodeURIComponent(String(id))}/commit`)
  return id
}

export default { upload }
