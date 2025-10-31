// Shared helper utilities for MovieVault.

import {
  CACHE_TTL,
  CACHE_PREFIX,
  STORAGE_KEYS,
  TOAST_DURATION,
  THEMES,
  TOAST_ICONS,
  MOVIE_PLACEHOLDER,
  APP_VERSION,
} from "./constants.js";

// Detect whether localStorage can be used (Safari private mode safe-guard).
const isLocalStorageAvailable = (() => {
  try {
    const testKey = "__movievault_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn("LocalStorage unavailable:", error);
    return false;
  }
})();

// Thin wrapper around localStorage with consistent error handling.
const storage = {
  get(key) {
    if (!isLocalStorageAvailable) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error("Storage get error:", error);
      return null;
    }
  },
  set(key, value) {
    if (!isLocalStorageAvailable) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.error("Storage set error:", error);
    }
  },
  remove(key) {
    if (!isLocalStorageAvailable) return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error("Storage remove error:", error);
    }
  },
  keys() {
    if (!isLocalStorageAvailable) return [];
    return Object.keys(window.localStorage);
  },
};

const buildStorageKey = (key) => `${CACHE_PREFIX}${key}`;

// Compose deterministic cache keys from namespace + sorted params.
export const buildCacheKey = (namespace, params = {}) => {
  const paramString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
  return `${namespace}${paramString ? `::${paramString}` : ""}`;
};

// Maintain a simple registry of cache entries for convenient purges.
const updateCacheIndex = (cacheKey, remove = false) => {
  let index = [];
  const rawIndex = storage.get(STORAGE_KEYS.CACHE_INDEX);
  if (rawIndex) {
    try {
      index = JSON.parse(rawIndex);
    } catch (error) {
      index = [];
    }
  }
  if (remove) {
    index = index.filter((key) => key !== cacheKey);
  } else if (!index.includes(cacheKey)) {
    index.push(cacheKey);
  }
  storage.set(STORAGE_KEYS.CACHE_INDEX, JSON.stringify(index));
};

const isExpired = (timestamp, ttl) =>
  Number.isFinite(timestamp) && Date.now() - timestamp > ttl;

// Convenience helper for DOM node creation.
export const createEl = (tag, className = "", text = "") => {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text) {
    el.textContent = text;
  }
  return el;
};

// Debounce high-frequency callbacks (search input, scroll, resize).
export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn.apply(null, args);
    }, delay);
  };
};

// Persist API responses in localStorage with TTL metadata.
export const setCache = (key, data, ttl = CACHE_TTL) => {
  if (!isLocalStorageAvailable || !key) return;
  const payload = {
    timestamp: Date.now(),
    ttl,
    data,
  };
  const storageKey = buildStorageKey(key);
  storage.set(storageKey, JSON.stringify(payload));
  updateCacheIndex(storageKey);
};

// Retrieve cached payloads, expiring stale entries automatically.
export const getCache = (key) => {
  if (!isLocalStorageAvailable || !key) return null;
  const storageKey = buildStorageKey(key);
  const raw = storage.get(storageKey);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (payload && payload.timestamp && payload.ttl) {
      if (isExpired(payload.timestamp, payload.ttl)) {
        storage.remove(storageKey);
        updateCacheIndex(storageKey, true);
        return null;
      }
      return payload.data;
    }
    return null;
  } catch (error) {
    console.error("Cache parse error:", error);
    storage.remove(storageKey);
    updateCacheIndex(storageKey, true);
    return null;
  }
};

// Developer helper: nuke all MovieVault cache entries.
export const clearAllCache = () => {
  const keys = storage.keys();
  keys
    .filter((key) => key.startsWith(CACHE_PREFIX))
    .forEach((key) => {
      storage.remove(key);
    });
  storage.remove(STORAGE_KEYS.CACHE_INDEX);
};

