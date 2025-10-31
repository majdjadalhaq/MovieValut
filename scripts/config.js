// Configuration for MovieVault.
// NOTE: Avoid embedding secrets in source. This module will attempt to
// read the TMDB API key from a runtime-safe location instead of keeping
// a literal key in the repository.

// Priority order for locating the TMDB key at runtime:
// 1. window.__MOVIEVAULT_TMDB_KEY (set by a local script or dev tooling)
// 2. localStorage key: 'movievault_tmdb_key' (useful for local development)
// 3. empty string (no key configured)

// NOTE: user-provided TMDB key has been placed here per request.
// Security note: this will persist the key in source. Rotate the key if
// it was ever pushed to a public repository.
const TMDB_API_KEY = "634f3424186067405c1368917c4aedf6";

export const CONFIG = {
  TMDB_API_KEY,
  // Ensure trailing slash so URL(path, base) preserves the `/3/` path segment.
  TMDB_BASE_URL: "https://api.themoviedb.org/3/",
  TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p",
};

export const hasTmdbApiKey = () => {
  const key = CONFIG.TMDB_API_KEY;
  const normalized = typeof key === "string" ? key.trim().toLowerCase() : "";
  return Boolean(normalized) && normalized !== "your_tmdb_api_key_here";
};
