// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================
// Coordinates data fetching, UI wiring, and client-side state for MovieVault.

import { CONFIG, hasTmdbApiKey } from "./config.js";
import {
  fetchTrending,
  fetchPopular,
  fetchTopRated,
  fetchUpcoming,
  fetchMoviesByGenre,
  searchMovies,
  searchPeople,
  searchCollections,
  fetchMovieDetails,
  fetchGenres,
  fetchPersonFilmography,
  fetchCollectionDetails,
  buildMovieCard,
} from "./api.js";
import {
  debounce,
  getFavorites,
  getWatched,
  toggleFavorite,
  toggleWatched,
  isFavorite,
  isWatched,
  getStoredTheme,
  setTheme,
  showToast,
  announceLive,
  saveSessionPlan,
  getSessionPlan,
  clearSessionPlan,
  loadStylesheetOnce,
  runIdle,
  extractDominantColor,
  triggerSoftHaptic,
  lazyLoadImage,
  formatRuntime,
  observeWhenVisible,
  
} from "./helpers.js";
import {
  renderMovieGrid,
  renderSuggestions,
  clearSuggestions,
  updateSectionTitle,
  renderGenreOptions,
  setActiveNav,
  setActiveGenreChip,
  setGenreDropdownState,
  updateGenreTriggerSummary,
  openMovieModal,
  openFavoritesModal,
  openWatchedModal,
  bindBackToTop,
  setBackToTopVisibility,
  showLoader,
  hideLoader,
  configureThemeToggle,
  updateThemeButton,
  configureDrawer,
  closeDrawer,
  updateScrollProgress,
  openCastFilmographyModal,
  openCollectionModal,
  animateThrowToTrigger,
  bindRippleEffect,
  animateThrowWithTrail,
  startDragHint,
  stopDragHint,
} from "./ui.js";
import {
  DEFAULT_CATEGORY,
  DEFAULT_SECTION_TITLE,
  SEARCH_DEBOUNCE,
  MAX_SUGGESTIONS,
  INFINITE_SCROLL_COOLDOWN,
  INFINITE_SCROLL_ROOT_MARGIN,
  THEMES,
  STORAGE_KEYS,
  DRAWER_ACTIONS,
  MOVIE_PLACEHOLDER,
} from "./constants.js";

// ----------------------------------------------------------------------------
// APPLICATION STATE
// ----------------------------------------------------------------------------

const state = {
  category: DEFAULT_CATEGORY,
  page: 1,
  totalPages: Infinity,
  loading: false,
  searchQuery: "",
  selectedGenres: [],
  genres: [],
  favorites: [],
  watched: [],
  prefetch: null,
  prefetchToken: null,
  lastScrollLoad: 0,
  loadedMovies: [],
  searchOverlay: {
    open: false,
   activeColumn: "movies",
   activeIndex: 0,
   results: {
     movies: [],
     people: [],
     collections: [],
   },
  },
  planner: {
    queue: [],
    runtime: 0,
  },
  tmdbReady: hasTmdbApiKey(),
};

let infiniteObserver = null;
let scrollTicking = false;
const MAX_PLANNER_ITEMS = 12;
const runtimeCache = new Map();
const DRAG_DATA_CARD_ID = "application/movievault-card-id";
const DRAG_DATA_PLANNER_INDEX = "application/movievault-planner-index";
let missingApiKeyHandled = false;

// ----------------------------------------------------------------------------
// RUNTIME HELPERS
// ----------------------------------------------------------------------------

// Lookup runtime for a movie, caching results to avoid repeat API calls.
const getMovieRuntime = async (movieId) => {
  if (!movieId) return 0;
  if (runtimeCache.has(movieId)) {
    return runtimeCache.get(movieId);
  }
  try {
    const details = await fetchMovieDetails(movieId);
    const runtime = Number.isFinite(Number(details.runtime))
      ? Number(details.runtime)
      : 0;
    runtimeCache.set(movieId, runtime);
    return runtime;
  } catch (error) {
    console.error("Runtime lookup failed", error);
    runtimeCache.set(movieId, 0);
    return 0;
  }
};


// ----------------------------------------------------------------------------
// DOM SHORTCUTS
// ----------------------------------------------------------------------------

const searchOverlayEl = () => document.getElementById("search-overlay");
const searchResultsList = (type) =>
  document.getElementById(`search-results-${type}`);
const searchOverlayPanel = () =>
  document.querySelector("#search-overlay .search-overlay-panel");
const searchColumnActionButtons = () =>
  document.querySelectorAll(".search-column-action");
const plannerDrawerEl = () => document.getElementById("planner-drawer");
const plannerListEl = () => document.getElementById("planner-list");
const plannerCountEl = () => document.getElementById("planner-count");
const plannerRuntimeEl = () => document.getElementById("planner-runtime");
const plannerDropZoneEl = () => document.getElementById("planner-drop-zone");
const plannerSaveButton = () => document.getElementById("planner-save");
const plannerClearButton = () => document.getElementById("planner-clear");
const plannerTriggerButton = () => document.getElementById("planner-trigger");
const plannerCloseButton = () => document.getElementById("planner-close");
const plannerEmptyMessageEl = () =>
  plannerDropZoneEl()?.querySelector(".planner-empty");

const scrollSentinelEl = () => document.getElementById("scroll-sentinel");
const genreDropdownContainer = () => document.getElementById("genre-dropdown");
const genreDropdownTriggerEl = () =>
  document.getElementById("genre-dropdown-trigger");

// ----------------------------------------------------------------------------
// GENRE TOOLBAR STATE
// ----------------------------------------------------------------------------

// Enable/disable the "Clear" button based on active genre selections.
const syncGenreClearButtonState = () => {
  const clearButton = document.getElementById("genre-clear");
  if (!clearButton) return;
  const hasSelection = Array.isArray(state.selectedGenres) && state.selectedGenres.length > 0;
  clearButton.disabled = !hasSelection;
  clearButton.setAttribute("aria-disabled", hasSelection ? "false" : "true");
};

let genreDropdownOpen = false;
// Toggle the visibility of the genre dropdown and manage focus states.
const setGenreDropdownOpen = (open) => {
  const shouldOpen = Boolean(open);
  if (genreDropdownOpen === shouldOpen) return;
  genreDropdownOpen = shouldOpen;
  setGenreDropdownState(genreDropdownOpen);
  if (genreDropdownOpen) {
    window.requestAnimationFrame(() => {
      const dropdown = genreDropdownContainer();
      const activeChip =
        dropdown?.querySelector(".genre-chip.active") ||
        dropdown?.querySelector(".genre-chip");
      if (activeChip) {
        activeChip.focus({ preventScroll: true });
      }
    });
  }
};

const closeGenreDropdown = () => setGenreDropdownOpen(false);

// ----------------------------------------------------------------------------
// PLANNER DRAWER
// ----------------------------------------------------------------------------

const isPlannerOpen = () =>
  plannerDrawerEl()?.classList.contains("active") || false;

// Slide the session planner drawer in/out and manage focus trap.
const setPlannerDrawerVisibility = (open) => {
  const drawer = plannerDrawerEl();
  if (!drawer) return;
  const shouldOpen = Boolean(open);
  drawer.classList.toggle("active", shouldOpen);
  drawer.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
  if (!shouldOpen) {
    // clear temporary focus traps added when opening the drawer
    const tempFocusable = drawer.querySelector("[tabindex=\"-1\"]");
    if (tempFocusable) {
      tempFocusable.removeAttribute("tabindex");
    }
  }
};

const openPlannerDrawer = ({ focusDropZone = false } = {}) => {
  setPlannerDrawerVisibility(true);
  if (focusDropZone) {
    const dropZone = plannerDropZoneEl();
    if (dropZone) {
      dropZone.setAttribute("tabindex", "-1");
      dropZone.focus({ preventScroll: true });
    }
  }
};

const closePlannerDrawer = () => {
  setPlannerDrawerVisibility(false);
};

// Simple toggle helper for planner drawer buttons.
const togglePlannerDrawer = () => {
  if (isPlannerOpen()) {
    closePlannerDrawer();
  } else {
    openPlannerDrawer();
  }
};

const highlightPlannerDropZone = (active) => {
  const dropZone = plannerDropZoneEl();
  if (!dropZone) return;
  dropZone.classList.toggle("drag-over", Boolean(active));
};

const computePlannerRuntime = () =>
  state.planner.queue.reduce(
    (total, item) => total + (Number.isFinite(Number(item.runtime)) ? Number(item.runtime) : 0),
    0
  );

const persistPlannerQueue = () => {
  saveSessionPlan(state.planner.queue);
};

