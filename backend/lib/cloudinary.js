import 'dotenv/config'
import crypto from 'node:crypto'
import { v2 as cloudinary } from 'cloudinary'

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET
} = process.env

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
})

const hasCloudinaryConfig = () => (
  !!CLOUDINARY_CLOUD_NAME &&
  !!CLOUDINARY_API_KEY &&
  !!CLOUDINARY_API_SECRET
)

const createSignature = (params) => {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return crypto
    .createHash('sha1')
    .update(`${serialized}${CLOUDINARY_API_SECRET}`)
    .digest('hex')
}

export async function uploadImageToCloudinary(dataUrl, options = {}) {
  if (!hasCloudinaryConfig()) {
    throw new Error('Cloudinary is not configured.')
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = options.folder || 'aakrity/uploads'
  const publicId = options.publicId || undefined
  const overwrite = options.overwrite === true

  const paramsToSign = {
    folder,
    overwrite: overwrite ? 'true' : undefined,
    public_id: publicId,
    timestamp
  }

  const signature = createSignature(paramsToSign)

  const formData = new FormData()
  formData.append('file', dataUrl)
  formData.append('api_key', CLOUDINARY_API_KEY)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)
  formData.append('folder', folder)
  if (overwrite) {
    formData.append('overwrite', 'true')
  }

  if (publicId) {
    formData.append('public_id', publicId)
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  )

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Failed to upload image.')
  }

  return payload.secure_url
}

export const deleteImageFromCloudinary = async (publicId) => {
  return cloudinary.uploader.destroy(publicId)
}

export const extractPublicIdFromCloudinaryUrl = (url) => {
  const matches = url.match(/\/v\d+\/(.+?)\./)
  return matches ? matches[1] : null
}