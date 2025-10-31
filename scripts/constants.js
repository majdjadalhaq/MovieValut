// Centralised constants for MovieVault application.

export const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
export const MAX_RETRIES = 2;
export const SEARCH_DEBOUNCE = 400;
export const MAX_SUGGESTIONS = 5;
export const TOAST_DURATION = 3000;
export const BACKDROP_IMAGE_SIZE = "w1280";
// NOTE: the Lottie loader was removed. Use the JS show/hide loader helpers
// which now render a simple inline fallback spinner instead of loading
// an external Lottie JSON file.

// Multiplier used to slow down the hover tutorial demo animations. Teams can
// override this with the CSS custom property `--motion-demo-multiplier`.
export const TUTORIAL_ANIMATION_MULTIPLIER = 2.5;

export const CACHE_PREFIX = "movievault_cache_";

// Application version used for simple cache-busting of static assets. Bump when
// deploying new asset sets so clients pick up fresh images/CSS/JS.
export const APP_VERSION = "1.0.0";

export const STORAGE_KEYS = {
  FAVORITES: "movievault_favorites",
  WATCHED: "movievault_watched",
  THEME: "movievault_theme",
  SESSION_PLAN: "movievault_session_plan",
  TUTORIAL_SEEN: "movievault_tutorial_seen",
  CACHE_INDEX: "movievault_cache_index",
};

export const DEFAULT_CATEGORY = "trending";
export const DEFAULT_SECTION_TITLE = "Trending Now";

export const ENDPOINTS = {
  TRENDING: "trending/movie/week",
  POPULAR: "movie/popular",
  TOP_RATED: "movie/top_rated",
  UPCOMING: "movie/upcoming",
  SEARCH: "search/movie",
  SEARCH_PERSON: "search/person",
  SEARCH_COLLECTION: "search/collection",
  MOVIE_DETAILS: "movie", // append /{id}
  GENRES: "genre/movie/list",
  DISCOVER: "discover/movie",
  CONFIGURATION: "configuration",
};

export const GENRE_MAP = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 10770, name: "TV Movie" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];

export const THEMES = {
  dark: {
    key: "dark",
    label: "Dark",
    className: "",
    icon: "fa-moon",
  },
  light: {
    key: "light",
    label: "Light",
    className: "theme-light",
    icon: "fa-sun",
  },
};

export const PARALLAX_OPTIONS = {
  root: null,
  rootMargin: "0px",
  threshold: 0.25,
};

export const INFINITE_SCROLL_COOLDOWN = 250;
export const INFINITE_SCROLL_ROOT_MARGIN = "600px";

export const MOVIE_PLACEHOLDER = "assets/placeholders/poster-fallback.png";

export const FAVORITE_BADGE_TEXT = "Favorite";

export const TOAST_ICONS = {
  success: "fa-circle-check",
  info: "fa-circle-info",
  error: "fa-circle-xmark",
};

export const DRAWER_ACTIONS = {
  FAVORITES: "favorites",
  WATCHED: "watched",
  THEME: "theme",
  SEARCH: "search",
  CLOSE: "close",
};

export const WATCHED_BADGE_TEXT = "Watched";
export const POSTER_SIZES = {
  SMALL: "w342",
  MEDIUM: "w500",
};
