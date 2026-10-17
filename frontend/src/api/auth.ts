import { apiRequest } from './client'
import type { AuthResponse, User } from './types'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export const authApi = {
  login(input: LoginInput) {
    return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false })
  },
  register(input: RegisterInput) {
    return apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input, auth: false })
  },
  async me(): Promise<User> {
    const result = await apiRequest<{ user: User }>('/auth/me')
    return result.user
  },
  logout(refreshToken: string) {
    return apiRequest<{ success: true }>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    })
  },
}
