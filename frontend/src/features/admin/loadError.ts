import { ApiError } from "../../services/api";

/** Why an admin page couldn't load, in words that point at the fix. */
export function loadError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "The backend is running an older version without this page. Restart the backend server (uvicorn), then try again.";
    if (err.status === 401 || err.status === 403) return "Your admin session has ended. Log in again.";
    return fallback;
  }
  return "Couldn't reach the backend. Check that the API server is running on port 8000.";
}