const updatePlannerSummary = () => {
  const count = state.planner.queue.length;
  const runtime = computePlannerRuntime();
  state.planner.runtime = runtime;
  if (plannerCountEl()) {
    plannerCountEl().textContent =
      count === 1 ? "1 title" : `${count} titles`;
  }
  if (plannerRuntimeEl()) {
    plannerRuntimeEl().textContent = `Total runtime: ${formatRuntime(runtime)}`;
  }
  const emptyMessage = plannerEmptyMessageEl();
  if (emptyMessage) {
    emptyMessage.classList.toggle("hidden", count > 0);
  }
};

const buildPlannerItem = (item, index) => {
  const li = document.createElement("li");
  li.className = "planner-item";
  li.dataset.id = String(item.id);
  li.dataset.index = String(index);
  li.draggable = true;

  const orderBadge = document.createElement("span");
  orderBadge.className = "planner-order";
  orderBadge.textContent = String(index + 1);

  const thumb = document.createElement("div");
  thumb.className = "planner-thumb";
  const img = document.createElement("img");
  img.alt = `${item.title} poster thumbnail`;
  lazyLoadImage(img, item.poster, {
    srcset: item.posterSet || "",
    sizes: "(max-width: 768px) 40vw, 96px",
  });
  thumb.appendChild(img);

  const info = document.createElement("div");
  info.className = "planner-info";
  const title = document.createElement("h4");
  title.textContent = item.title;
  const meta = document.createElement("span");
  const year = item.releaseDate && item.releaseDate.includes("-")
    ? item.releaseDate.split("-")[0]
    : item.releaseDate || "—";
  const rating = Number.isFinite(Number(item.rating))
    ? Number(item.rating).toFixed(1)
    : "NR";
  const runtimeLabel = formatRuntime(item.runtime);
  meta.textContent = `${year} • ★ ${rating} • ${runtimeLabel}`;
  info.append(title, meta);

  const controls = document.createElement("div");
  controls.className = "planner-controls";
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.dataset.action = "open";
  openBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.dataset.action = "remove";
  removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  const moveUpBtn = document.createElement("button");
  moveUpBtn.type = "button";
  moveUpBtn.dataset.action = "move-up";
  moveUpBtn.setAttribute("aria-label", "Move up");
  moveUpBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
  const moveDownBtn = document.createElement("button");
  moveDownBtn.type = "button";
  moveDownBtn.dataset.action = "move-down";
  moveDownBtn.setAttribute("aria-label", "Move down");
  moveDownBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
  controls.append(openBtn, removeBtn);
  // Append move controls after primary controls for keyboard users
  controls.append(moveUpBtn, moveDownBtn);

  li.append(orderBadge, thumb, info, controls);
  return li;
};

const renderPlannerQueue = () => {
  const list = plannerListEl();
  if (!list) return;
  list.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.planner.queue.forEach((item, index) => {
    const element = buildPlannerItem(item, index);
    fragment.appendChild(element);
  });
  list.appendChild(fragment);
  updatePlannerSummary();
};

const hydrateSessionPlan = () => {
  const stored = getSessionPlan();
  if (!Array.isArray(stored) || !stored.length) {
    updatePlannerSummary();
    return;
  }
  state.planner.queue = stored.map((item) => ({
    id: item.id,
    title: item.title,
    poster: item.poster || MOVIE_PLACEHOLDER,
    posterSet: item.posterSet || "",
    posterSizes: item.posterSizes || "(max-width: 600px) 62vw, 220px",
    releaseDate: item.releaseDate || "",
    rating: item.rating || "NR",
    runtime: Number.isFinite(Number(item.runtime)) ? Number(item.runtime) : 0,
  }));
  renderPlannerQueue();
};

const removePlannerItem = (movieId) => {
  const idx = state.planner.queue.findIndex((item) => Number(item.id) === Number(movieId));
  if (idx === -1) return;
  const [removed] = state.planner.queue.splice(idx, 1);
  renderPlannerQueue();
  persistPlannerQueue();
  // Offer an undo action to restore the removed item at the same index
  showToast(`Removed "${removed.title}" from Session Planner.`, "info", {
    actionText: "Undo",
    actionHandler: () => {
      state.planner.queue.splice(Math.min(idx, state.planner.queue.length), 0, removed);
      renderPlannerQueue();
      persistPlannerQueue();
      showToast(`Restored "${removed.title}".`, "success");
    },
  });
};

const clearPlannerQueue = () => {
  if (!state.planner.queue.length) return;
  const previous = [...state.planner.queue];
  state.planner.queue = [];
  state.planner.runtime = 0;
  renderPlannerQueue();
  persistPlannerQueue();
  clearSessionPlan();
  showToast("Session Planner cleared.", "success", {
    actionText: "Undo",
    actionHandler: () => {
      state.planner.queue = previous.slice();
      renderPlannerQueue();
      persistPlannerQueue();
      showToast("Restored your session plan.", "success");
    },
  });
};

