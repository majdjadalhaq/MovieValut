// API communication layer for MovieVault.

import { CONFIG, hasTmdbApiKey } from "./config.js";
import {
  CACHE_TTL,
  ENDPOINTS,
  BACKDROP_IMAGE_SIZE,
  MAX_RETRIES,
  MOVIE_PLACEHOLDER,
  GENRE_MAP,
  POSTER_SIZES,
} from "./constants.js";
import { getCache, setCache, showToast, buildCacheKey } from "./helpers.js";

const TMDB_BASE_URL = CONFIG.TMDB_BASE_URL;
const TMDB_IMAGE_BASE = CONFIG.TMDB_IMAGE_BASE;
const TMDB_POSTER_SMALL = `${TMDB_IMAGE_BASE}/${POSTER_SIZES.SMALL}`;
const TMDB_POSTER_MEDIUM = `${TMDB_IMAGE_BASE}/${POSTER_SIZES.MEDIUM}`;

const createMissingKeyError = () => {
  const error = new Error(
    "TMDB API key missing. Update scripts/config.js with your key."
  );
  error.code = "TMDB_KEY_MISSING";
  return error;
};

const ensureTmdbKey = () => {
  if (!hasTmdbApiKey()) {
    throw createMissingKeyError();
  }
};

// Small utility promise to add backoff between retry attempts.
const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

// Compose a TMDB request URL with optional query params.
const buildTmdbUrl = (path, params = {}) => {
  ensureTmdbKey();
  const url = new URL(path, TMDB_BASE_URL);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

// Fetch JSON payloads with retry + localStorage caching baked in.
const fetchJsonWithCache = async (
  url,
  cacheKey,
  { ttl = CACHE_TTL, skipCache = false } = {}
) => {
  if (!skipCache) {
    const cached = getCache(cacheKey);
    if (cached) return cached;
  }

  let attempt = 0;
  let lastError = null;

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${CONFIG.TMDB_V4_TOKEN}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (!skipCache) {
        setCache(cacheKey, data, ttl);
      }
      return data;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) {
        showToast("We hit a snag fetching fresh data.", "error");
        throw error;
      }
      await sleep(450 * (attempt + 1));
    } finally {
      attempt += 1;
    }
  }
  throw lastError;
};

// Normalize TMDB movie payload into the structure used by MovieVault cards.
const mapMovies = (results = []) => results.filter(Boolean).map(buildMovieCard);

// Convert TMDB people search results into lightweight UI summaries.
const mapPeople = (results = []) =>
  results
    .filter((person) => person && person.id)
    .map((person) => ({
      id: person.id,
      name: person.name,
      knownFor: (person.known_for_department || person.known_for?.[0]?.media_type || "")
        .toString()
        .replace(/_/g, " "),
      profile: person.profile_path
        ? `${TMDB_POSTER_SMALL}${person.profile_path}`
        : MOVIE_PLACEHOLDER,
      popularity: person.popularity,
    }));

// Convert TMDB collection data into UI-friendly objects.
const mapCollections = (results = []) =>
  results
    .filter((collection) => collection && collection.id)
    .map((collection) => ({
      id: collection.id,
      name: collection.name,
      overview: collection.overview,
      poster: collection.poster_path
        ? `${TMDB_POSTER_SMALL}${collection.poster_path}`
        : MOVIE_PLACEHOLDER,
      backdrop: collection.backdrop_path
        ? `${TMDB_IMAGE_BASE}/${BACKDROP_IMAGE_SIZE}${collection.backdrop_path}`
        : null,
    }));

// -------- PRIMARY MOVIE FEEDS ------------------------------------------------

// Fetch the TMDB weekly trending feed and map it into MovieVault card data.
export const fetchTrending = async (page = 1) => {
  const url = buildTmdbUrl(ENDPOINTS.TRENDING, { page });
  const cacheKey = buildCacheKey("trending", { page });
  const data = await fetchJsonWithCache(url, cacheKey);
  return {
    ...data,
    results: mapMovies(data.results),
  };
};