// Internal helper to parse favourites payload from storage.
const getFavoritesRaw = () => {
  const raw = storage.get(STORAGE_KEYS.FAVORITES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveFavorites = (favorites) => {
  storage.set(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
};

export const getFavorites = () => getFavoritesRaw();

export const isFavorite = (id) =>
  getFavoritesRaw().some((item) => Number(item.id) === Number(id));

// Toggle favourite status, persist the list, and surface user feedback.
export const toggleFavorite = (movie) => {
  if (!movie || !movie.id) return false;
  const favorites = getFavoritesRaw();
  const exists = favorites.some((item) => Number(item.id) === Number(movie.id));
  let updated;
  if (exists) {
    updated = favorites.filter((item) => Number(item.id) !== Number(movie.id));
    showToast(`Removed "${movie.title}" from favorites.`, "info");
  } else {
    updated = [
      ...favorites,
      {
        id: movie.id,
        title: movie.title,
        poster: movie.poster || MOVIE_PLACEHOLDER,
        rating: movie.rating || "0.0",
        releaseDate: movie.releaseDate || "",
      },
    ];
    showToast(`"${movie.title}" added to favorites.`, "success");
  }
  saveFavorites(updated);
  return !exists;
};

// Internal helper to parse watched payload from storage.
const getWatchedRaw = () => {
  const raw = storage.get(STORAGE_KEYS.WATCHED);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveWatched = (watched) => {
  storage.set(STORAGE_KEYS.WATCHED, JSON.stringify(watched));
};

export const getWatched = () => getWatchedRaw();

export const isWatched = (id) =>
  getWatchedRaw().some((item) => Number(item.id) === Number(id));

// Toggle watched state, persist updates, and emit toasts.
export const toggleWatched = (movie) => {
  if (!movie || !movie.id) return false;
  const watched = getWatchedRaw();
  const exists = watched.some((item) => Number(item.id) === Number(movie.id));
  let updated;
  if (exists) {
    updated = watched.filter((item) => Number(item.id) !== Number(movie.id));
    showToast(`Marked "${movie.title}" as unwatched.`, "info");
  } else {
    updated = [
      ...watched,
      {
        id: movie.id,
        title: movie.title,
        poster: movie.poster || MOVIE_PLACEHOLDER,
        rating: movie.rating || "0.0",
        releaseDate: movie.releaseDate || "",
      },
    ];
    showToast(`"${movie.title}" added to watched list.`, "success");
  }
  saveWatched(updated);
  return !exists;
};

let toastId = 0;

// Render toast notifications with optional action buttons and auto-dismissal.
export const showToast = (
  message,
  type = "info",
  { actionText = null, actionHandler = null, duration = TOAST_DURATION } = {}
) => {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = createEl("div", "toast animate-toast");
  // Use role=status so screen readers announce by default; container already has aria-live
  toast.setAttribute("role", "status");
  toast.dataset.toastId = `${toastId += 1}`;

  const icon = createEl("i", `fa-solid ${TOAST_ICONS[type] || TOAST_ICONS.info}`);
  const text = createEl("span", "toast-message", message);
  toast.append(icon, text);

  if (actionText && typeof actionText === "string") {
    const actionBtn = createEl("button", "toast-action", actionText);
    actionBtn.type = "button";
    actionBtn.setAttribute("aria-label", actionText);
    actionBtn.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        if (typeof actionHandler === "function") {
          actionHandler();
        }
      } catch (err) {
        console.error("Toast action failed", err);
      }
      // remove toast immediately after action
      toast.remove();
    });
    toast.append(actionBtn);
  }

  container.append(toast);

  // Also announce via dedicated live region (if present) for better screen-reader reliability
  try {
    const live = document.getElementById("a11y-live");
    if (live) {
      live.textContent = message;
    }
  } catch (err) {
    // ignore -- non-critical
  }

  window.setTimeout(() => {
    if (!toast.isConnected) return;
    toast.classList.add("fade-out");
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20%)";
    window.setTimeout(() => toast.remove(), 350);
  }, duration);
};

// Small explicit announce helper for other modules to use when an immediate
// screen-reader announcement is needed (separate from visual toast).
export const announceLive = (message) => {
  try {
    const live = document.getElementById("a11y-live");
    if (live) {
      live.textContent = message;
      return true;
    }
  } catch (err) {
    // noop
  }
  return false;
};

// Smoothly scroll the page back to the top.
export const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

let imageObserver;

// Lazily create a shared IntersectionObserver for progressive image loading.
const ensureImageObserver = () => {
  if (imageObserver) return imageObserver;
  imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        if (src) {
          img.src = src;
        }
        const srcset = img.dataset.srcset;
        if (srcset) {
          img.srcset = srcset;
        }
        observer.unobserve(img);
      }
    });
  }, { rootMargin: "150px" });
  return imageObserver;
};