const reorderPlannerItems = (fromIndex, toIndex) => {
  const queue = [...state.planner.queue];
  if (
    Number.isNaN(fromIndex) ||
    Number.isNaN(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= queue.length ||
    toIndex >= queue.length ||
    fromIndex === toIndex
  ) {
    return;
  }
  // FLIP animation: capture positions, mutate DOM, then animate deltas
  const list = plannerListEl();
  const children = list ? Array.from(list.children) : [];
  const firstRects = children.map((child) => child.getBoundingClientRect());

  const [moved] = queue.splice(fromIndex, 1);
  queue.splice(toIndex, 0, moved);
  state.planner.queue = queue;
  // re-render synchronously
  renderPlannerQueue();
  persistPlannerQueue();

  // animate from previous positions to the new positions
  const newChildren = list ? Array.from(list.children) : [];
  if (!list || !newChildren.length) return;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;
  newChildren.forEach((child, idx) => {
    const first = firstRects[idx];
    if (!first) return;
    const last = child.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (dx === 0 && dy === 0) return;
    child.animate(
      [
        { transform: `translate3d(${dx}px, ${dy}px, 0)`, easing: 'ease-out' },
        { transform: 'translate3d(0,0,0)' },
      ],
      { duration: 420, easing: 'cubic-bezier(.22,.9,.28,1)' }
    );
  });
};

const normalizePlannerMovie = (movie, runtime) => ({
  id: movie.id,
  title: movie.title,
  poster: movie.poster || MOVIE_PLACEHOLDER,
  posterSet: movie.posterSet || "",
  posterSizes: movie.posterSizes || "(max-width: 600px) 62vw, 220px",
  releaseDate: movie.releaseDate || "",
  rating: movie.rating || "NR",
  runtime: Number.isFinite(Number(runtime)) ? Number(runtime) : 0,
});

const queueMovie = async (movie, { silent = false, allowOpenPlanner = true } = {}) => {
  if (!movie || !movie.id) {
    return { added: false, reason: "invalid" };
  }
  if (
    state.planner.queue.some(
      (item) => Number(item.id) === Number(movie.id)
    )
  ) {
    if (!silent) {
      showToast(`"${movie.title}" is already in the planner.`, "info");
    }
    return { added: false, reason: "duplicate" };
  }
  if (state.planner.queue.length >= MAX_PLANNER_ITEMS) {
    if (!silent) {
      showToast("Planner limit reached. Remove an item to add more.", "error");
    }
    return { added: false, reason: "limit" };
  }
  const runtime = await getMovieRuntime(movie.id);
  const payload = normalizePlannerMovie(movie, runtime);
  state.planner.queue.push(payload);
  renderPlannerQueue();
  persistPlannerQueue();
  if (!silent) {
    showToast(`Added to planner: "${movie.title}"`, "success", {
      actionText: "Undo",
      actionHandler: () => removePlannerItem(movie.id),
    });
  }
  if (allowOpenPlanner && !isPlannerOpen()) {
    openPlannerDrawer();
  }
  triggerSoftHaptic(plannerDrawerEl());
  return { added: true, payload };
};

const queueMovieById = async (movieId, options = {}) => {
  if (!movieId) {
    return { added: false, reason: "invalid" };
  }
  const numericId = Number(movieId);
  const pools = [
    ...state.loadedMovies,
    ...state.favorites,
    ...state.watched,
    ...(state.searchOverlay.results.movies || []),
  ];
  let movie = pools.find((item) => Number(item.id) === numericId);
  if (!movie) {
    try {
      const details = await fetchMovieDetails(numericId);
      movie = buildMovieCard(details);
    } catch (error) {
      console.error("Unable to queue movie by id", error);
      showToast("Could not add that movie right now.", "error");
      return { added: false, reason: "fetch" };
    }
  }
  return queueMovie(movie, options);
};

const queuePersonHighlights = async (person) => {
  if (!person || !person.id) return;
  try {
    const response = await fetchPersonFilmography(person.id);
    const sorted = (response.cast || [])
      .filter((item) => item && item.id)
      .sort((a, b) => {
        const scoreA = Number(a.vote_average) || 0;
        const scoreB = Number(b.vote_average) || 0;
        if (scoreA === scoreB) {
          return (Number(b.popularity) || 0) - (Number(a.popularity) || 0);
        }
        return scoreB - scoreA;
      })
      .slice(0, 5)
      .map((entry) => buildMovieCard(entry));
    if (!sorted.length) {
      showToast(`No standout titles found for ${person.name}.`, "info");
      return;
    }
    let added = 0;
    for (const movie of sorted) {
      // eslint-disable-next-line no-await-in-loop
      const result = await queueMovie(movie, {
        silent: true,
        allowOpenPlanner: false,
      });
      if (result.added) {
        added += 1;
      }
    }
    if (added) {
      openPlannerDrawer();
      showToast(
        `Queued ${added} highlight${added === 1 ? "" : "s"} for ${person.name}.`,
        "success"
      );
    } else {
      showToast(
        `${person.name}'s highlights are already in your planner.`,
        "info"
      );
    }
  } catch (error) {
    console.error("Failed to queue person highlights", error);
    showToast("Unable to queue highlights right now.", "error");
  }
};

const queueCollection = async (collection) => {
  if (!collection || !collection.id) return;
  try {
    const details = await fetchCollectionDetails(collection.id);
    const picks = (details?.parts || []).slice(0, 6);
    if (!picks.length) {
      showToast("This collection has no films yet.", "info");
      return;
    }
    let added = 0;
    for (const movie of picks) {
      // eslint-disable-next-line no-await-in-loop
      const result = await queueMovie(movie, {
        silent: true,
        allowOpenPlanner: false,
      });
      if (result.added) {
        added += 1;
      }
    }
    if (added) {
      openPlannerDrawer();
      try { announceLive(`${added} title${added === 1 ? "" : "s"} added to planner from ${collection.name}.`); } catch (err) { /* noop */ }
      showToast(
        `Added ${added} title${added === 1 ? "" : "s"} from ${collection.name}.`,
        "success"
      );
    } else {
      showToast("Collection titles already queued.", "info");
    }
  } catch (error) {
    console.error("Unable to queue collection", error);
    showToast("Collection is unavailable right now.", "error");
  }
};

const openCollectionExperience = async (collectionId, collectionName = "Collection") => {
  if (!collectionId) return;
  showLoader();
  try {
    const collection = await fetchCollectionDetails(collectionId);
    hideLoader();
    if (!collection) {
      showToast("Could not load that collection.", "error");
      return;
    }
    openCollectionModal(collection, {
      onQueueMovie: async (movie) => {
        await queueMovie(movie, { silent: true });
      },
      onSelectMovie: async (movie) => {
        await openMovieDetails(movie.id);
      },
      onBulkQueue: async (movies) => {
        let added = 0;
        for (const movie of movies) {
          // eslint-disable-next-line no-await-in-loop
          const result = await queueMovie(movie, {
            silent: true,
            allowOpenPlanner: false,
          });
          if (result.added) {
            added += 1;
          }
        }
        if (added) {
          openPlannerDrawer();
          showToast(
            `Queued ${added} title${added === 1 ? "" : "s"} from ${collection.name}.`,
            "success"
          );
        } else {
          showToast("All collection titles already in planner.", "info");
        }
      },
    });
  } catch (error) {
    hideLoader();
    console.error("Failed to open collection experience", error);
    showToast(`"${collectionName}" is taking a break. Try again soon.`, "error");
  }
};

const handleCardDragStart = (event, movie) => {
  if (!event || !event.dataTransfer || !movie) return;
  try {
    event.dataTransfer.setData(DRAG_DATA_CARD_ID, String(movie.id));
  } catch (error) {
    event.dataTransfer.setData("text/plain", String(movie.id));
  }
  event.dataTransfer.effectAllowed = "copy";
  highlightPlannerDropZone(true);
};

const handleCardDragEnd = () => {
  highlightPlannerDropZone(false);
};

const getDragTypes = (event) =>
  Array.from(event?.dataTransfer?.types || [], (type) => String(type));

const isCardDragEvent = (event) => {
  const types = getDragTypes(event);
  return types.includes(DRAG_DATA_CARD_ID) || types.includes("text/plain");
};

const isPlannerDragEvent = (event) => {
  const types = getDragTypes(event);
  return types.includes(DRAG_DATA_PLANNER_INDEX);
};

const bindPlannerInteractions = () => {
  const dropZone = plannerDropZoneEl();
  if (dropZone && !dropZone.dataset.bound) {
    // Planner drop zone remains decorative; users must drag to the planner trigger (button)
    dropZone.addEventListener("dragover", (event) => {
      if (!isCardDragEvent(event)) return;
      event.preventDefault();
      // visual hint only
      highlightPlannerDropZone(true);
    });
    dropZone.addEventListener("dragleave", () => highlightPlannerDropZone(false));
    dropZone.dataset.bound = "true";
  }

  const list = plannerListEl();
  if (list && !list.dataset.bound) {
    list.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const item = button.closest(".planner-item");
      if (!item) return;
      const movieId = Number(item.dataset.id);
      const index = Number(item.dataset.index);
      const action = button.dataset.action;
      if (action === "remove") {
        removePlannerItem(movieId);
      } else if (action === "open") {
        await openMovieDetails(movieId);
      } else if (action === "move-up" || action === "move-down") {
        const targetIndex = action === "move-up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= state.planner.queue.length) {
          showToast("Cannot move further.", "info");
          return;
        }
        reorderPlannerItems(index, targetIndex);
        // Announce and toast the reorder for visibility and a11y
        const title = state.planner.queue[targetIndex]?.title || "item";
        showToast(`Moved "${title}" ${action === "move-up" ? "up" : "down"}.`, "success");
      }
    });

    list.addEventListener("dragstart", (event) => {
      const item = event.target.closest(".planner-item");
      if (!item) return;
      event.dataTransfer.setData(DRAG_DATA_PLANNER_INDEX, item.dataset.index);
      event.dataTransfer.effectAllowed = "move";
      item.classList.add("dragging");
    });

    list.addEventListener("dragend", (event) => {
      const item = event.target.closest(".planner-item");
      if (item) {
        item.classList.remove("dragging");
      }
    });

    list.addEventListener("dragover", (event) => {
      if (!isPlannerDragEvent(event) && !isCardDragEvent(event)) {
        return;
      }
      event.preventDefault();
      const target = event.target.closest(".planner-item");
      if (target) {
        target.classList.add("drop-target");
      }
      event.dataTransfer.dropEffect = isPlannerDragEvent(event)
        ? "move"
        : "copy";
    });

    list.addEventListener("dragleave", (event) => {
      const item = event.target.closest(".planner-item");
      if (item) {
        item.classList.remove("drop-target");
      }
    });

    list.addEventListener("drop", async (event) => {
      if (!isPlannerDragEvent(event) && !isCardDragEvent(event)) return;
      const target = event.target.closest(".planner-item");
      if (!target) return;
      event.preventDefault();
      target.classList.remove("drop-target");
      const targetIndex = Number(target.dataset.index);
      const sourceIndexRaw = event.dataTransfer.getData(DRAG_DATA_PLANNER_INDEX);
      if (sourceIndexRaw) {
        reorderPlannerItems(Number(sourceIndexRaw), targetIndex);
        return;
      }
      const cardId =
        event.dataTransfer.getData(DRAG_DATA_CARD_ID) ||
        event.dataTransfer.getData("text/plain");
      if (cardId) {
        const result = await queueMovieById(cardId, {
          silent: true,
          allowOpenPlanner: false,
        });
        if (result.added) {
          reorderPlannerItems(state.planner.queue.length - 1, targetIndex);
          openPlannerDrawer();
          showToast(
            `Queued "${result.payload.title}" into slot ${targetIndex + 1}.`,
            "success"
          );
        }
      }
    });

    list.dataset.bound = "true";
  }

  // Accept drops on the planner trigger button only (user must "throw" to the button)
  const plannerBtn = plannerTriggerButton();
  if (plannerBtn && !plannerBtn.dataset.dropBound) {
    plannerBtn.addEventListener("dragover", (event) => {
      if (!isCardDragEvent(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      plannerBtn.classList.add("drag-over");
    });
    plannerBtn.addEventListener("dragleave", () => plannerBtn.classList.remove("drag-over"));
    plannerBtn.addEventListener("drop", async (event) => {
      if (!isCardDragEvent(event)) return;
      event.preventDefault();
      plannerBtn.classList.remove("drag-over");
      const rawId =
        event.dataTransfer.getData(DRAG_DATA_CARD_ID) ||
        event.dataTransfer.getData("text/plain");
      if (rawId) {
        // play a visual throw from the source card to planner trigger
        try {
          await animateThrowWithTrail(String(rawId), plannerBtn);
        } catch (e) {
          // continue regardless of animation failure
        }
        // Queue silently and show a toast with Undo + pulse the planner trigger
        try {
          const result = await queueMovieById(rawId, { silent: true, allowOpenPlanner: false });
          if (result && result.added) {
            pulsePlannerTrigger();
            // Announce explicitly for assistive tech (silent queue + visual pulse)
            try { announceLive(`Queued "${result.payload.title}" for your session.`); } catch (err) { /* noop */ }
            showToast(`Queued "${result.payload.title}" for your session.`, "success", {
              actionText: "Undo",
              actionHandler: () => {
                // remove by id (will show its own undo toast)
                removePlannerItem(result.payload.id);
              },
            });
          }
        } catch (err) {
          console.error("Failed to queue via drop", err);
          showToast("Could not add that movie right now.", "error");
        }
      }
    });
    plannerBtn.dataset.dropBound = "true";
  }
};

/* Pulse planner trigger for a moment to indicate a successful silent queue */
const pulsePlannerTrigger = () => {
  const btn = plannerTriggerButton();
  if (!btn) return;
  btn.classList.add("pulse");
  const cleanup = () => btn.classList.remove("pulse");
  btn.addEventListener("animationend", cleanup, { once: true });
  // fallback cleanup
  window.setTimeout(cleanup, 700);
};

/* Pointer-based throw/flick detection: listen for fast pointer motions starting on movie cards.
 * If the user releases with sufficient velocity roughly aimed at the planner trigger,
 * treat it as a throw (animate + queue). This complements regular drag-and-drop.
 */
const bindThrowGestures = () => {
  const tracker = new Map();
  const thresholdPxPerSec = 900; // ~900px/s

  const queueToPlanner = async (movieId, plannerBtn) => {
    if (!plannerBtn || !movieId) return;
    try {
      await animateThrowWithTrail(String(movieId), plannerBtn);
    } catch (e) {
      // Animation failures should not block queuing.
    }
    try {
      const result = await queueMovieById(movieId, {
        silent: true,
        allowOpenPlanner: false,
      });
      if (result && result.added) {
        pulsePlannerTrigger();
        try {
          announceLive(`Queued "${result.payload.title}" for your session.`);
        } catch (err) {
          /* noop */
        }
        showToast(`Queued "${result.payload.title}" for your session.`, "success", {
          actionText: "Undo",
          actionHandler: () => removePlannerItem(result.payload.id),
        });
      }
    } catch (err) {
      console.error("Throw gesture queue failed", err);
    }
  };

  const clearPlannerHover = () => {
    const plannerBtn = plannerTriggerButton();
    if (plannerBtn) {
      plannerBtn.classList.remove("drag-over");
    }
  };

  const onPointerDown = (event) => {
    const card = event.target.closest('.movie-card');
    if (!card) return;
    // Only track primary pointers
    if (event.button && event.button !== 0) return;
    const id = event.pointerId;
    const now = performance.now();
    clearPlannerHover();
    tracker.set(id, {
      el: card,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startTime: now,
      lastTime: now,
      overPlanner: false,
    });
    card.setPointerCapture?.(id);
    try { startDragHint(event); } catch (e) { /* noop */ }
  };

  const onPointerMove = (event) => {
    const info = tracker.get(event.pointerId);
    if (!info) return;
    info.lastX = event.clientX;
    info.lastY = event.clientY;
    info.lastTime = performance.now();
    const plannerBtn = plannerTriggerButton();
    if (plannerBtn) {
      const rect = plannerBtn.getBoundingClientRect();
      const over =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (over !== info.overPlanner) {
        info.overPlanner = over;
        plannerBtn.classList.toggle("drag-over", over);
      }
    }
  };

  const onPointerUp = async (event) => {
    const info = tracker.get(event.pointerId);
    if (!info) return;
    tracker.delete(event.pointerId);
    try {
      event.target.releasePointerCapture?.(event.pointerId);
    } catch (e) {
      // ignore
    }
    try { stopDragHint(); } catch (e) { /* noop */ }
    const plannerBtn = plannerTriggerButton();
    const overPlanner = Boolean(info.overPlanner && plannerBtn);
    if (plannerBtn) {
      plannerBtn.classList.remove("drag-over");
    }

    // Identify movie id from element
    const movieId = info.el.dataset.movieId;
    if (!movieId) return;

    if (overPlanner && plannerBtn) {
      await queueToPlanner(movieId, plannerBtn);
      return;
    }

    if (!plannerBtn) return;

    const dx = info.lastX - info.startX;
    const dy = info.lastY - info.startY;
    const dt = Math.max(1, info.lastTime - info.startTime);
    const velocity = Math.sqrt(dx * dx + dy * dy) / dt * 1000; // px/sec
    if (velocity < thresholdPxPerSec) return;

    const cardRect = info.el.getBoundingClientRect();
    const sourceCenter = {
      x: cardRect.left + cardRect.width / 2,
      y: cardRect.top + cardRect.height / 2,
    };
    const targetRect = plannerBtn.getBoundingClientRect();
    const targetCenter = {
      x: targetRect.left + targetRect.width / 2,
      y: targetRect.top + targetRect.height / 2,
    };
    const toTarget = {
      x: targetCenter.x - sourceCenter.x,
      y: targetCenter.y - sourceCenter.y,
    };
    const moveVec = { x: dx, y: dy };
    const dot = toTarget.x * moveVec.x + toTarget.y * moveVec.y;
    const magA = Math.sqrt(toTarget.x * toTarget.x + toTarget.y * toTarget.y);
    const magB = Math.sqrt(moveVec.x * moveVec.x + moveVec.y * moveVec.y);
    if (magA === 0 || magB === 0) return;
    const cos = dot / (magA * magB);
    if (cos < 0.6) return;

    await queueToPlanner(movieId, plannerBtn);
  };

  const onPointerCancel = (event) => {
    if (tracker.has(event.pointerId)) {
      tracker.delete(event.pointerId);
      try { stopDragHint(); } catch (e) { /* noop */ }
    }
    clearPlannerHover();
  };

  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerup', onPointerUp, { passive: true });
  document.addEventListener('pointercancel', onPointerCancel);
};

// Wire up session planner drawer interactions (drag, save, clear, etc.).
const initPlannerDrawer = () => {
  hydrateSessionPlan();
  bindPlannerInteractions();
  // Tutorial overlay removed in favor of a hover-triggered demo (see ui.showHoverTutorial)
  const trigger = plannerTriggerButton();
  if (trigger) {
    trigger.addEventListener("click", () => {
      togglePlannerDrawer();
      triggerSoftHaptic(trigger);
    });
  }
  const closeBtn = plannerCloseButton();
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      closePlannerDrawer();
      triggerSoftHaptic(closeBtn);
    });
  }
  const saveBtn = plannerSaveButton();
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      persistPlannerQueue();
      showToast("Session plan saved locally.", "success");
      triggerSoftHaptic(saveBtn);
    });
  }
  const clearBtn = plannerClearButton();
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!state.planner.queue.length) {
        showToast("Your planner is already empty.", "info");
        return;
      }
      clearPlannerQueue();
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isPlannerOpen()) {
      closePlannerDrawer();
    }
  });
};
const updateLoadedMovies = (movies = [], { append = false } = {}) => {
  const sanitized = (movies || []).filter(Boolean);
  const source = append
    ? [...state.loadedMovies, ...sanitized]
    : [...sanitized];
  if (!source.length) {
    state.loadedMovies = [];
    return state.loadedMovies;
  }
  const deduped = [];
  const seen = new Set();
  for (let index = source.length - 1; index >= 0 && deduped.length < 300; index -= 1) {
    const movie = source[index];
    if (!movie || !movie.id) continue;
    if (seen.has(movie.id)) continue;
    seen.add(movie.id);
    deduped.push(movie);
  }
  state.loadedMovies = deduped.reverse();
  return state.loadedMovies;
};

