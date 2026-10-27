// backend/src/lib/otp.ts
// OTP generate, hash aur verify — DB mein kabhi plaintext OTP nahi jaata

import * as crypto from "crypto";

// Only 10^6 OTPs exist, so a plain SHA-256 is reversible offline; keying it with a server secret is not
const OTP_HASH_SECRET =
  process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || "dev-local-secret-key-minimum-32-characters";

export function generateOTP(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(phone: string, otp: string): string {
  return crypto.createHmac("sha256", OTP_HASH_SECRET).update(`${phone}:${otp}`).digest("hex");
}

export function otpMatches(storedHash: string | null | undefined, phone: string, otp: string): boolean {
  const expected = Buffer.from(hashOtp(phone, otp), "hex");
  const actual = Buffer.from(storedHash ?? "", "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
