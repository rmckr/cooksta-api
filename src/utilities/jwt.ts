import jwt from 'jsonwebtoken'

const ACCESS_TOKEN_SECRET = 'cooksta-access-token-secret'
const REFRESH_TOKEN_SECRET = 'cooksta-refresh-token-secret'
export const ACCESS_TOKEN_EXPIRATION = '1d'
export const REFRESH_TOKEN_EXPIRATION = '30d'

export type UserJWT = { id: string }

export function generateAccessToken(payload: UserJWT) {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION })
}

export function generateRefreshToken(payload: UserJWT) {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION })
}

function verifyToken(token: string, secret: string): UserJWT | null {
  try {
    const decodedToken = jwt.verify(token, secret)
    if (typeof decodedToken === 'object' && 'id' in decodedToken) {
      return { id: decodedToken.id as string }
    }
    return null
  } catch {
    return null
  }
}

export function verifyAccessToken(token: string) {
  return verifyToken(token, ACCESS_TOKEN_SECRET)
}

export function verifyRefreshToken(token: string) {
  return verifyToken(token, REFRESH_TOKEN_SECRET)
}