const overlaySections = ["movies", "people", "collections"];
const overlayMaxItems = 8;

const getOverlayItems = (type) => {
  const list = searchResultsList(type);
  if (!list) return [];
  return Array.from(list.querySelectorAll(".search-result"));
};

const clearOverlayColumn = (type) => {
  const list = searchResultsList(type);
  if (list) {
    list.innerHTML = "";
  }
};

const buildSearchResult = (type, item, index) => {
  const li = document.createElement("li");
  li.className = "search-result";
  li.dataset.type = type;
  li.dataset.id = item.id;
  li.dataset.index = String(index);
  li.tabIndex = -1;
  li.setAttribute("role", "option");

  const main = document.createElement("div");
  main.className = "search-result-main";

  const thumb = document.createElement("div");
  thumb.className = "search-thumb";
  const img = document.createElement("img");
  img.alt = `${item.title || item.name} thumbnail`;
  lazyLoadImage(
    img,
    item.poster || item.profile || MOVIE_PLACEHOLDER,
    {
      srcset: item.posterSet || "",
      sizes: "(max-width: 768px) 34vw, 140px",
    }
  );
  thumb.appendChild(img);
  main.appendChild(thumb);

  const info = document.createElement("div");
  info.className = "search-result-info";
  const title = document.createElement("span");
  title.className = "search-result-title";
  title.textContent = item.title || item.name;
  const subtitle = document.createElement("span");
  subtitle.className = "search-result-sub";

  if (type === "movies") {
    const year = item.releaseDate ? item.releaseDate.split("-")[0] : "—";
    subtitle.textContent = `${year} • ★ ${item.rating || "NR"}`;
    li.dataset.mediaType = "movie";
  } else if (type === "people") {
    subtitle.textContent = `Known for: ${item.knownFor || "Acting"}`;
    li.dataset.mediaType = "person";
  } else {
    subtitle.textContent = item.overview
      ? `${item.overview.slice(0, 60)}…`
      : "Collection";
    li.dataset.mediaType = "collection";
  }
  info.append(title, subtitle);
  main.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "search-result-actions";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.dataset.action = "open";
  openBtn.innerHTML =
    type === "people"
      ? '<i class="fa-solid fa-film"></i>'
      : '<i class="fa-solid fa-play"></i>';

  const queueBtn = document.createElement("button");
  queueBtn.type = "button";
  queueBtn.dataset.action =
    type === "people" ? "queue-person" : type === "collections" ? "queue-collection" : "queue";
  queueBtn.innerHTML =
    type === "people"
      ? '<i class="fa-solid fa-users"></i>'
      : '<i class="fa-solid fa-list-check"></i>';

  actions.append(openBtn, queueBtn);
  li.append(main, actions);
  return li;
};

