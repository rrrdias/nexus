import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"

const HASH_PREFIX = "scrypt"
const HASH_VERSION = "1"
const KEY_LENGTH = 64
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
}

export function isPasswordHash(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(`${HASH_PREFIX}$${HASH_VERSION}$`)
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url")
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)

  return [
    HASH_PREFIX,
    HASH_VERSION,
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt,
    derivedKey.toString("base64url"),
  ].join("$")
}

export async function verifyPassword(password: string, storedPassword: string | null | undefined) {
  if (!storedPassword) return false

  if (!isPasswordHash(storedPassword)) {
    return timingSafeStringEqual(password, storedPassword)
  }

  const [, version, n, r, p, salt, hash] = storedPassword.split("$")
  if (version !== HASH_VERSION || !n || !r || !p || !salt || !hash) return false

  const expected = Buffer.from(hash, "base64url")
  const derivedKey = await scryptAsync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_OPTIONS.maxmem,
  })

  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey)
}

function timingSafeStringEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)

  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer)
}

function scryptAsync(
  password: string,
  salt: string,
  keyLength: number,
  options: typeof SCRYPT_OPTIONS,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error)
        return
      }

      resolve(derivedKey)
    })
  })
}
