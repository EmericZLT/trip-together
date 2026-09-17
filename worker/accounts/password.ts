const encoder = new TextEncoder();
export const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export const randomToken = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
export async function sha(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: encoder.encode(salt),
        iterations: 100000,
      },
      key,
      256,
    ),
  );
}
export function equal(a: string, b: string) {
  return (
    a.length === b.length &&
    crypto.subtle.timingSafeEqual(encoder.encode(a), encoder.encode(b))
  );
}