const renderOverlayColumn = (type, items = []) => {
  const list = searchResultsList(type);
  if (!list) return;
  list.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "No matches";
    list.appendChild(empty);
    return;
  }
  items.slice(0, overlayMaxItems).forEach((item, index) => {
    const element = buildSearchResult(type, item, index);
    list.appendChild(element);
  });
};

const renderSearchOverlay = () => {
  overlaySections.forEach((section) => {
    renderOverlayColumn(section, state.searchOverlay.results[section] || []);
  });
  updateOverlayActive();
};

const updateOverlayActive = () => {
  overlaySections.forEach((section) => {
    const items = getOverlayItems(section);
    items.forEach((item) => item.classList.remove("active"));
  });
  const items = getOverlayItems(state.searchOverlay.activeColumn);
  if (!items.length) return;
  const boundedIndex = Math.max(
    0,
    Math.min(state.searchOverlay.activeIndex, items.length - 1)
  );
  state.searchOverlay.activeIndex = boundedIndex;
  const activeItem = items[boundedIndex];
  if (activeItem) {
    activeItem.classList.add("active");
    activeItem.focus();
  }
};

const moveOverlaySelection = (delta) => {
  const items = getOverlayItems(state.searchOverlay.activeColumn);
  if (!items.length) return;
  const nextIndex = (state.searchOverlay.activeIndex + delta + items.length) % items.length;
  state.searchOverlay.activeIndex = nextIndex;
  updateOverlayActive();
};

const cycleOverlayColumn = (direction) => {
  const currentIndex = overlaySections.indexOf(state.searchOverlay.activeColumn);
  const nextIndex = (currentIndex + direction + overlaySections.length) % overlaySections.length;
  state.searchOverlay.activeColumn = overlaySections[nextIndex];
  state.searchOverlay.activeIndex = 0;
  updateOverlayActive();
};

const getActiveOverlayItem = () => {
  const column = state.searchOverlay.activeColumn;
  const items = state.searchOverlay.results[column] || [];
  if (!items.length) return null;
  const index = Math.max(
    0,
    Math.min(state.searchOverlay.activeIndex, items.length - 1)
  );
  const data = items[index];
  return data ? { column, index, data } : null;
};

const performOverlaySearch = async (query) => {
  if (!query || !query.trim()) {
    state.searchOverlay.results = {
      movies: [],
      people: [],
      collections: [],
    };
    renderSearchOverlay();
    return;
  }
  try {
    const [moviesRes, peopleRes, collectionsRes] = await Promise.all([
      searchMovies(query, 1),
      searchPeople(query, 1),
      searchCollections(query, 1),
    ]);
    state.searchOverlay.results = {
      movies: moviesRes.results || [],
      people: peopleRes.results || [],
      collections: collectionsRes.results || [],
    };
    renderSearchOverlay();
  } catch (error) {
    console.error("Search overlay failed", error);
    showToast("Search is taking a break. Try again shortly.", "error");
  }
};

const debouncedOverlaySearch = debounce(performOverlaySearch, SEARCH_DEBOUNCE);

const handleOverlayItemSelect = async ({ column, data }) => {
  if (!data || !data.id) return;
  if (column === "movies") {
    closeSearchOverlay();
    await openMovieDetails(data.id);
  } else if (column === "people") {
    closeSearchOverlay();
    await openCastFilmography({
      id: data.id,
      name: data.name,
      character: data.knownFor || "",
      profile: data.profile,
    });
  } else if (column === "collections") {
    closeSearchOverlay();
    await openCollectionExperience(data.id, data.name);
  }
};

const handleOverlayButtonAction = (action, data, column) => {
  if (!data) return;
  switch (action) {
    case "open":
      handleOverlayItemSelect({ column, data });
      break;
    case "queue":
      queueMovie(data);
      triggerSoftHaptic(searchOverlayPanel());
      break;
    case "queue-person":
      queuePersonHighlights(data);
      break;
    case "queue-collection":
      queueCollection(data);
      break;
    default:
      break;
  }
};

const handleOverlayBulkAction = async (target) => {
  const items = state.searchOverlay.results[target] || [];
  if (!items.length) {
    showToast("No items to add just yet.", "info");
    return;
  }
  if (target === "movies") {
    const toAdd = items.slice(0, overlayMaxItems);
    for (const item of toAdd) {
      // eslint-disable-next-line no-await-in-loop
      await queueMovie(item, { silent: true, allowOpenPlanner: false });
    }
    try { announceLive(`Added ${Math.min(items.length, overlayMaxItems)} movies to planner.`); } catch (err) { /* noop */ }
    showToast(`Added ${Math.min(items.length, overlayMaxItems)} movies to planner.`, "success");
  } else if (target === "people") {
    queuePersonHighlights(items[0]);
  } else if (target === "collections") {
    queueCollection(items[0]);
  }
};

const setSearchOverlayVisibility = (open) => {
  const overlay = searchOverlayEl();
  if (!overlay) return;
  if (open) {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    loadStylesheetOnce("styles/overlays.css");
  } else {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    overlaySections.forEach((section) => clearOverlayColumn(section));
  }
};

const openSearchOverlay = () => {
  if (state.searchOverlay.open) return;
  state.searchOverlay.open = true;
  setSearchOverlayVisibility(true);
  state.searchOverlay.activeColumn = "movies";
  state.searchOverlay.activeIndex = 0;
  updateOverlayActive();
};

const closeSearchOverlay = () => {
  if (!state.searchOverlay.open) return;
  state.searchOverlay.open = false;
  setSearchOverlayVisibility(false);
  state.searchOverlay.results = {
    movies: [],
    people: [],
    collections: [],
  };
  state.searchOverlay.activeIndex = 0;
};

const categoryFetchers = {
  trending: fetchTrending,
  popular: fetchPopular,
  top_rated: fetchTopRated,
  upcoming: fetchUpcoming,
};

const searchInput = () => document.getElementById("search-input");

const getGenreSignature = () => {
  if (!Array.isArray(state.selectedGenres) || !state.selectedGenres.length) {
    return "all";
  }
  return state.selectedGenres
    .slice()
    .map((id) => String(id))
    .sort()
    .join(",");
};

const getBrowseSignature = () => {
  const genre = getGenreSignature();
  const query = (state.searchQuery || "").trim().toLowerCase();
  return `${state.category}|${genre}|${query}`;
};

const clearPrefetch = () => {
  state.prefetch = null;
  state.prefetchToken = null;
};