// Fetch the TMDB popular feed.
export const fetchPopular = async (page = 1) => {
  const url = buildTmdbUrl(ENDPOINTS.POPULAR, { page });
  const cacheKey = buildCacheKey("popular", { page });
  const data = await fetchJsonWithCache(url, cacheKey);
  return {
    ...data,
    results: mapMovies(data.results),
  };
};

// Fetch TMDB top-rated movies.
export const fetchTopRated = async (page = 1) => {
  const url = buildTmdbUrl(ENDPOINTS.TOP_RATED, { page });
  const cacheKey = buildCacheKey("top_rated", { page });
  const data = await fetchJsonWithCache(url, cacheKey);
  return {
    ...data,
    results: mapMovies(data.results),
  };
};

// Fetch TMDB upcoming releases.
export const fetchUpcoming = async (page = 1) => {
  const url = buildTmdbUrl(ENDPOINTS.UPCOMING, { page });
  const cacheKey = buildCacheKey("upcoming", { page });
  const data = await fetchJsonWithCache(url, cacheKey);
  return {
    ...data,
    results: mapMovies(data.results),
  };
};

// -------- SEARCH ENDPOINTS ---------------------------------------------------

// Search TMDB movies, respecting pagination and adult content filtering.
export const searchMovies = async (query, page = 1) => {
  if (!query) return { results: [], total_pages: 0, page: 1 };
  const url = buildTmdbUrl(ENDPOINTS.SEARCH, {
    query,
    page,
    include_adult: false,
  });
  const cacheKey = buildCacheKey("search", { query, page });
  const data = await fetchJsonWithCache(url, cacheKey);
  return {
    ...data,
    results: mapMovies(data.results),
  };
};

// Search TMDB people to highlight notable cast/crew members.
export const searchPeople = async (query, page = 1) => {
  if (!query) return { results: [], total_pages: 0, page: 1 };
  const url = buildTmdbUrl(ENDPOINTS.SEARCH_PERSON, {
    query,
    page,
    include_adult: false,
  });
  const cacheKey = buildCacheKey("search_people", { query, page });
  const data = await fetchJsonWithCache(url, cacheKey, { ttl: CACHE_TTL / 2 });
  return {
    ...data,
    results: mapPeople(data.results),
  };
};

// Search TMDB collections (franchises / grouped sets).
export const searchCollections = async (query, page = 1) => {
  if (!query) return { results: [], total_pages: 0, page: 1 };
  const url = buildTmdbUrl(ENDPOINTS.SEARCH_COLLECTION, {
    query,
    page,
  });
  const cacheKey = buildCacheKey("search_collections", { query, page });
  const data = await fetchJsonWithCache(url, cacheKey, { ttl: CACHE_TTL / 2 });
  return {
    ...data,
    results: mapCollections(data.results),
  };
};

// -------- FILTERED DISCOVERY -------------------------------------------------

