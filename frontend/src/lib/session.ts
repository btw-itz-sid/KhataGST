const TOKEN_KEY = "khatagst_token";
const TOKEN_EXPIRY_KEY = "khatagst_token_expiry";
const BUSINESS_ID_KEY = "khatagst_business_id";
const BUSINESS_NAME_KEY = "khatagst_business_name";

export interface StoredBusinessContext {
  id: string;
  name: string;
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function hasValidSession(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!token || !expiry) return false;

  const parsedExpiry = Number(expiry);
  if (!Number.isFinite(parsedExpiry)) return false;

  return Date.now() < parsedExpiry;
}

// ✅ JWT is now 7 days — session expiry matches
export function setAuthSession(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(
    TOKEN_EXPIRY_KEY,
    String(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
}

export function getBusinessContext(): StoredBusinessContext | null {
  const id = localStorage.getItem(BUSINESS_ID_KEY);
  if (!id) return null;

  return {
    id,
    name: localStorage.getItem(BUSINESS_NAME_KEY) || "",
  };
}

export function setBusinessContext(business: StoredBusinessContext): void {
  localStorage.setItem(BUSINESS_ID_KEY, business.id);

  if (business.name) {
    localStorage.setItem(BUSINESS_NAME_KEY, business.name);
  } else {
    localStorage.removeItem(BUSINESS_NAME_KEY);
  }
}

export function clearBusinessContext(): void {
  localStorage.removeItem(BUSINESS_ID_KEY);
  localStorage.removeItem(BUSINESS_NAME_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  clearBusinessContext();
}