const schedulePrefetch = (signature) => {
  const nextPage = state.page + 1;
  if (!Number.isFinite(state.totalPages) || nextPage > state.totalPages) {
    clearPrefetch();
    return;
  }
  if (
    state.prefetch &&
    state.prefetch.signature === signature &&
    state.prefetch.page === nextPage
  ) {
    return;
  }

  const token = `${signature}|${nextPage}|${Date.now()}`;
  state.prefetchToken = token;

  runIdle(async () => {
    try {
      let response;
      if (state.category === "search") {
        if (!state.searchQuery?.trim()) {
          if (state.prefetchToken === token) {
            state.prefetchToken = null;
          }
          state.prefetch = null;
          return;
        }
        response = await searchMovies(state.searchQuery, nextPage);
      } else if (state.category === "genre" && state.selectedGenres.length) {
        response = await fetchMoviesByGenre(state.selectedGenres, nextPage);
      } else {
        const fetcher = categoryFetchers[state.category] || fetchTrending;
        response = await fetcher(nextPage);
      }

      if (state.prefetchToken !== token) return;

      state.prefetch = {
        signature,
        page: nextPage,
        data: response,
      };
    } catch (error) {
      if (state.prefetchToken === token) {
        state.prefetch = null;
      }
    } finally {
      if (state.prefetchToken === token) {
        state.prefetchToken = null;
      }
    }
  }, 160);
};

const resetPagination = () => {
  state.page = 1;
  state.totalPages = Infinity;
  state.lastScrollLoad = 0;
  state.loadedMovies = [];
  clearPrefetch();
};

// Reload favourites list from storage and sync dependent UI metrics.
const refreshFavorites = () => {
  state.favorites = getFavorites();
  return state.favorites;
};

// Reload watched list from storage and sync dependent UI metrics.
const refreshWatched = () => {
  state.watched = getWatched();
  return state.watched;
};

// Toggle favourite state and trigger follow-up UI updates.
const handleFavoriteToggle = (movie) => {
  const nowFavorite = toggleFavorite(movie);
  refreshFavorites();
  return nowFavorite;
};

// Toggle watched state and trigger follow-up UI updates.
const handleWatchedToggle = (movie) => {
  const nowWatched = toggleWatched(movie);
  refreshWatched();
  return nowWatched;
};

// Determine the section title based on current category/search filters.
const buildMovieTitleForSection = () => {
  if (state.category === "search" && state.searchQuery) {
    return `Results for "${state.searchQuery}"`;
  }
  if (state.category === "genre") {
    if (!state.selectedGenres.length) {
      return "All Genres";
    }
    const names = state.selectedGenres
      .map((id) =>
        state.genres.find((genre) => String(genre.id) === String(id))?.name
      )
      .filter(Boolean);
    const label = names.length ? names.join(", ") : "Selected Genres";
    return `Genres • ${label}`;
  }
  switch (state.category) {
    case "popular":
      return "Popular Hits";
    case "top_rated":
      return "Top Rated";
    case "upcoming":
      return "Coming Soon";
    default:
      return DEFAULT_SECTION_TITLE;
  }
};

// Render a batch of movie cards into the grid (append or replace).
const renderMovies = (results, { append = false } = {}) => {
  renderMovieGrid(results, {
    append,
    favorites: state.favorites,
    watched: state.watched,
    context: {
      category: state.category,
      hasGenreFilters: state.selectedGenres.length > 0,
      searchQuery: state.searchQuery,
      isDefaultCategory: state.category === DEFAULT_CATEGORY,
    },
    onCardClick: async (movie) => {
      await openMovieDetails(movie.id);
    },
    onFavoriteToggle: handleFavoriteToggle,
    onWatchedToggle: handleWatchedToggle,
    onPlannerDragStart: handleCardDragStart,
    onPlannerDragEnd: handleCardDragEnd,
  });
};

const disableElements = (selectors = []) => {
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (!element) return;
      if ("disabled" in element) {
        element.disabled = true;
      }
      element.setAttribute("aria-disabled", "true");
      element.setAttribute("tabindex", "-1");
      element.style.pointerEvents = "none";
    });
  });
};

const renderMissingApiKeyState = () => {
  const grid = document.getElementById("movies-grid");
  if (!grid || grid.dataset.missingKey === "true") return;
  grid.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state missing-api-key";
  const heading = document.createElement("h3");
  heading.textContent = "TMDB API key required";
  const message = document.createElement("p");
  message.textContent =
    "MovieVault needs a TMDB API key before it can load live data.";
  const instructions = document.createElement("p");
  instructions.textContent =
    'Update scripts/config.js with your TMDB API key, then reload the page.';
  const reassurance = document.createElement("p");
  reassurance.textContent = "Your key stays on this device only.";
  wrapper.append(heading, message, instructions, reassurance);
  grid.appendChild(wrapper);
  grid.dataset.missingKey = "true";
};

const handleMissingApiKey = () => {
  if (missingApiKeyHandled) return;
  missingApiKeyHandled = true;
  state.tmdbReady = false;
  state.loading = false;
  state.page = 1;
  state.totalPages = 0;
  clearPrefetch();
  renderMissingApiKeyState();
  hideLoader();
  const loader = document.getElementById("loader");
  if (loader) {
    loader.classList.add("hidden");
    loader.setAttribute("aria-hidden", "true");
  }
  const input = searchInput();
  if (input) {
    input.disabled = true;
    input.value = "";
    input.placeholder = "Add your TMDB API key to enable search";
    input.setAttribute("aria-disabled", "true");
  }
  disableElements([
    ".nav-link",
    "#genre-dropdown-trigger",
    "#genre-clear",
    ".genre-chip",
    ".search-column-action",
    "#favorites-trigger",
    "#watched-trigger",
    "#planner-trigger",
    "#planner-save",
    "#planner-clear",
  ]);
  if (document?.body) {
    document.body.classList.add("missing-api-key");
  }
  updateSectionTitle("Add your TMDB API key");
  showToast(
    "Add your TMDB API key in scripts/config.js to browse movies.",
    "warning"
  );
  announceLive(
    "TMDB API key missing. Update scripts/config.js with your key and reload to browse movies."
  );
};

// Fetch movies for the current view and render the grid.
// Core data loader: fetch current feed (category/genre/search) and render.
const loadMovies = async ({ append = false } = {}) => {
  if (!state.tmdbReady) {
    handleMissingApiKey();
    return;
  }
  if (state.loading) return;
  if (state.page > state.totalPages) return;
  state.loading = true;
  const signature = getBrowseSignature();
  let response;
  const prefetchMatch =
    state.prefetch &&
    state.prefetch.signature === signature &&
    state.prefetch.page === state.page;
  const shouldShowLoader = !prefetchMatch && !append;
  if (shouldShowLoader) {
    showLoader();
  }
  try {
    if (prefetchMatch) {
      response = state.prefetch.data;
      state.prefetch = null;
      state.prefetchToken = null;
    } else {
      if (state.category === "search") {
        response = await searchMovies(state.searchQuery, state.page);
      } else if (state.category === "genre" && state.selectedGenres.length) {
        response = await fetchMoviesByGenre(state.selectedGenres, state.page);
      } else {
        const fetcher = categoryFetchers[state.category] || fetchTrending;
        response = await fetcher(state.page);
      }
    }
    state.totalPages = response.total_pages || state.totalPages;
    const results = response.results || [];
   const appendMode = append || state.page > 1;
   updateLoadedMovies(results, { append: appendMode });
   renderMovies(results, { append: appendMode });
    updateSectionTitle(buildMovieTitleForSection());
    schedulePrefetch(signature);
  } catch (error) {
    console.error("Failed to load movies", error);
    if (!append) {
      clearPrefetch();
    }
  } finally {
    if (shouldShowLoader) {
      hideLoader();
    }
    state.loading = false;
  }
};

