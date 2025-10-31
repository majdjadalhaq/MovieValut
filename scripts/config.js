// Configuration for MovieVault.

const TMDB_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MzRmMzQyNDE4NjA2NzQwNWMxMzY4OTE3YzRhZWRmNiIsIm5iZiI6MTc2MDQ0MzM3NS45OCwic3ViIjoiNjhlZTNiZWZhZTg2Y2Q0YzQ4YTIxY2Q3Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.gYlWEOkGTikqyaelOxvbtrOe9hQkoHueUgEroFp0s-4";

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
