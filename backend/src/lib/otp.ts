// backend/src/lib/otp.ts
// OTP generate, hash aur verify — DB mein kabhi plaintext OTP nahi jaata
//
// Default (OTP_MODE=phone_last4): OTP = phone ke last 4 digits.
// Live SMS ke liye OTP_MODE=fast2sms + FAST2SMS_API_KEY set karo.

import * as crypto from "crypto";

const OTP_HASH_SECRET =
  process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || "dev-local-secret-key-minimum-32-characters";

export function isPhoneLast4OtpMode(): boolean {
  const mode = (process.env.OTP_MODE || "phone_last4").toLowerCase().trim();
  // Explicit live SMS only when asked — otherwise last-4 stays on (even in production).
  return mode !== "fast2sms" && mode !== "live";
}

export function expectedOtpLength(): number {
  return isPhoneLast4OtpMode() ? 4 : 6;
}

/** Last 4 digits of phone, or random 6-digit when OTP_MODE=fast2sms. */
export function generateOTP(phone?: string): string {
  if (isPhoneLast4OtpMode()) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 4) {
      throw new Error("Phone number too short to derive OTP");
    }
    return digits.slice(-4);
  }
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
