import { endLocalSession, type Account } from "./session";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
const baseUrl = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const accounts: Account[] = ["customer", "admin", "partner"];

/** Every API call goes through here, so the sign-in cookies and the request header are always sent. */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      // Send the HTTP-only sign-in cookies, also when VITE_API_URL points at another origin.
      credentials: "include",
      headers: {
        // Let the browser set the multipart boundary for file uploads.
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        // Proves the request came from the storefront itself (CSRF protection, see the backend's app.ts).
        "X-GreenFarm-Request": "true",
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please try again.", 0);
  }
  const data = await response
    .json()
    .catch(() => ({ message: "The server returned an invalid response" }));
  if (!response.ok) {
    // The server names which sign-in a 401 is about (and has already cleared its cookie); end only that one.
    if (response.status === 401 && accounts.includes(data.account)) endLocalSession(data.account);
    throw new ApiError(data.message || "Request failed", response.status);
  }
  return data as T;
}