// Fetch TMDB discover endpoint filtered by selected genres.
export const fetchMoviesByGenre = async (genreIds, page = 1) => {
  const normalizedList = Array.isArray(genreIds)
    ? genreIds
        .map((id) => String(id))
        .filter(Boolean)
    : String(genreIds ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
  const uniqueIds = Array.from(new Set(normalizedList));
  const withGenres = uniqueIds.join(",");
  const url = buildTmdbUrl(ENDPOINTS.DISCOVER, {
    with_genres: withGenres,
    page,
    sort_by: "popularity.desc",
  });
  const cacheKey = buildCacheKey("genre", {
    genreId: withGenres || "all",
    page,
  });
  const data = await fetchJsonWithCache(url, cacheKey);
  return {
    ...data,
    results: mapMovies(data.results),
  };
};

// Retrieve comprehensive movie detail payload (videos, recommendations, credits).
export const fetchMovieDetails = async (movieId) => {
  const url = buildTmdbUrl(`${ENDPOINTS.MOVIE_DETAILS}/${movieId}`, {
    append_to_response: "videos,images,recommendations,credits",
  });
  const cacheKey = buildCacheKey("movie_details", { movieId });
  return fetchJsonWithCache(url, cacheKey);
};

// Pull a person's filmography for the modal cast explorer.
export const fetchPersonFilmography = async (personId) => {
  if (!personId) return { cast: [] };
  const url = buildTmdbUrl(`person/${personId}/movie_credits`, {});
  const cacheKey = buildCacheKey("person_filmography", { personId });
  return fetchJsonWithCache(url, cacheKey);
};

// Fetch TMDB collection details (used for franchise expansions).
export const fetchCollectionDetails = async (collectionId) => {
  if (!collectionId) return null;
  const url = buildTmdbUrl(`collection/${collectionId}`, {});
  const cacheKey = buildCacheKey("collection_details", { collectionId });
  const data = await fetchJsonWithCache(url, cacheKey);
  if (!data) {
    return null;
  }
  return {
    ...data,
    parts: mapMovies(data.parts),
  };
};

// Fetch the official TMDB genre list with a static fallback when offline.
export const fetchGenres = async () => {
  if (!hasTmdbApiKey()) {
    return GENRE_MAP;
  }
  try {
    const url = buildTmdbUrl(ENDPOINTS.GENRES);
    const cacheKey = buildCacheKey("genres");
    const data = await fetchJsonWithCache(url, cacheKey);
    if (data && data.genres && data.genres.length) {
      return data.genres;
    }
  } catch (error) {
    console.warn("Falling back to static genre map", error);
  }
  return GENRE_MAP;
};

// Fetch post-watch recommendations for a given movie.
export const fetchRecommendations = async (movieId, page = 1) => {
  if (!movieId) return { results: [], total_pages: 0, page: 1 };
  const url = buildTmdbUrl(
    `${ENDPOINTS.MOVIE_DETAILS}/${movieId}/recommendations`,
    { page }
  );
  const cacheKey = buildCacheKey("recommendations", { movieId, page });
  const data = await fetchJsonWithCache(url, cacheKey);
  return {
    ...data,
    results: mapMovies(data.results),
  };
};

// Normalise TMDB movie data into the shape consumed by MovieVault UI.
export const buildMovieCard = (movie = {}) => {
  const rating = Number.isFinite(Number(movie.vote_average))
    ? Number(movie.vote_average).toFixed(1)
    : "NR";
  const posterPath = movie.poster_path || movie.posterPath || "";
  const hasPoster = Boolean(posterPath);
  const poster = hasPoster
    ? `${TMDB_POSTER_MEDIUM}${posterPath}`
    : MOVIE_PLACEHOLDER;
  const posterSmall = hasPoster
    ? `${TMDB_POSTER_SMALL}${posterPath}`
    : MOVIE_PLACEHOLDER;
  const posterSet = hasPoster
    ? `${TMDB_POSTER_SMALL}${posterPath} 342w, ${TMDB_POSTER_MEDIUM}${posterPath} 500w`
    : "";
  const posterSizes =
    "(max-width: 600px) 62vw, (max-width: 1024px) 32vw, 220px";
  const backdrop = movie.backdrop_path
    ? `${TMDB_IMAGE_BASE}/${BACKDROP_IMAGE_SIZE}${movie.backdrop_path}`
    : null;

  return {
    id: movie.id,
    title: movie.title || movie.name || "Untitled",
    rating,
    releaseDate: movie.release_date || movie.first_air_date || "Unknown",
    poster,
    posterSmall,
    posterSet,
    posterSizes,
    backdrop,
    overview: movie.overview || "Synopsis unavailable for this title.",
    genreIds: movie.genre_ids || [],
    popularity: movie.popularity,
    voteCount: movie.vote_count,
  };
};