// Load full details and trailer for the chosen movie.
// Open the movie modal with full detail payload and supporting metadata.
const openMovieDetails = async (movieId) => {
  if (!state.tmdbReady) {
    handleMissingApiKey();
    return;
  }
  showLoader();
  try {
    const details = await fetchMovieDetails(movieId);
    const videos = (details?.videos?.results || []).filter(Boolean);
    const trailerCandidate =
      videos.find(
        (video) =>
          video.type === "Trailer" && video.site === "YouTube" && video.key
      ) ||
      videos.find(
        (video) =>
          video.type === "Teaser" && video.site === "YouTube" && video.key
      ) ||
      videos.find((video) => video.site === "YouTube" && video.key);
    const trailerUrl = trailerCandidate
      ? `https://www.youtube.com/embed/${trailerCandidate.key}`
      : null;
    if (!trailerUrl && videos.length) {
      console.info("No embeddable trailer found for this title.");
      showToast("Trailer unavailable. Showing movie details only.", "info");
    }
    const castMembers = (details.credits?.cast || [])
      .filter((member) => member && member.id)
      .slice(0, 16)
      .map((member) => ({
        id: member.id,
        name: member.name,
        character: member.character,
        profile: member.profile_path
          ? `${CONFIG.TMDB_IMAGE_BASE}/w185${member.profile_path}`
          : "assets/placeholders/poster-fallback.png",
      }));

    const movie = {
      id: details.id,
      title: details.title || details.name,
      rating: Number.isFinite(Number(details.vote_average))
        ? Number(details.vote_average).toFixed(1)
        : "NR",
      releaseDate:
        details.release_date || details.first_air_date || "Unknown date",
      poster: details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : MOVIE_PLACEHOLDER,
      overview: details.overview || "Synopsis unavailable for this title.",
      voteCount: details.vote_count,
    };
    const favorite = isFavorite(movieId);
    const watched = isWatched(movieId);
    openMovieModal(movie, {
      trailerUrl,
      cast: castMembers,
      onFavoriteToggle: handleFavoriteToggle,
      onWatchedToggle: handleWatchedToggle,
      onCastSelect: async (member) => {
        await openCastFilmography(member);
      },
      isFavorite: favorite,
      isWatched: watched,
    });
  } catch (error) {
    console.error("Unable to open movie details", error);
    showToast("We could not load that movie. Please try another.", "error");
  } finally {
    hideLoader();
  }
};

const handleSearchSelection = (item) => {
  state.searchQuery = item.title;
  state.category = "search";
  state.selectedGenres = [];
  resetPagination();
  setActiveGenreChip(state.selectedGenres);
  updateGenreTriggerSummary(state.selectedGenres, state.genres);
  syncGenreClearButtonState();
  const input = searchInput();
  if (input) {
    input.value = item.title;
  }
  setActiveNav("");
  closeGenreDropdown();
  clearSuggestions();
  closeDrawer();
  loadMovies();
};

const performSearch = async (query) => {
  const trimmed = query.trim();
  if (!trimmed) {
    clearSuggestions();
    return;
  }
  try {
    const response = await searchMovies(trimmed, 1);
    const suggestions = (response.results || []).slice(0, MAX_SUGGESTIONS);
    renderSuggestions(
      suggestions.map((movie) => ({
        id: movie.id,
        title: movie.title,
      })),
      handleSearchSelection
    );
  } catch (error) {
    console.error("Search suggestions failed", error);
  }
};

const debouncedSearch = debounce(performSearch, SEARCH_DEBOUNCE);

// Wire up search input (debounced fetch + overlay interactions).
const attachSearch = () => {
  const input = searchInput();
  if (!input) return;
  input.addEventListener("focus", () => {
    if (input.value.trim()) {
      openSearchOverlay();
      debouncedOverlaySearch(input.value.trim());
    }
  });

  input.addEventListener("input", (event) => {
    const value = event.target.value;
    state.searchQuery = value;
    if (!value.trim()) {
      closeSearchOverlay();
      return;
    }
    if (!state.searchOverlay.open) {
      openSearchOverlay();
    }
    debouncedOverlaySearch(value.trim());
  });

  const handleOverlayKeyNav = (event) => {
    if (!state.searchOverlay.open) return;
    const { key } = event;
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter", "Escape", "Tab"].includes(key)) {
      event.preventDefault();
    }
    if (key === "ArrowDown") {
      moveOverlaySelection(1);
    } else if (key === "ArrowUp") {
      moveOverlaySelection(-1);
    } else if (key === "ArrowRight") {
      cycleOverlayColumn(1);
    } else if (key === "ArrowLeft") {
      cycleOverlayColumn(-1);
    } else if (key === "Enter" || key === "Tab") {
      const active = getActiveOverlayItem();
      if (active) {
        handleOverlayItemSelect(active);
      }
    } else if (key === "Escape") {
      closeSearchOverlay();
      input.blur();
    }
  };

  input.addEventListener("keydown", handleOverlayKeyNav);

  document.addEventListener("keydown", (event) => {
    if (!state.searchOverlay.open) return;
    if (event.target.closest(".search-overlay")) {
      handleOverlayKeyNav(event);
    }
  });
};

// Hook up interactions inside the search modal (click, keyboard, hover).
const bindSearchOverlayInteractions = () => {
  const overlay = searchOverlayEl();
  if (!overlay) return;
  overlay.addEventListener("click", (event) => {
    if (event.target.classList.contains("search-overlay-backdrop")) {
      closeSearchOverlay();
      return;
    }
    const result = event.target.closest(".search-result");
    if (result) {
      const column = result.dataset.type;
      const index = Number(result.dataset.index || "0");
      state.searchOverlay.activeColumn = column;
      state.searchOverlay.activeIndex = index;
      updateOverlayActive();
      const data = state.searchOverlay.results[column]?.[index];
      const actionBtn = event.target.closest("button[data-action]");
      if (actionBtn) {
        handleOverlayButtonAction(actionBtn.dataset.action, data, column);
      } else {
        handleOverlayItemSelect({ column, data });
      }
    }
  });

  overlay.addEventListener("mousemove", (event) => {
    const result = event.target.closest(".search-result");
    if (!result || !state.searchOverlay.open) return;
    const column = result.dataset.type;
    const index = Number(result.dataset.index || "0");
    if (column !== state.searchOverlay.activeColumn || index !== state.searchOverlay.activeIndex) {
      state.searchOverlay.activeColumn = column;
      state.searchOverlay.activeIndex = index;
      updateOverlayActive();
    }
  });

  overlay.addEventListener("keydown", (event) => {
    if (!state.searchOverlay.open) return;
    if (event.key === "Escape") {
      closeSearchOverlay();
    }
  });

  searchColumnActionButtons().forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;
      handleOverlayBulkAction(target);
    });
  });
};

// Bootstrap the genre dropdown: fetch list, render chips, attach listeners.
const attachGenreFilter = async () => {
  const track = document.getElementById("genre-chip-track");
  if (!track) return;
  if (!state.tmdbReady) {
    state.genres = [];
    renderGenreOptions(state.genres, state.selectedGenres);
    setActiveGenreChip(state.selectedGenres);
    updateGenreTriggerSummary(state.selectedGenres, state.genres);
    syncGenreClearButtonState();
    disableElements(["#genre-dropdown-trigger", "#genre-clear", ".genre-chip"]);
    return;
  }
  try {
    state.genres = await fetchGenres();
  } catch (error) {
    console.error("Unable to load genre list", error);
    state.genres = [];
  }
  renderGenreOptions(state.genres, state.selectedGenres);
  setActiveGenreChip(state.selectedGenres);
  updateGenreTriggerSummary(state.selectedGenres, state.genres);
  const clearButton = document.getElementById("genre-clear");
  syncGenreClearButtonState();

  const commitSelection = (nextSelection = []) => {
    const previousSignature = getGenreSignature();
    state.selectedGenres = Array.isArray(nextSelection)
      ? nextSelection.map((id) => String(id))
      : [];
    const nextSignature = getGenreSignature();
    setActiveGenreChip(state.selectedGenres);
    updateGenreTriggerSummary(state.selectedGenres, state.genres);
    syncGenreClearButtonState();
    if (previousSignature === nextSignature) {
      return;
    }
    state.searchQuery = "";
    const searchField = searchInput();
    if (searchField) searchField.value = "";
    resetPagination();

    if (state.selectedGenres.length) {
      state.category = "genre";
      setActiveNav("");
    } else {
      if (state.category === "genre" || state.category === "search") {
        state.category = DEFAULT_CATEGORY;
      }
      setActiveNav(state.category);
    }

    loadMovies({ append: false });
  };

  const toggleGenre = (value) => {
    const normalized = String(value ?? "");
    if (!normalized || normalized === "all") {
      commitSelection([]);
      return;
    }
    const current = new Set(state.selectedGenres.map((id) => String(id)));
    if (current.has(normalized)) {
      current.delete(normalized);
    } else {
      current.add(normalized);
    }
    commitSelection(Array.from(current));
  };

  // Clicking any chip toggles it in the active genre set.
  track.addEventListener("click", (event) => {
    event.stopPropagation();
    const chip = event.target.closest(".genre-chip");
    if (!chip) return;
    toggleGenre(chip.dataset.genre);
  });

  const badges = document.getElementById("selected-genres");
  if (badges) {
    // Clicking a pill badge removes that individual genre.
    badges.addEventListener("click", (event) => {
      const badge = event.target.closest(".selected-genre-badge");
      if (!badge) return;
      event.preventDefault();
      toggleGenre(badge.dataset.removeGenre);
    });
  }

  if (clearButton) {
    // Clear button resets the filter stack in one action.
    clearButton.addEventListener("click", (event) => {
      event.preventDefault();
      commitSelection([]);
      closeGenreDropdown();
    });
  }

  document.addEventListener("movievault:clear-filters", () => {
    commitSelection([]);
  });
};

