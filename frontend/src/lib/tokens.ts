// El access token vive solo en memoria (nunca en localStorage): al recargar la
// pagina se recupera con el refresh token, que viaja en una cookie HttpOnly.
let accessToken: string | null = null

export const tokenStore = {
  getAccess(): string | null {
    return accessToken
  },
  setAccess(token: string): void {
    accessToken = token
  },
  clear(): void {
    accessToken = null
  },
}
