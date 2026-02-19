import axios, { AxiosInstance, AxiosError } from 'axios'
import type { ApiResponse } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

/**
 * Parsed error structure matching the backend standardized format.
 */
export interface ApiErrorDetail {
  code: string
  message: string
  recovery: string
  details?: unknown
}

/**
 * Extract a user-friendly error message from an Axios error,
 * understanding the backend's standardized error envelope.
 */
function parseApiError(error: AxiosError<Record<string, unknown>>): {
  message: string
  detail?: ApiErrorDetail
} {
  const data = error.response?.data as Record<string, unknown> | undefined

  // Backend returns { success: false, error: { code, message, recovery } }
  if (data?.error && typeof data.error === 'object') {
    const errObj = data.error as Record<string, unknown>
    if (errObj.code) {
      return {
        message: String(errObj.message || 'An error occurred'),
        detail: errObj as unknown as ApiErrorDetail,
      }
    }
  }

  // Legacy format: { error: "string" }
  if (typeof data?.error === 'string') {
    return { message: data.error }
  }

  // Network / timeout errors
  if (error.code === 'ECONNABORTED') {
    return {
      message: 'Request timed out. Please check your connection and try again.',
    }
  }
  if (!error.response) {
    return {
      message: 'Unable to reach the server. Please check your connection.',
    }
  }

  return { message: error.message || 'An error occurred' }
}

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor for adding auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor for handling errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken')
          window.location.href = '/'
        }
        return Promise.reject(error)
      }
    )
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<ApiResponse<T>>(url, { params })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch<ApiResponse<T>>(url, data)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  private handleError(error: unknown): ApiResponse<never> {
    if (axios.isAxiosError(error)) {
      const { message, detail } = parseApiError(error)
      return {
        success: false,
        error: message,
        message: detail?.recovery,
      }
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

export const apiClient = new ApiClient()