// Lazily hydrate <img> tags with graceful fallbacks if loading fails.
export const lazyLoadImage = (
  img,
  src,
  { srcset = "", sizes = "auto", placeholder = MOVIE_PLACEHOLDER } = {}
) => {
  if (!img) return;
  img.loading = "lazy";
  img.decoding = "async";
  img.src = placeholder;
  img.dataset.src = src || placeholder;
  if (srcset) {
    img.dataset.srcset = srcset;
    img.sizes = sizes;
  }
  img.addEventListener(
    "error",
    () => {
      img.removeAttribute("srcset");
      img.src = MOVIE_PLACEHOLDER;
    },
    { once: true }
  );
  const observer = ensureImageObserver();
  observer.observe(img);
};

// Apply a theme object to document, optionally announcing the change.
export const setTheme = (themeObj = THEMES.dark, options = { silent: false }) => {
  const body = document.body;
  if (!body) return THEMES.dark;

  Object.values(THEMES)
    .map((theme) => theme.className)
    .filter(Boolean)
    .forEach((className) => body.classList.remove(className));

  body.dataset.theme = themeObj.key;
  if (themeObj.className) {
    body.classList.add(themeObj.className);
  }
  storage.set(STORAGE_KEYS.THEME, themeObj.key);
  // Add a short transition class to animate the visual change, unless the
  // user prefers reduced motion. The class is removed after the CSS duration.
  try {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!options.silent && !prefersReduced) {
      const docStyle = getComputedStyle(document.documentElement);
      let dur = docStyle.getPropertyValue('--theme-transition-duration') || '420ms';
      dur = String(dur).trim();
      // convert to ms number
      let ms = 420;
      if (dur.endsWith('ms')) {
        ms = Math.round(parseFloat(dur));
      } else if (dur.endsWith('s')) {
        ms = Math.round(parseFloat(dur) * 1000);
      }
      body.classList.add('theme-transition');
      // remove after duration + small buffer
      window.setTimeout(() => body.classList.remove('theme-transition'), Math.max(60, ms + 40));
    }
    if (!options.silent) {
      showToast(`Switched to ${themeObj.label} theme.`, "success");
    }
  } catch (err) {
    // fallback: still show toast
    if (!options.silent) {
      showToast(`Switched to ${themeObj.label} theme.`, "success");
    }
  }
  return themeObj;
};

// Retrieve persisted theme preference, falling back to system default.
export const getStoredTheme = () => {
  const stored = storage.get(STORAGE_KEYS.THEME);
  if (stored && THEMES[stored]) {
    return THEMES[stored];
  }
  return THEMES.dark;
};

const plannerKey = STORAGE_KEYS.SESSION_PLAN;

export const getSessionPlan = () => {
  if (!plannerKey) return [];
  const raw = storage.get(plannerKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveSessionPlan = (plan = []) => {
  storage.set(plannerKey, JSON.stringify(plan));
};

export const clearSessionPlan = () => {
  storage.remove(plannerKey);
};

// Generic small helpers for persistent flags (tutorials, feature toggles)
export const getFlag = (key) => {
  if (!key || !isLocalStorageAvailable) return null;
  try {
    const raw = storage.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
};

export const setFlag = (key, value) => {
  if (!key || !isLocalStorageAvailable) return;
  try {
    storage.set(key, JSON.stringify(value));
  } catch (err) {
    // noop
  }
};

const loadedStylesheets = new Set();

export const loadStylesheetOnce = (href) => {
  if (!href || loadedStylesheets.has(href)) return;
  const existing = Array.from(document.styleSheets || []).some(
    (sheet) => sheet.href && sheet.href.includes(href)
  );
  if (existing) {
    loadedStylesheets.add(href);
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.media = "all";
  link.dataset.lazy = "true";
  document.head.appendChild(link);
  loadedStylesheets.add(href);
};

// Defer optional work until the browser is idle (with timeout fallback).
export const runIdle = (callback, timeout = 200) => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout });
  } else {
    window.setTimeout(callback, 0);
  }
};

