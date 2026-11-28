// In-memory session token store for authenticated backend API calls.
// Kept strictly in module memory (never written to localStorage or sessionStorage).

let activeSessionToken: string | null = null;

export function setAuthToken(token: string | null): void {
  activeSessionToken = token && token.trim() ? token.trim() : null;
}

export function getAuthToken(): string | null {
  return activeSessionToken;
}

export function clearAuthToken(): void {
  activeSessionToken = null;
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (activeSessionToken) {
    headers.Authorization = `Bearer ${activeSessionToken}`;
  }
  return headers;
}
