const DEFAULT_API_BASE_URL = 'http://localhost:3001/api'

export function getApiBaseUrl(rawUrl = import.meta.env.VITE_API_BASE_URL): string {
  const baseUrl = (rawUrl || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '')

  if (/\/api$/i.test(baseUrl)) {
    return baseUrl
  }

  return `${baseUrl}/api`
}
