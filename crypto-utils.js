// Password hashing using the browser's built-in Web Crypto API (PBKDF2 + SHA-256).
// No external library, no server, no cost — works in every modern browser.

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

function generateSaltHex() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bufToHex(salt);
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBuf(saltHex),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bufToHex(derivedBits);
}

async function verifyPassword(password, saltHex, expectedHashHex) {
  const actualHashHex = await hashPassword(password, saltHex);
  return actualHashHex === expectedHashHex;
}