// Build an asset URL that includes a version query param for simple cache-busting.
// Usage: getAssetUrl('assets/placeholders/poster-fallback.png') => '.../poster-fallback.png?v=1.0.0'
export const getAssetUrl = (path) => {
  if (!path) return path;
  try {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}v=${encodeURIComponent(APP_VERSION || "")}`;
  } catch (err) {
    return path;
  }
};

// Cache dominant color lookups so repeat posters resolve instantly.
const dominantColorCache = new Map();
const colorCanvas = document.createElement("canvas");
const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });

// Downsample an image element into a 60x60 canvas and average RGB values.
const computeAverageColor = (image) => {
  if (!colorCtx || !image) {
    return { r: 120, g: 120, b: 120 };
  }
  const width = (colorCanvas.width = Math.max(1, Math.min(60, image.naturalWidth)));
  const height = (colorCanvas.height = Math.max(1, Math.min(60, image.naturalHeight)));
  try {
    colorCtx.drawImage(image, 0, 0, width, height);
    const data = colorCtx.getImageData(0, 0, width, height).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 32) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
    if (!count) return { r: 120, g: 120, b: 120 };
    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count),
    };
  } catch (error) {
    console.warn("Dominant color extraction failed", error);
    return { r: 120, g: 120, b: 120 };
  }
};

// Resolve a blurred dominant color string for posters/backdrops.
export const extractDominantColor = (img, cacheKey) =>
  new Promise((resolve) => {
    if (!img) {
      resolve("#787878");
      return;
    }
    const key = cacheKey || img.dataset.src || img.currentSrc || img.src;
    if (key && dominantColorCache.has(key)) {
      resolve(dominantColorCache.get(key));
      return;
    }
    const process = () => {
      const { r, g, b } = computeAverageColor(img);
      const value = `rgba(${r}, ${g}, ${b}, 0.6)`;
      if (key) {
        dominantColorCache.set(key, value);
      }
      resolve(value);
    };
    if (img.complete && img.naturalWidth > 0) {
      process();
    } else {
      img.addEventListener("load", process, { once: true });
      img.addEventListener(
        "error",
        () => {
          resolve("rgba(120, 120, 120, 0.6)");
        },
        { once: true }
      );
    }
  });

// Provide tactile feedback with a micro-animation (and optional vibration).
export const triggerSoftHaptic = (element) => {
  if (!element || typeof element.animate !== "function") return;
  element.animate(
    [
      { transform: "translate3d(0, 0, 0)" },
      { transform: "translate3d(0, -1px, 0)" },
      { transform: "translate3d(0, 1px, 0)" },
      { transform: "translate3d(0, 0, 0)" },
    ],
    {
      duration: 140,
      easing: "ease-out",
    }
  );
  if ("vibrate" in navigator) {
    navigator.vibrate?.(12);
  }
};

// Format runtime minutes into a readable `Hh Mm` string.
export const formatRuntime = (minutes) => {
  const total = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;
  if (total <= 0) {
    return "—";
  }
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) {
    return `${mins} min`;
  }
  if (!mins) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
};

const observerRegistry = new Map();
const serializeObserverOptions = (options = {}) =>
  JSON.stringify({
    root: options.root ? "__custom__" : null,
    rootMargin: options.rootMargin || "0px",
    threshold: Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0],
  });

// Observe a DOM node and fire a callback the first time it scrolls into view.
export const observeWhenVisible = (element, callback, options = {}) => {
  if (!element || typeof callback !== "function") {
    return () => {};
  }
  const key = serializeObserverOptions(options);
  let entry = observerRegistry.get(key);
  if (!entry) {
    const callbackStore = new WeakMap();
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entryItem) => {
        if (!entryItem.isIntersecting) return;
        const storedCallback = callbackStore.get(entryItem.target);
        if (typeof storedCallback === "function") {
          storedCallback(entryItem);
          callbackStore.delete(entryItem.target);
        }
        obs.unobserve(entryItem.target);
      });
    }, options);
    entry = { observer, callbackStore };
    observerRegistry.set(key, entry);
  }
  entry.callbackStore.set(element, callback);
  entry.observer.observe(element);
  return () => {
    entry.callbackStore.delete(element);
    entry.observer.unobserve(element);
  };
};
