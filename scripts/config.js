// Configuration for MovieVault.

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
