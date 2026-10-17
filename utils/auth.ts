/**
 * Utilidades de autenticación y hash de contraseñas usando Web Crypto API (SHA-256).
 */
export async function hashPassword(password: string): Promise<string> {
  const normalized = password.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, storedHash?: string | null): Promise<boolean> {
  if (!storedHash) {
    // Usuario heredado sin password_hash configurado aún
    return true;
  }
  const computed = await hashPassword(password);
  return computed === storedHash || password.trim() === storedHash;
}