// Listen for CTA clicks inside empty state panels.
const attachEmptyStateActions = () => {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-empty-action]");
    if (!trigger) return;
    const action = trigger.dataset.emptyAction;
    if (action === "reset-filters") {
      document.dispatchEvent(new Event("movievault:clear-filters"));
      closeGenreDropdown();
    } else if (action === "view-trending") {
      state.category = DEFAULT_CATEGORY;
      document.dispatchEvent(new Event("movievault:clear-filters"));
      closeGenreDropdown();
    }
  });
};

// Manage accessibility + dismissal for the dropdown surface.
const attachGenreDropdown = () => {
  const trigger = genreDropdownTriggerEl();
  const dropdown = genreDropdownContainer();
  const group = trigger?.closest(".genre-dropdown-group");
  if (!trigger || !dropdown || !group) return;

  const openDropdown = () => {
    setGenreDropdownOpen(true);
  };

  const closeNow = () => {
    closeGenreDropdown();
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextState = !genreDropdownOpen;
    setGenreDropdownOpen(nextState);
    if (!nextState) {
      trigger.blur();
    }
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const nextState = !genreDropdownOpen;
      setGenreDropdownOpen(nextState);
      if (!nextState) {
        trigger.blur();
      }
    }
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && genreDropdownOpen) {
      closeNow();
      trigger.blur();
    }
  });

  dropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  dropdown.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && genreDropdownOpen) {
      closeNow();
      trigger.focus({ preventScroll: true });
    }
  });

  dropdown.addEventListener("focusout", (event) => {
    if (!genreDropdownOpen) return;
    const nextTarget = event.relatedTarget;
    if (!group.contains(nextTarget)) {
      closeNow();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!genreDropdownOpen) return;
    if (group.contains(event.target)) return;
    closeNow();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && genreDropdownOpen) {
      closeNow();
      trigger.focus({ preventScroll: true });
    }
  });

  window.addEventListener("resize", closeNow);
  window.addEventListener("scroll", closeNow, { passive: true });
};

// Attach click handlers to the top-level category chips.
const attachNav = () => {
  const buttons = document.querySelectorAll(".nav-link");
  buttons.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const category = btn.dataset.category || DEFAULT_CATEGORY;
      state.category = category;
      state.selectedGenres = [];
      state.searchQuery = "";
      const input = searchInput();
      if (input) input.value = "";
      resetPagination();
      setActiveNav(category);
      setActiveGenreChip(state.selectedGenres);
      updateGenreTriggerSummary(state.selectedGenres, state.genres);
      syncGenreClearButtonState();
      closeGenreDropdown();
      loadMovies({ append: false });
    });
  });
};

// Update scroll progress bar + back-to-top button visibility.
const updateScrollState = () => {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const viewport = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const ratio = docHeight > 0 ? (scrollTop + viewport) / docHeight : 0;
  updateScrollProgress(Math.min(1, ratio));
  setBackToTopVisibility(scrollTop > 600);
  scrollTicking = false;
};

const handleScroll = () => {
  if (scrollTicking) return;
  scrollTicking = true;
  window.requestAnimationFrame(updateScrollState);
};

// Throttle scroll events to avoid jank while updating UI affordances.
const attachScrollListener = () => {
  window.addEventListener("scroll", handleScroll, { passive: true });
};

// IntersectionObserver callback: fetch next page when sentinel appears.
const maybeLoadMore = () => {
  if (state.loading) return;
  if (state.page >= state.totalPages) return;
  const now = Date.now();
  if (now - state.lastScrollLoad < INFINITE_SCROLL_COOLDOWN) return;
  state.page += 1;
  state.lastScrollLoad = now;
  loadMovies({ append: true });
};

// Kick off infinite scrolling by watching the sentinel element.
const initInfiniteScrollObserver = () => {
  const sentinel = scrollSentinelEl();
  if (!sentinel) return;
  if (infiniteObserver) {
    infiniteObserver.disconnect();
  }
  infiniteObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          maybeLoadMore();
        }
      });
    },
    {
      root: null,
      rootMargin: INFINITE_SCROLL_ROOT_MARGIN,
      threshold: 0,
    }
  );
  infiniteObserver.observe(sentinel);
};

// Flip between light and dark theme.
const toggleTheme = () => {
  const current = document.body.dataset.theme || THEMES.dark.key;
  const next = current === THEMES.dark.key ? THEMES.light : THEMES.dark;
  const applied = setTheme(next, { silent: false });
  updateThemeButton(applied);
};

const initializeTheme = () => {
  const stored = getStoredTheme();
  const applied = setTheme(stored, { silent: true });
  updateThemeButton(applied);
  configureThemeToggle(toggleTheme);
};

const openFavorites = () => {
  if (!state.tmdbReady) {
    handleMissingApiKey();
    return;
  }
  refreshFavorites();
  openFavoritesModal(state.favorites, async (fav) => {
    await openMovieDetails(fav.id);
  });
};

const openWatched = () => {
  if (!state.tmdbReady) {
    handleMissingApiKey();
    return;
  }
  refreshWatched();
  openWatchedModal(state.watched, async (item) => {
    await openMovieDetails(item.id);
  });
};

// Give focus to the primary header search input.
const focusSearch = () => {
  const input = searchInput();
  if (input) {
    input.focus();
  }
};

const openCastFilmography = async (member) => {
  if (!state.tmdbReady) {
    handleMissingApiKey();
    return;
  }
  if (!member || !member.id) return;
  showLoader();
  let loaderVisible = true;
  try {
    const response = await fetchPersonFilmography(member.id);
    const movies = (response.cast || [])
      .filter((movie) => movie && movie.id)
      .map((movie) => buildMovieCard(movie))
      .slice(0, 30);
    hideLoader();
    loaderVisible = false;
    openCastFilmographyModal(member, movies, {
      favorites: state.favorites,
      watched: state.watched,
      onFavoriteToggle: handleFavoriteToggle,
      onWatchedToggle: handleWatchedToggle,
      onMovieSelect: async (movie) => {
        await openMovieDetails(movie.id);
      },
    });
  } catch (error) {
    console.error("Unable to load cast filmography", error);
    showToast("Unable to load this actor's filmography right now.", "error");
  } finally {
    if (loaderVisible) {
      hideLoader();
    }
  }
};

const initFavoritesButton = () => {
  const btn = document.getElementById("favorites-trigger");
  if (!btn) return;
  btn.addEventListener("click", openFavorites);
};

const initWatchedButton = () => {
  const btn = document.getElementById("watched-trigger");
  if (!btn) return;
  btn.addEventListener("click", openWatched);
};

// Initialise the mobile drawer with action routing.
const initDrawer = () => {
  configureDrawer({
    [DRAWER_ACTIONS.SEARCH]: focusSearch,
    [DRAWER_ACTIONS.FAVORITES]: openFavorites,
    [DRAWER_ACTIONS.WATCHED]: openWatched,
    [DRAWER_ACTIONS.THEME]: toggleTheme,
    [DRAWER_ACTIONS.CLOSE]: closeDrawer,
  });
};

// Lazy-load non-critical UI effects to keep initial load crisp.
const hydrateOptionalUI = () => {
  runIdle(() => {
    try {
      bindRippleEffect();
      bindThrowGestures();
    } catch (error) {
      console.debug("Optional UI hydration failed", error);
    }
  }, 300);
};

// Entry point: hydrate storage, bind UI, fetch initial data, start observers.
const initializeApp = async () => {
  state.tmdbReady = hasTmdbApiKey();
  refreshFavorites();
  refreshWatched();
  initializeTheme();
  bindBackToTop();
  updateScrollProgress(0);
  attachScrollListener();
  updateScrollState();
  attachGenreDropdown();
  closeGenreDropdown();
  attachNav();
  attachSearch();
  bindSearchOverlayInteractions();
  attachEmptyStateActions();
  initFavoritesButton();
  initWatchedButton();
  initPlannerDrawer();
  initDrawer();
  setActiveNav(DEFAULT_CATEGORY);
  // demo speed control removed; hover tutorial always uses slowest tempo per preference
  updateSectionTitle(DEFAULT_SECTION_TITLE);
  if (!state.tmdbReady) {
    handleMissingApiKey();
    return;
  }
  await attachGenreFilter();
  await loadMovies();
  initInfiniteScrollObserver();
  hydrateOptionalUI();
};

document.addEventListener("DOMContentLoaded", initializeApp);
