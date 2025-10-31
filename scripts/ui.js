// ============================================================================
// UI UTILITIES & STRUCTURE
// ============================================================================
// Centralised DOM manipulation helpers and micro-interactions for MovieVault.

import { createEl, lazyLoadImage, scrollToTop, runIdle, observeWhenVisible } from "./helpers.js";
import {
  FAVORITE_BADGE_TEXT,
  WATCHED_BADGE_TEXT,
  THEMES,
  DRAWER_ACTIONS,
  TUTORIAL_ANIMATION_MULTIPLIER,
} from "./constants.js";

// ----------------------------------------------------------------------------
// DOM LOOKUPS
// ----------------------------------------------------------------------------

const gridEl = () => document.getElementById("movies-grid");
const suggestionsEl = () => document.getElementById("search-suggestions");
const sectionTitleEl = () => document.getElementById("movie-section-title");
const genreTrackEl = () => document.getElementById("genre-chip-track");
const genreDropdownEl = () => document.getElementById("genre-dropdown");
const genreDropdownTrigger = () => document.getElementById("genre-dropdown-trigger");
const genreSummaryEls = () => document.querySelectorAll("[data-genre-summary]");
const loaderOverlay = () => document.getElementById("loader");
const backToTopBtn = () => document.getElementById("back-to-top");
const modalRoot = () => document.getElementById("modal-root");
const themeToggleBtn = () => document.getElementById("theme-toggle");
const mobileDrawer = () => document.getElementById("mobile-drawer");
const drawerBody = () =>
  document.querySelector("#mobile-drawer .drawer-body");
const scrollProgressBar = () => document.getElementById("scroll-progress");
const selectedGenresContainer = () => document.getElementById("selected-genres");

let modalStack = [];
let drawerHandlers = {};
let loaderAnimation = null;
const draggedTracks = new WeakSet();

const gsapAvailable = () => typeof window.gsap !== "undefined";

// ----------------------------------------------------------------------------
// CARD ANIMATIONS
// ----------------------------------------------------------------------------

/* Visual "throw" animation: clone the source card's poster and animate it to the target (planner trigger).
 * Returns a promise that resolves when the animation completes.
 */
export const animateThrowToTrigger = (movieId, targetEl, options = {}) =>
  new Promise((resolve) => {
    if (!movieId || !targetEl) {
      resolve();
      return;
    }
    const source = document.querySelector(`[data-movie-id="${movieId}"]`);
    if (!source) {
      resolve();
      return;
    }
    const poster = source.querySelector(".movie-poster") || source.querySelector("img");
    if (!poster) {
      resolve();
      return;
    }
    const srcRect = poster.getBoundingClientRect();
    const dstRect = targetEl.getBoundingClientRect();

    const clone = poster.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.left = `${srcRect.left}px`;
    clone.style.top = `${srcRect.top}px`;
    clone.style.width = `${srcRect.width}px`;
    clone.style.height = `${srcRect.height}px`;
    clone.style.zIndex = 9999;
    clone.style.pointerEvents = "none";
    clone.style.borderRadius = window.getComputedStyle(source).borderRadius || "12px";
    clone.style.boxShadow = "0 18px 40px rgba(0,0,0,0.6)";
    document.body.appendChild(clone);

    const deltaX = dstRect.left + dstRect.width / 2 - (srcRect.left + srcRect.width / 2);
    const deltaY = dstRect.top + dstRect.height / 2 - (srcRect.top + srcRect.height / 2);

    const multiplier = options.multiplier && Number(options.multiplier) > 0 ? Number(options.multiplier) : 1;

    clone.animate(
      [
        { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
        { transform: `translate3d(${deltaX * 0.4}px, ${deltaY * 0.25}px, 60px) scale(1.05)`, opacity: 0.95, offset: 0.45 },
        { transform: `translate3d(${deltaX}px, ${deltaY}px, 0px) scale(0.28)`, opacity: 0.0 },
      ],
      {
        duration: Math.round(520 * multiplier),
        easing: "cubic-bezier(.22,.9,.28,1)",
      }
    ).onfinish = () => {
      clone.remove();
      // small pulse on the target to indicate success
      try {
        targetEl.animate(
          [
            { transform: "scale(1)", boxShadow: "0 0 0 rgba(229,9,20,0)" },
            { transform: "scale(1.06)", boxShadow: "0 10px 30px rgba(229,9,20,0.18)" },
            { transform: "scale(1)", boxShadow: "0 0 0 rgba(229,9,20,0)" },
          ],
          { duration: Math.round(340 * multiplier), easing: "ease-out" }
        );
      } catch (e) {
        // ignore
      }
      resolve();
    };
  });

/* Enhanced throw with trailing clones for tactile feedback. If the environment
 * prefers reduced motion, this will simply run the base animation.
 */
export const animateThrowWithTrail = async (movieId, targetEl, options = {}) => {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return animateThrowToTrigger(movieId, targetEl);
  }
  const poster = document.querySelector(`[data-movie-id="${movieId}"]`)?.querySelector('.movie-poster');
  if (!poster) return animateThrowToTrigger(movieId, targetEl);
  const srcRect = poster.getBoundingClientRect();
  const dstRect = targetEl.getBoundingClientRect();
  const multiplier = options.multiplier && Number(options.multiplier) > 0 ? Number(options.multiplier) : 1;
  // create two trailing clones with staggered timing
  const createTrail = (offsetScale, blur, opacity) => {
    const c = poster.cloneNode(true);
    c.classList.add('trail-clone');
    c.style.left = `${srcRect.left}px`;
    c.style.top = `${srcRect.top}px`;
    c.style.width = `${srcRect.width}px`;
    c.style.height = `${srcRect.height}px`;
    c.style.opacity = String(opacity || 0.5);
    c.style.filter = `blur(${blur || 6}px)`;
    document.body.appendChild(c);
    const dx = dstRect.left + dstRect.width / 2 - (srcRect.left + srcRect.width / 2);
    const dy = dstRect.top + dstRect.height / 2 - (srcRect.top + srcRect.height / 2);
    c.animate(
      [
        { transform: 'translate3d(0,0,0) scale(1)', opacity: opacity },
        { transform: `translate3d(${dx * offsetScale}px, ${dy * offsetScale}px, 40px) scale(${0.95 * offsetScale})`, opacity: opacity * 0.7 },
        { transform: `translate3d(${dx}px, ${dy}px, 0px) scale(0.28)`, opacity: 0 },
      ],
      { duration: Math.round((420 + Math.round(offsetScale * 120)) * multiplier), easing: 'cubic-bezier(.22,.9,.28,1)' }
    ).onfinish = () => c.remove();
  };
  try {
    createTrail(0.5, 8, 0.6);
    window.setTimeout(() => createTrail(0.8, 5, 0.45), Math.round(50 * multiplier));
  } catch (e) {
    // ignore
  }
  return animateThrowToTrigger(movieId, targetEl, options);
};

/* Drag hint helpers: show a small pointer-following dot with a directional
 * stripe pointing toward the planner trigger. Start on pointerdown and stop on up/cancel.
 */
// ----------------------------------------------------------------------------
// CARD DRAG HINT
// ----------------------------------------------------------------------------
let _dragHintEl = null;
export const startDragHint = (startEvent) => {
  if (!startEvent || !startEvent.clientX) return;
  if (_dragHintEl) return;
  const hint = document.createElement('div');
  hint.className = 'drag-hint';
  document.body.appendChild(hint);
  _dragHintEl = hint;
  const update = (ev) => {
    if (!_dragHintEl) return;
    _dragHintEl.style.left = `${ev.clientX}px`;
    _dragHintEl.style.top = `${ev.clientY}px`;
    const plannerBtn = document.getElementById('planner-trigger');
    if (!plannerBtn) return;
    const btnRect = plannerBtn.getBoundingClientRect();
    const dx = btnRect.left + btnRect.width / 2 - ev.clientX;
    const dy = btnRect.top + btnRect.height / 2 - ev.clientY;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    _dragHintEl.style.setProperty('--angle', `${angle}deg`);
    // rotate the ::after stripe toward target
    _dragHintEl.style.transform = 'translate(-50%, -50%)';
    _dragHintEl.style.opacity = String(Math.max(0.45, Math.min(1, 1 - Math.hypot(dx,dy) / 1200)));
    _dragHintEl.style.setProperty('--stripe-rotate', `${angle}deg`);
  };
  // attach temporary listeners
  const moveFn = (e) => update(e);
  const upFn = () => {
    stopDragHint();
    document.removeEventListener('pointermove', moveFn);
    document.removeEventListener('pointerup', upFn);
    document.removeEventListener('pointercancel', upFn);
  };
  document.addEventListener('pointermove', moveFn, { passive: true });
  document.addEventListener('pointerup', upFn);
  document.addEventListener('pointercancel', upFn);
  update(startEvent);
};

export const stopDragHint = () => {
  if (!_dragHintEl) return;
  _dragHintEl.remove();
  _dragHintEl = null;
};

// ----------------------------------------------------------------------------
// BUTTON RIPPLES
// ----------------------------------------------------------------------------
/* Ripple glass effect for click interactions. Binds to primary/secondary/icon buttons. */
export const bindRippleEffect = () => {
  const container = document;
  container.addEventListener("pointerdown", (event) => {
    const btn = event.target.closest(".primary-button, .secondary-button, .icon-button, .modal-close, .search-column-action, .card-favorite, .card-watched, .planner-controls button");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "rv-ripple";
    const size = Math.max(rect.width, rect.height) * 1.4;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.animate(
      [
        { transform: "scale(0.2)", opacity: 0.55 },
        { transform: "scale(1)", opacity: 0.08 },
        { transform: "scale(1.4)", opacity: 0 },
      ],
      { duration: 420, easing: "cubic-bezier(.2,.9,.2,1)" }
    ).onfinish = () => ripple.remove();
  });
};

/* Hover-based professional tutorial demo
 * Shows a small textual tip near the poster and performs a demo throw animation
 * (visual only) once per session to demonstrate the throw-to-planner gesture.
 */
let _hoverTutorialShown = false;
export const showHoverTutorial = async (movieEl) => {
  if (_hoverTutorialShown) return;
  if (!movieEl) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Respect reduced motion: show a simple tooltip briefly
    const tip = document.createElement('div');
    tip.className = 'tutorial-tip simple';
    tip.textContent = 'Tip: drag and throw this poster to the planner (top-right).';
    movieEl.appendChild(tip);
    setTimeout(() => tip.remove(), 2600);
    _hoverTutorialShown = true;
    return;
  }
  _hoverTutorialShown = true;
  const poster = movieEl.querySelector('.movie-poster') || movieEl.querySelector('img');
  const tip = document.createElement('div');
  tip.className = 'tutorial-tip';
  tip.innerHTML = '<strong>Try this:</strong> Drag and throw to the planner <span class="arrow">→</span>';
  // position tip relative to card
  tip.style.position = 'absolute';
  tip.style.left = '12px';
  tip.style.top = '12px';
  tip.style.zIndex = 9999;
  movieEl.style.position = movieEl.style.position || 'relative';
  movieEl.appendChild(tip);
  // small entrance animation (slower so users can read)
  // Resolve multiplier: prefer CSS override, then fallback to the centralized
  // JS constant. Keep a sane minimum of 1 so demos don't speed-up below normal.
  const cssVar = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--motion-demo-multiplier"
    )
  );
  const demoMultiplier = Number.isFinite(cssVar)
    ? cssVar
    : Number.isFinite(Number(TUTORIAL_ANIMATION_MULTIPLIER))
    ? Number(TUTORIAL_ANIMATION_MULTIPLIER)
    : 1.95;
  tip.animate([
    { transform: 'translateY(-6px) scale(.98)', opacity: 0 },
    { transform: 'translateY(0) scale(1)', opacity: 1 }
  ], { duration: Math.round(380 * demoMultiplier), easing: 'cubic-bezier(.2,.9,.2,1)' });

  // perform demo throw visual: use the animateThrowWithTrail helper but ask for a slower playback
  try {
    const movieId = movieEl.dataset.movieId;
    const plannerBtn = document.getElementById('planner-trigger');
    if (movieId && plannerBtn) {
      await animateThrowWithTrail(movieId, plannerBtn, { multiplier: demoMultiplier });
    }
  } catch (err) {
    // ignore errors in demo animation
  }

  // keep tip visible longer so the user can read the microcopy and observe the demo
  setTimeout(() => {
    tip.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: 'translateY(-8px) scale(.96)', opacity: 0 }
    ], { duration: Math.round(320 * demoMultiplier), easing: 'cubic-bezier(.2,.9,.2,1)' }).onfinish = () => tip.remove();
  }, Math.round(2200 * demoMultiplier));
};

const animateModalIn = (modal) => {
  if (!gsapAvailable()) return;
  window.gsap.fromTo(
    modal,
    { autoAlpha: 0, scale: 0.92, y: 20 },
    { autoAlpha: 1, scale: 1, y: 0, duration: 0.4, ease: "power2.out" }
  );
};

const animateModalOut = (modal, callback) => {
  if (!gsapAvailable()) {
    callback();
    return;
  }
  window.gsap.to(modal, {
    autoAlpha: 0,
    scale: 0.94,
    y: -10,
    duration: 0.25,
    ease: "power2.in",
    onComplete: callback,
  });
};

const closeTopModal = () => {
  const latest = modalStack.pop();
  if (!latest) return;
  animateModalOut(latest.modal, () => {
    latest.overlay.remove();
  });
  if (!modalStack.length) {
    document.body.style.overflow = "";
  }
};

const handleEsc = (event) => {
  if (event.key === "Escape" && modalStack.length) {
    closeTopModal();
  }
};

document.addEventListener("keydown", handleEsc);

export const updateSectionTitle = (title) => {
  const titleEl = sectionTitleEl();
  if (titleEl) {
    titleEl.textContent = title;
  }
};

// ----------------------------------------------------------------------------
// GENRE TOOLBAR
// ----------------------------------------------------------------------------

export const setActiveGenreChip = (value = []) => {
  const selectedIds = Array.isArray(value)
    ? value.map((id) => String(id))
    : value === "all"
    ? []
    : [String(value)];
  const hasSelection = selectedIds.length > 0;
  const selectedSet = new Set(selectedIds);
  const chips = document.querySelectorAll(".genre-chip");
  chips.forEach((chip) => {
    const genreId = String(chip.dataset.genre || "");
    const isAllChip = genreId === "all";
    const isActive = isAllChip ? !hasSelection : selectedSet.has(genreId);
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-pressed", isActive ? "true" : "false");
    chip.setAttribute("aria-selected", isActive ? "true" : "false");
  });
};

export const setGenreDropdownState = (open = false) => {
  const dropdown = genreDropdownEl();
  const trigger = genreDropdownTrigger();
  if (dropdown) {
    dropdown.classList.toggle("open", Boolean(open));
    dropdown.setAttribute("aria-hidden", open ? "false" : "true");
  }
  if (trigger) {
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    trigger.classList.toggle("is-open", Boolean(open));
  }
};

export const updateGenreTriggerSummary = (selected = [], genres = []) => {
  const trigger = genreDropdownTrigger();
  const summaryNodes = Array.from(genreSummaryEls());
  if (!trigger && !summaryNodes.length) return;

  const selectedIds = Array.isArray(selected)
    ? selected.map((id) => String(id))
    : [String(selected ?? "")];
  const names = selectedIds
    .filter(Boolean)
    .map((id) =>
      genres.find((genre) => String(genre.id) === id)?.name || ""
    )
    .filter(Boolean);

  const phrase =
    names.length > 0 ? names.join(", ") : "No genres selected";
  const preview = names.slice(0, 2).join(", ");
  const remainder = names.length - 2;
  const summaryText =
    names.length === 0
      ? ""
      : remainder > 0
      ? `${preview} +${remainder}`
      : preview || phrase;

  summaryNodes.forEach((node) => {
    node.textContent = summaryText;
    node.setAttribute("title", phrase);
    node.setAttribute("data-summary-count", String(names.length));
    node.setAttribute(
      "aria-label",
      names.length
        ? `Active genres: ${phrase}.`
        : "No genre filters applied."
    );
  });

  if (trigger) {
    trigger.setAttribute(
      "aria-label",
      names.length
        ? `Filter movies by genre. Selected: ${phrase}.`
        : "Filter movies by genre. No genre filters applied."
    );
  }

  const badges = selectedGenresContainer();
  if (badges) {
    badges.innerHTML = "";
    if (names.length) {
      selectedIds
        .filter(Boolean)
        .forEach((id) => {
          const genreName = genres.find((genre) => String(genre.id) === id)?.name;
          if (!genreName) return;
          const badge = createEl("button", "selected-genre-badge", genreName);
          badge.type = "button";
          badge.dataset.removeGenre = id;
          badge.setAttribute("aria-label", `Remove ${genreName} filter`);
          badges.appendChild(badge);
        });
    }
  }
};

export const renderGenreOptions = (genres = [], selected = []) => {
  const track = genreTrackEl();
  if (track) {
    track.innerHTML = "";
    track.setAttribute("role", "listbox");
    track.setAttribute("aria-label", "Genre filters");
    track.setAttribute("aria-multiselectable", "true");
    const selectedIds = Array.isArray(selected)
      ? selected.map((id) => String(id))
      : [String(selected ?? "")];
    const selectedSet = new Set(selectedIds.filter(Boolean));
    const hasSelection = selectedSet.size > 0;
    const buildChip = (value, label) => {
      const chip = createEl("button", "genre-chip", label);
      chip.type = "button";
      chip.dataset.genre = String(value);
      chip.setAttribute("role", "option");
      const isActive = value === "all" ? !hasSelection : selectedSet.has(String(value));
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
      chip.setAttribute("aria-selected", isActive ? "true" : "false");
      return chip;
    };
    track.appendChild(buildChip("all", "All Genres"));
    genres.forEach((genre) => {
      track.appendChild(buildChip(genre.id, genre.name));
    });
    setActiveGenreChip(selectedIds);
  }
};

// ----------------------------------------------------------------------------
// MOVIE CARD CONTROLS
// ----------------------------------------------------------------------------

const createCardFavoriteButton = (movie, isFavorite, onFavoriteToggle) => {
  const favoriteBtn = createEl(
    "button",
    `card-favorite${isFavorite ? " active" : ""}`
  );
  favoriteBtn.type = "button";
  favoriteBtn.setAttribute("aria-label", "Toggle favorite");
  const heart = createEl(
    "i",
    `${isFavorite ? "fa-solid" : "fa-regular"} fa-heart`
  );
  favoriteBtn.appendChild(heart);

  // Clicking the heart toggles persistence and updates the icon instantly.
  favoriteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (typeof onFavoriteToggle === "function") {
      const nowFavorite = onFavoriteToggle(movie);
      favoriteBtn.classList.toggle("active", nowFavorite);
      heart.className = `${nowFavorite ? "fa-solid" : "fa-regular"} fa-heart`;
      favoriteBtn.classList.add("pulse-favorite");
      favoriteBtn.addEventListener(
        "animationend",
        () => favoriteBtn.classList.remove("pulse-favorite"),
        { once: true }
      );
    }
  });

  return favoriteBtn;
};

const createCardWatchedButton = (movie, isWatched, onWatchedToggle) => {
  const watchedBtn = createEl(
    "button",
    `card-watched${isWatched ? " active" : ""}`
  );
  watchedBtn.type = "button";
  watchedBtn.setAttribute("aria-label", "Toggle watched");
  const eye = createEl(
    "i",
    `${isWatched ? "fa-solid" : "fa-regular"} fa-eye`
  );
  watchedBtn.appendChild(eye);

  // Clicking the eye toggles "watched" state with visual feedback.
  watchedBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (typeof onWatchedToggle === "function") {
      const nowWatched = onWatchedToggle(movie);
      watchedBtn.classList.toggle("active", nowWatched);
      eye.className = `${nowWatched ? "fa-solid" : "fa-regular"} fa-eye`;
      watchedBtn.classList.add("pulse-favorite");
      watchedBtn.addEventListener(
        "animationend",
        () => watchedBtn.classList.remove("pulse-favorite"),
        { once: true }
      );
    }
  });

  return watchedBtn;
};

const enableHorizontalDrag = (track) => {
  if (!track || draggedTracks.has(track)) return;
  let isPointerDown = false;
  let startX = 0;
  let startScroll = 0;

  const onPointerDown = (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey) return;
    isPointerDown = true;
    startX = event.clientX;
    startScroll = track.scrollLeft;
    track.classList.add("dragging");
    track.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!isPointerDown) return;
    const delta = event.clientX - startX;
    track.scrollLeft = startScroll - delta;
  };

  const onPointerUp = (event) => {
    isPointerDown = false;
    track.classList.remove("dragging");
    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event) => {
    if (event.ctrlKey) return;
    const { deltaX, deltaY } = event;
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    if (maxScrollLeft <= 0) return;

    const horizontalIntent = Math.abs(deltaX) >= Math.abs(deltaY);
    if (!horizontalIntent && !event.shiftKey) return;

    const delta = horizontalIntent ? deltaX : deltaY;
    if (delta === 0) return;

    const atStart = track.scrollLeft <= 0;
    const atEnd = track.scrollLeft >= maxScrollLeft;
    if ((delta < 0 && atStart) || (delta > 0 && atEnd)) {
      return;
    }

    event.preventDefault();
    track.scrollLeft = Math.min(
      Math.max(0, track.scrollLeft + delta),
      maxScrollLeft
    );
  };

  // Pointer listeners let the chip rail be dragged horizontally on desktop.
  track.addEventListener("pointerdown", onPointerDown);
  track.addEventListener("pointermove", onPointerMove);
  track.addEventListener("pointerup", onPointerUp);
  track.addEventListener("pointercancel", onPointerUp);
  track.addEventListener("pointerleave", () => {
    if (isPointerDown) {
      isPointerDown = false;
      track.classList.remove("dragging");
    }
  });
  // Wheel support for trackpads/shift-scroll.
  track.addEventListener("wheel", onWheel, { passive: false });

  draggedTracks.add(track);
};

// Build the interactive movie card (poster, metadata, planner drag hooks).
const createMovieCard = (movie, options) => {
  const {
    isFavorite,
    isWatched,
    onFavoriteToggle,
    onWatchedToggle,
    onCardClick,
    variant = "standard",
    onPlannerDragStart,
    onPlannerDragEnd,
  } = options;
  const card = createEl(
    "article",
    `movie-card${variant === "compact" ? " compact" : ""}`
  );
  card.tabIndex = 0;
  card.dataset.movieId = movie.id;
  if (isWatched) {
    card.classList.add("watched");
  }
  card.draggable = true;

  const poster = createEl("img", "movie-poster");
  poster.alt = `${movie.title} poster`;
  lazyLoadImage(poster, movie.poster, {
    srcset: movie.posterSet || "",
    sizes: movie.posterSizes || "(max-width: 600px) 62vw, 220px",
  });

  const info = createEl("div", "movie-info");
  const title = createEl("h3", "movie-title", movie.title);
  const meta = createEl("div", "movie-meta");
  const rating = createEl("span", "movie-rating");
  const ratingIcon = createEl("i", "fa-solid fa-star");
  rating.append(ratingIcon, createEl("span", "", movie.rating));
  const release = createEl(
    "span",
    "",
    movie.releaseDate ? movie.releaseDate.split("-")[0] : "—"
  );
  meta.append(rating, release);
  info.append(title, meta);

  const badge = createEl("span", "card-badge", FAVORITE_BADGE_TEXT);
  badge.classList.toggle("hidden", !isFavorite);

  const maxSnippetLength = variant === "compact" ? 110 : 140;
  const snippet =
    movie.overview && movie.overview.length > maxSnippetLength
      ? `${movie.overview.slice(0, maxSnippetLength - 3)}...`
      : movie.overview || "No synopsis available.";
  const overlay = createEl("div", "movie-overlay");
  const overlayContent = createEl("div", "movie-overlay-content");
  const overlayTitle = createEl("span", "movie-overlay-title", movie.title);
  const overlaySnippet = createEl(
    "p",
    "movie-overlay-snippet",
    snippet
  );
  const overlayMeta = createEl("div", "movie-overlay-meta");
  const year = movie.releaseDate ? movie.releaseDate.split("-")[0] : "—";
  overlayMeta.innerHTML = `<span>${year}</span><span><i class="fa-solid fa-star"></i> ${movie.rating}</span>`;
  const overlayPill = createEl(
    "span",
    `overlay-pill${isWatched ? "" : " hidden"}`
  );
  overlayPill.innerHTML = `<i class="fa-solid fa-eye"></i> ${WATCHED_BADGE_TEXT}`;
  overlayMeta.appendChild(overlayPill);

  overlayContent.append(overlayTitle, overlaySnippet, overlayMeta);
  overlay.appendChild(overlayContent);

  const favoriteBtn = createCardFavoriteButton(movie, isFavorite, (payload) => {
    const nowFavorite =
      typeof onFavoriteToggle === "function" ? onFavoriteToggle(payload) : false;
    badge.classList.toggle("hidden", !nowFavorite);
    if (nowFavorite) {
      badge.classList.add("pulse-favorite");
      badge.addEventListener(
        "animationend",
        () => badge.classList.remove("pulse-favorite"),
        { once: true }
      );
    }
    return nowFavorite;
  });

  const watchedBtn = createCardWatchedButton(movie, isWatched, (payload) => {
    const nowWatched =
      typeof onWatchedToggle === "function" ? onWatchedToggle(payload) : false;
    card.classList.toggle("watched", nowWatched);
    overlayPill.classList.toggle("hidden", !nowWatched);
    return nowWatched;
  });

  card.addEventListener("click", () => {
    if (card.dataset.dragging === "true") {
      return;
    }
    if (typeof onCardClick === "function") {
      onCardClick(movie);
    }
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (typeof onCardClick === "function") {
        onCardClick(movie);
      }
    }
  });

  card.append(poster, info, overlay, badge, watchedBtn, favoriteBtn);

  card.addEventListener("dragstart", (event) => {
    card.dataset.dragging = "true";
    card.classList.add("dragging");
    if (typeof onPlannerDragStart === "function") {
      onPlannerDragStart(event, movie);
    }
  });

  card.addEventListener("dragend", (event) => {
    card.classList.remove("dragging");
    delete card.dataset.dragging;
    if (typeof onPlannerDragEnd === "function") {
      onPlannerDragEnd(event, movie);
    }
  });

  // Hover-triggered tutorial demo: show a professional animated tip and demo throw
  poster.addEventListener('pointerenter', () => {
    try {
      showHoverTutorial(card);
    } catch (e) {
      // noop
    }
  }, { passive: true });

  return card;
};

/*
 * Lightweight magnetic tilt: applies a subtle rotateX/rotateY transform
 * to `.movie-card` based on pointer position. Uses requestAnimationFrame
 * for smooth updates and respects `prefers-reduced-motion`.
 */
const supportsReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ----------------------------------------------------------------------------
// MOVIE GRID
// ----------------------------------------------------------------------------

const enableCardTilt = (container = document) => {
  if (supportsReducedMotion()) return;
  const cards = container.querySelectorAll(".movie-card");
  cards.forEach((card) => {
    if (card.dataset.tiltBound) return;
    let rafId = null;
    const poster = card.querySelector('.movie-poster');
    const overlay = card.querySelector('.movie-overlay');

    const handleMove = (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 10; // degrees
      const rotateX = (0.5 - py) * 8; // degrees
      const translateZ = 10; // subtle pop
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        card.style.transform = `perspective(1000px) translateZ(0px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        if (poster) poster.style.transform = `translateZ(${translateZ}px) scale(1.02)`;
        if (overlay) overlay.style.transform = `rotateX(0deg)`;
      });
    };

    const reset = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        card.style.transform = "";
        if (poster) poster.style.transform = "";
        if (overlay) overlay.style.transform = "rotateX(90deg)";
      });
    };

    card.addEventListener("pointermove", handleMove);
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointerdown", () => {
      card.style.willChange = "transform";
    });
    card.addEventListener("pointerup", reset);
    card.dataset.tiltBound = "true";
  });
};

export const renderMovieGrid = (
  movies = [],
  {
    append = false,
    favorites = [],
    watched = [],
    context = {},
    onCardClick,
    onFavoriteToggle,
    onWatchedToggle,
    onPlannerDragStart,
    onPlannerDragEnd,
  } = {}
) => {
  const grid = gridEl();
  if (!grid) return;
  if (!append) {
    grid.innerHTML = "";
  }
  const {
    category = "",
    hasGenreFilters = false,
    searchQuery = "",
    isDefaultCategory = false,
  } = context || {};

  if (!movies.length && !append) {
    const empty = createEl("div", "movies-empty");
    empty.setAttribute("role", "status");
    empty.setAttribute("aria-live", "polite");
    const icon = createEl("div", "movies-empty__icon");
    icon.innerHTML = '<i class="fa-solid fa-film"></i>';
    icon.setAttribute("aria-hidden", "true");

    let titleText = "No movies to show just yet.";
    let subtitleText = "Adjust your filters or explore another category.";

    if (category === "search" && searchQuery) {
      titleText = `No matches for "${searchQuery}" yet.`;
      subtitleText = "Try refining your keywords or explore trending titles.";
    } else if (hasGenreFilters) {
      titleText = "No movies match those genres.";
      subtitleText = "Stack fewer genres or clear filters to widen the feed.";
    }

    const title = createEl("h3", "movies-empty__title", titleText);
    const subtitle = createEl("p", "movies-empty__subtitle", subtitleText);

    empty.append(icon, title, subtitle);

    const actions = createEl("div", "movies-empty__actions");
    let hasAction = false;

    if (hasGenreFilters) {
      const clearBtn = createEl("button", "secondary-button movies-empty__button", "Clear filters");
      clearBtn.type = "button";
      clearBtn.dataset.emptyAction = "reset-filters";
      clearBtn.setAttribute("aria-label", "Clear all selected genres");
      actions.appendChild(clearBtn);
      hasAction = true;
    }

    if (!isDefaultCategory || category === "search") {
      const trendingBtn = createEl("button", "ghost-button movies-empty__button", "Back to trending");
      trendingBtn.type = "button";
      trendingBtn.dataset.emptyAction = "view-trending";
      trendingBtn.setAttribute("aria-label", "Return to trending movies");
      actions.appendChild(trendingBtn);
      hasAction = true;
    }

    if (hasAction) {
      empty.appendChild(actions);
    }

    grid.appendChild(empty);
    return;
  }
  const favoriteIds = new Set(favorites.map((item) => Number(item.id)));
  const watchedIds = new Set(watched.map((item) => Number(item.id)));
  const fragment = document.createDocumentFragment();
  movies.forEach((movie) => {
    const card = createMovieCard(movie, {
      onCardClick,
      onFavoriteToggle,
      onWatchedToggle,
      onPlannerDragStart,
      onPlannerDragEnd,
      isFavorite: favoriteIds.has(Number(movie.id)),
      isWatched: watchedIds.has(Number(movie.id)),
    });
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);

  // Apply subtle tilt to newly appended cards for magnetic interaction.
  // Run in idle time so rendering isn't blocked during heavy updates.
  runIdle(() => enableCardTilt(grid));

  if (gsapAvailable()) {
    window.gsap.fromTo(
      grid.children,
      { y: 24, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.05,
      }
    );
  }
};

export const animateDrawerReveal = () => {
  const drawer = mobileDrawer();
  if (!drawer) return;
  const buttons = drawer.querySelectorAll(".drawer-actions button");
  if (!buttons.length) return;

  if (gsapAvailable()) {
    window.gsap.fromTo(
      buttons,
      { autoAlpha: 0, x: 30 },
      {
        autoAlpha: 1,
        x: 0,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.06,
      }
    );
  } else {
    buttons.forEach((btn, index) => {
      btn.style.transition = "transform 0.35s ease, opacity 0.35s ease";
      btn.style.opacity = "0";
      btn.style.transform = "translateX(16px)";
      window.setTimeout(() => {
        btn.style.opacity = "1";
        btn.style.transform = "translateX(0)";
      }, index * 60);
    });
  }
};

export const setActiveNav = (category) => {
  const navButtons = document.querySelectorAll(".nav-link");
  navButtons.forEach((btn) => {
    const isActive = btn.dataset.category === category && category !== "";
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
};

export const renderSuggestions = (items = [], onSelect) => {
  const container = suggestionsEl();
  if (!container) return;
  container.innerHTML = "";
  if (!items.length) {
    container.classList.add("hidden");
    return;
  }
  items.forEach((item) => {
    const suggestion = createEl("div", "suggestion-item");
    suggestion.setAttribute("tabindex", "0");
    const icon = createEl("i", "fa-solid fa-film");
    const label = createEl("span", "", item.title);
    suggestion.append(icon, label);
    suggestion.addEventListener("click", () => {
      if (typeof onSelect === "function") {
        onSelect(item);
      }
      container.classList.add("hidden");
    });
    suggestion.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (typeof onSelect === "function") {
          onSelect(item);
        }
        container.classList.add("hidden");
      }
    });
    container.appendChild(suggestion);
  });
  container.classList.remove("hidden");
};

export const clearSuggestions = () => {
  const container = suggestionsEl();
  if (container) {
    container.innerHTML = "";
    container.classList.add("hidden");
  }
};

const buildModalShell = (titleText) => {
  const overlay = createEl("div", "modal-overlay");
  const modal = createEl("div", "modal glass");
  const header = createEl("div", "modal-header");
  const title = createEl("h2", "modal-title", titleText);
  const closeBtn = createEl("button", "modal-close");
  closeBtn.type = "button";
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  closeBtn.addEventListener("click", () => closeTopModal());
  header.append(title, closeBtn);
  modal.appendChild(header);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeTopModal();
    }
  });
  return { overlay, modal };
};

const openModal = (title, bodyContent, footerContent, className = "") => {
  const { overlay, modal } = buildModalShell(title);
  let body = null;
  if (className) {
    modal.classList.add(className);
  }
  if (bodyContent) {
    body = createEl("div", "modal-body");
    body.appendChild(bodyContent);
    modal.appendChild(body);
  }
  if (footerContent) {
    const footer = createEl("div", "modal-footer");
    footer.appendChild(footerContent);
    modal.appendChild(footer);
  }
  modalRoot().appendChild(overlay);
  modalStack.push({ overlay, modal });
  document.body.style.overflow = "hidden";
  animateModalIn(modal);
  return { overlay, modal, body };
};

export const openMovieModal = (
  movie,
  {
    trailerUrl = null,
    cast = [],
    onFavoriteToggle,
    onWatchedToggle,
    onCastSelect,
    isFavorite = false,
    isWatched = false,
  } = {}
) => {
  const content = createEl("div", "movie-modal-content");

  const layout = createEl("div", "movie-modal-layout");
  const sidebar = createEl("aside", "movie-modal-sidebar");
  const main = createEl("div", "movie-modal-main");

  const posterWrapper = createEl("div", "movie-modal-poster");
  const poster = createEl("img", "");
  poster.alt = `${movie.title} poster large`;
  lazyLoadImage(poster, movie.poster, {
    srcset: movie.posterSet || "",
    sizes: movie.posterSizes || "(max-width: 600px) 62vw, 320px",
    placeholder: "assets/placeholders/poster-fallback.png",
  });
  posterWrapper.appendChild(poster);
  sidebar.appendChild(posterWrapper);

  const statsGrid = createEl("div", "movie-modal-stats");
  const createStatCard = (icon, label, value, { accent = false } = {}) => {
    const card = createEl(
      "div",
      `modal-stat-card${accent ? " accent" : ""}`
    );
    const iconWrapper = createEl("div", "modal-stat-icon");
    iconWrapper.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    const info = createEl("div", "modal-stat-info");
    const labelEl = createEl("span", "modal-stat-label", label);
    const valueEl = createEl("span", "modal-stat-value", value);
    info.append(labelEl, valueEl);
    card.append(iconWrapper, info);
    return { card, valueEl };
  };

  const formatNumber = (value) => {
    if (!Number.isFinite(Number(value))) return "—";
    try {
      return new Intl.NumberFormat().format(Number(value));
    } catch {
      return String(value);
    }
  };

  const ratingCard = createStatCard(
    "fa-star",
    "Rating",
    Number.isFinite(Number(movie.rating)) ? `${movie.rating}` : "NR"
  );
  const releaseValue =
    movie.releaseDate && movie.releaseDate !== "Unknown"
      ? movie.releaseDate
      : "Unknown";
  const releaseCard = createStatCard("fa-calendar", "Release", releaseValue);
  const votesCard = createStatCard(
    "fa-chart-column",
    "Votes",
    formatNumber(movie.voteCount)
  );
  const statusCard = createStatCard(
    "fa-eye",
    "Status",
    isWatched ? "Watched" : "Want to watch",
    { accent: isWatched }
  );

  [ratingCard.card, releaseCard.card, votesCard.card, statusCard.card].forEach(
    (card) => statsGrid.appendChild(card)
  );
  sidebar.appendChild(statsGrid);

  layout.append(sidebar, main);
  content.appendChild(layout);

  const headerBlock = createEl("div", "movie-modal-header-block");
  const heading = createEl("h3", "movie-modal-heading", movie.title);
  headerBlock.appendChild(heading);

  const summaryParts = [];
  const releaseYear =
    movie.releaseDate && movie.releaseDate.includes("-")
      ? movie.releaseDate.split("-")[0]
      : movie.releaseDate || "";
  if (releaseYear) summaryParts.push(releaseYear);
  const ratingValue =
    Number.isFinite(Number(movie.rating)) && movie.rating !== "NR"
      ? `${movie.rating} ★`
      : "";
  if (ratingValue) summaryParts.push(ratingValue);
  if (movie.voteCount) {
    summaryParts.push(`${formatNumber(movie.voteCount)} votes`);
  }
  if (summaryParts.length) {
    const summary = createEl(
      "p",
      "movie-modal-summary",
      summaryParts.join(" • ")
    );
    headerBlock.appendChild(summary);
  }

  const badgeRow = createEl("div", "movie-modal-badges");
  const statusBadge = createEl(
    "span",
    "modal-status-badge",
    WATCHED_BADGE_TEXT
  );
  statusBadge.insertAdjacentHTML("afterbegin", '<i class="fa-solid fa-eye"></i>');
  if (!isWatched) {
    statusBadge.classList.add("hidden");
  }
  badgeRow.appendChild(statusBadge);
  badgeRow.classList.toggle("hidden", !isWatched);
  headerBlock.appendChild(badgeRow);

  const overviewSection = createEl(
    "section",
    "modal-section modal-section-overview"
  );
  const overviewTitle = createEl("h4", "modal-section-title", "Overview");
  const overviewText = createEl(
    "p",
    "movie-modal-overview",
    movie.overview || "Synopsis unavailable for this title."
  );
  overviewSection.append(overviewTitle, overviewText);

  const sections = [
    {
      key: "overview",
      label: "Overview",
      element: overviewSection,
    },
  ];

  if (!trailerUrl) {
    const trailerHint = createEl(
      "div",
      "modal-section-note",
      "Trailer is not available right now. Check back later!"
    );
    overviewSection.appendChild(trailerHint);
  }

  if (cast.length) {
    const castSection = createEl(
      "section",
      "modal-section modal-section-cast"
    );
    const castHeader = createEl("div", "cast-header");
    const castTitle = createEl("h4", "modal-section-title", "Cast");
    castHeader.append(castTitle);
    const castGrid = createEl("div", "cast-grid");
    cast.slice(0, 12).forEach((member) => {
      const card = createEl("button", "cast-card");
      card.type = "button";
      card.setAttribute(
        "aria-label",
        member.character
          ? `${member.name} as ${member.character}`
          : member.name
      );
      const avatar = createEl("div", "cast-avatar");
      const img = createEl("img");
      lazyLoadImage(img, member.profile, {
        placeholder: "assets/placeholders/poster-fallback.png",
      });
      img.alt = member.name;
      avatar.appendChild(img);
      const info = createEl("div", "cast-info");
      const name = createEl("span", "cast-name", member.name);
      name.title = member.name;
      const roleLabel = member.character || "Cast";
      const role = createEl("span", "cast-role", roleLabel);
      role.title = roleLabel;
      info.append(name, role);
      card.append(avatar, info);
      card.addEventListener("click", () => {
        if (typeof onCastSelect === "function") {
          closeTopModal();
          onCastSelect(member);
        }
      });
      castGrid.appendChild(card);
    });
    castSection.append(castHeader, castGrid);
    sections.push({
      key: "cast",
      label: "Cast",
      element: castSection,
    });
  }

  if (trailerUrl) {
    const trailerSection = createEl(
      "section",
      "modal-section modal-section-trailer"
    );
    const trailerTitle = createEl("h4", "modal-section-title", "Trailer");
    const trailerWrapper = createEl("div", "trailer-wrapper");
    // Create iframe without src and defer assignment until visible to avoid heavy network cost.
    const iframe = document.createElement("iframe");
    iframe.dataset.src = trailerUrl;
    iframe.title = `${movie.title} trailer`;
    iframe.allowFullscreen = true;
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    // insert lightweight placeholder node, then set src when visible
    trailerWrapper.appendChild(iframe);
    observeWhenVisible(trailerWrapper, () => {
      if (!iframe.src) {
        iframe.src = iframe.dataset.src || "";
      }
    }, { root: null, threshold: 0.15, rootMargin: "0px" });
    trailerSection.append(trailerTitle, trailerWrapper);
    sections.push({
      key: "trailer",
      label: "Trailer",
      element: trailerSection,
    });
  }

  main.appendChild(headerBlock);

  sections.forEach(({ key, element }) => {
    element.id = `movie-section-${key}-${movie.id}`;
    element.dataset.sectionKey = key;
  });

  const sectionsContainer = createEl("div", "modal-sections");
  let activeSectionKey = sections[0]?.key || "";
  const tabButtons = [];
  const updateActiveSection = (key) => {
    if (!key) return;
    activeSectionKey = key;
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === key;
      btn.classList.toggle("active", isActive);
      if (isActive) {
        btn.setAttribute("aria-current", "true");
        btn.setAttribute("tabindex", "0");
      } else {
        btn.removeAttribute("aria-current");
        btn.setAttribute("tabindex", "-1");
      }
    });
    sections.forEach(({ key: sectionKey, element }) => {
      element.classList.toggle("active", sectionKey === key);
    });
  };

  let modalBodyRef = null;

  if (sections.length > 1) {
    const tablist = createEl("div", "modal-tablist");
    tablist.setAttribute("role", "navigation");
    tablist.setAttribute("aria-label", "Jump to movie details section");
    sections.forEach(({ key, label, element }, index) => {
      const button = createEl("button", "modal-tab", label);
      button.type = "button";
      button.dataset.tab = key;
      button.setAttribute("aria-controls", element.id);
      if (index === 0) {
        button.classList.add("active");
        button.setAttribute("aria-current", "true");
        button.setAttribute("tabindex", "0");
      } else {
        button.setAttribute("tabindex", "-1");
      }
      button.addEventListener("click", () => {
        updateActiveSection(key);
        if (modalBodyRef) {
          const targetOffset = element.offsetTop - 16;
          modalBodyRef.scrollTo({
            top: targetOffset < 0 ? 0 : targetOffset,
            behavior: "smooth",
          });
        } else {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      tabButtons.push(button);
      tablist.appendChild(button);
    });
    main.appendChild(tablist);

    tablist.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      if (!tabButtons.length) return;
      const currentIndex = tabButtons.findIndex(
        (btn) => btn.dataset.tab === activeSectionKey
      );
      let targetIndex = currentIndex >= 0 ? currentIndex : 0;
      if (event.key === "ArrowRight") {
        targetIndex = (targetIndex + 1) % tabButtons.length;
      } else if (event.key === "ArrowLeft") {
        targetIndex = (targetIndex - 1 + tabButtons.length) % tabButtons.length;
      } else if (event.key === "Home") {
        targetIndex = 0;
      } else if (event.key === "End") {
        targetIndex = tabButtons.length - 1;
      }
      const targetBtn = tabButtons[targetIndex];
      if (targetBtn) {
        targetBtn.focus();
        targetBtn.click();
      }
    });
  }

  sections.forEach(({ key, element }, index) => {
    element.classList.toggle("active", index === 0);
    sectionsContainer.appendChild(element);
  });
  main.appendChild(sectionsContainer);

  const footer = createEl("div", "modal-actions");
  const watchedBtn = createEl(
    "button",
    `secondary-button watched-toggle${isWatched ? " active" : ""}`,
    isWatched ? "Mark as Unwatched" : "Mark as Watched"
  );
  watchedBtn.type = "button";
  watchedBtn.innerHTML = `<i class="fa-solid fa-eye"></i> ${
    isWatched ? "Unwatch" : "Mark as Watched"
  }`;
  watchedBtn.addEventListener("click", () => {
    if (typeof onWatchedToggle === "function") {
      const nowWatched = onWatchedToggle(movie);
      watchedBtn.classList.toggle("active", nowWatched);
      watchedBtn.innerHTML = `<i class="fa-solid fa-eye"></i> ${
        nowWatched ? "Unwatch" : "Mark as Watched"
      }`;
      statusBadge.classList.toggle("hidden", !nowWatched);
      badgeRow.classList.toggle("hidden", !nowWatched);
      statusCard.card.classList.toggle("accent", nowWatched);
      statusCard.valueEl.textContent = nowWatched ? "Watched" : "Want to watch";
      watchedBtn.classList.add("pulse-favorite");
      watchedBtn.addEventListener(
        "animationend",
        () => watchedBtn.classList.remove("pulse-favorite"),
        { once: true }
      );
    }
  });

  const favoriteBtn = createEl(
    "button",
    `primary-button favorite-toggle${isFavorite ? " active" : ""}`
  );
  favoriteBtn.type = "button";
  const updateFavoriteLabel = (active) => {
    favoriteBtn.innerHTML = `<i class="fa-solid fa-heart"></i> ${
      active ? "Remove from Favorites" : "Add to Favorites"
    }`;
  };
  updateFavoriteLabel(isFavorite);
  favoriteBtn.addEventListener("click", () => {
    if (typeof onFavoriteToggle === "function") {
      const nowFavorite = onFavoriteToggle(movie);
      favoriteBtn.classList.toggle("active", nowFavorite);
      updateFavoriteLabel(nowFavorite);
      favoriteBtn.classList.add("pulse-favorite");
      favoriteBtn.addEventListener(
        "animationend",
        () => favoriteBtn.classList.remove("pulse-favorite"),
        { once: true }
      );
    }
  });
  footer.append(watchedBtn, favoriteBtn);

  const { body: modalBody } = openModal(movie.title, content, footer);
  if (modalBody) {
    modalBody.scrollTop = 0;
    modalBodyRef = modalBody;
  }
  updateActiveSection(activeSectionKey);

  if (modalBodyRef && sections.length > 1) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.target.offsetTop - b.target.offsetTop);
        if (visible.length) {
          const key = visible[0].target.dataset.sectionKey;
          if (key && key !== activeSectionKey) {
            updateActiveSection(key);
          }
        }
      },
      {
        root: modalBodyRef,
        threshold: 0.55,
        rootMargin: "0px 0px -40% 0px",
      }
    );
    sections.forEach(({ element }) => sectionObserver.observe(element));
  }
};

export const openFavoritesModal = (favorites = [], onSelectMovie) => {
  const container = createEl("div", "favorites-list");
  if (!favorites.length) {
    container.appendChild(
      createEl("div", "empty-state", "Your watchlist is waiting for its first star.")
    );
  } else {
    favorites.forEach((movie) => {
      const item = createEl("button", "favorite-item");
      item.type = "button";
      const posterWrapper = createEl("div", "favorite-item-poster");
  const img = createEl("img", "");
  lazyLoadImage(img, movie.poster, { placeholder: "assets/placeholders/poster-fallback.png" });
      img.alt = `${movie.title} poster`;
      posterWrapper.appendChild(img);

      const info = createEl("div", "favorite-item-info");
      const title = createEl("h4", "favorite-item-title", movie.title);
      const meta = createEl("div", "favorite-item-meta");
      const year = (movie.releaseDate || "").split("-")[0] || "—";
      const yearSpan = createEl("span", "favorite-item-year", year);
      const isNumericRating = Number.isFinite(Number(movie.rating));
      const rating = createEl("span", "favorite-item-rating");
      rating.innerHTML = `<i class="fa-solid fa-star"></i> ${
        isNumericRating ? Number(movie.rating).toFixed(1) : "NR"
      }`;
      meta.append(yearSpan, rating);
      info.append(title, meta);

      item.append(posterWrapper, info);
      item.addEventListener("click", () => {
        closeTopModal();
        if (typeof onSelectMovie === "function") {
          onSelectMovie(movie);
        }
      });
      container.appendChild(item);
    });
  }
  openModal("Favorites", container, null, "favorites-modal");
};

export const openWatchedModal = (watched = [], onSelectMovie) => {
  const container = createEl("div", "favorites-list");
  if (!watched.length) {
    container.appendChild(
      createEl("div", "empty-state", "Mark movies as watched to build your history.")
    );
  } else {
    watched.forEach((movie) => {
      const item = createEl("button", "favorite-item");
      item.type = "button";
      const posterWrapper = createEl("div", "favorite-item-poster");
  const img = createEl("img", "");
  lazyLoadImage(img, movie.poster, { placeholder: "assets/placeholders/poster-fallback.png" });
      img.alt = `${movie.title} poster`;
      posterWrapper.appendChild(img);

      const info = createEl("div", "favorite-item-info");
      const title = createEl("h4", "favorite-item-title", movie.title);
      const meta = createEl("div", "favorite-item-meta");
      const year = (movie.releaseDate || "").split("-")[0] || "—";
      const yearSpan = createEl("span", "favorite-item-year", year);
      const isNumericRating = Number.isFinite(Number(movie.rating));
      const rating = createEl("span", "favorite-item-rating");
      rating.innerHTML = `<i class="fa-solid fa-star"></i> ${
        isNumericRating ? Number(movie.rating).toFixed(1) : "NR"
      }`;
      meta.append(yearSpan, rating);
      info.append(title, meta);

      item.append(posterWrapper, info);
      item.addEventListener("click", () => {
        closeTopModal();
        if (typeof onSelectMovie === "function") {
          onSelectMovie(movie);
        }
      });
      container.appendChild(item);
    });
  }
  openModal("Watched", container, null, "favorites-modal");
};

export const openCollectionModal = (
  collection,
  { onQueueMovie, onSelectMovie, onBulkQueue } = {}
) => {
  if (!collection) return;
  const content = createEl("div", "collection-modal-content");

  const header = createEl("div", "collection-modal-header");
  const title = createEl(
    "h3",
    "collection-modal-title",
    collection.name || "Collection"
  );
  header.appendChild(title);

  if (collection.overview) {
    const overview = createEl(
      "p",
      "collection-modal-overview",
      collection.overview
    );
    header.appendChild(overview);
  }

  const actions = createEl("div", "collection-modal-actions");
  const queueAllBtn = createEl(
    "button",
    "primary-button",
    "Queue Entire Collection"
  );
  queueAllBtn.type = "button";
  queueAllBtn.disabled = !collection.parts?.length || typeof onBulkQueue !== "function";
  queueAllBtn.addEventListener("click", async () => {
    if (queueAllBtn.disabled) return;
    queueAllBtn.disabled = true;
    queueAllBtn.setAttribute("aria-busy", "true");
    try {
      await onBulkQueue?.(collection.parts || []);
    } finally {
      queueAllBtn.removeAttribute("aria-busy");
      queueAllBtn.disabled = false;
    }
  });
  actions.appendChild(queueAllBtn);

  header.appendChild(actions);
  content.appendChild(header);

  const list = createEl("div", "collection-modal-list");
  const parts = Array.isArray(collection.parts) ? collection.parts : [];
  if (!parts.length) {
    list.appendChild(
      createEl(
        "div",
        "empty-state",
        "No films available in this collection yet."
      )
    );
  } else {
    parts.forEach((movie) => {
      const item = createEl("article", "collection-item");
      item.tabIndex = 0;
      item.dataset.movieId = movie.id;

      const thumb = createEl("div", "collection-item-thumb");
      const img = createEl("img");
      img.alt = `${movie.title} poster thumbnail`;
      lazyLoadImage(img, movie.poster, {
        srcset: movie.posterSet || "",
        sizes: "(max-width: 900px) 48vw, 160px",
      });
      thumb.appendChild(img);

      const info = createEl("div", "collection-item-info");
      const name = createEl("h4", "", movie.title);
      const meta = createEl("span", "collection-item-meta");
      const year = movie.releaseDate
        ? movie.releaseDate.split("-")[0]
        : "—";
      const rating = Number.isFinite(Number(movie.rating))
        ? Number(movie.rating).toFixed(1)
        : "NR";
      meta.textContent = `${year} • ★ ${rating}`;
      info.append(name, meta);

      const controls = createEl("div", "collection-item-controls");
      const openBtn = createEl("button", "collection-item-button", "");
      openBtn.type = "button";
      openBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      openBtn.title = "Open details";
      openBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (typeof onSelectMovie === "function") {
          closeTopModal();
          await onSelectMovie(movie);
        }
      });

      const queueBtn = createEl("button", "collection-item-button", "");
      queueBtn.type = "button";
      queueBtn.innerHTML = '<i class="fa-solid fa-list-check"></i>';
      queueBtn.title = "Queue movie";
      queueBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (typeof onQueueMovie === "function") {
          queueBtn.disabled = true;
          try {
            await onQueueMovie(movie);
          } finally {
            queueBtn.disabled = false;
          }
        }
      });

      controls.append(openBtn, queueBtn);

      item.append(thumb, info, controls);

      item.addEventListener("click", async () => {
        if (typeof onSelectMovie === "function") {
          closeTopModal();
          await onSelectMovie(movie);
        }
      });

      item.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (typeof onSelectMovie === "function") {
            closeTopModal();
            await onSelectMovie(movie);
          }
        }
      });

      list.appendChild(item);
    });
  }

  content.appendChild(list);
  openModal(collection.name || "Collection", content, null, "collection-modal");
};

export const openCastFilmographyModal = (
  person,
  movies = [],
  {
    favorites = [],
    watched = [],
    onFavoriteToggle,
    onWatchedToggle,
    onMovieSelect,
  } = {}
) => {
  const container = createEl("div", "filmography-list");
  const header = createEl("div", "filmography-header");
  header.innerHTML = `<h3>${person.name}'s Films</h3>`;
  container.appendChild(header);

  const favoriteIds = new Set(favorites.map((item) => Number(item.id)));
  const watchedIds = new Set(watched.map((item) => Number(item.id)));

  if (!movies.length) {
    container.appendChild(
      createEl(
        "div",
        "empty-state",
        `We could not find additional titles for ${person.name} just yet.`
      )
    );
  } else {
    const track = createEl("div", "filmography-track");
    movies.forEach((movie) => {
      const card = createMovieCard(movie, {
        variant: "compact",
        onCardClick: (selected) => {
          closeTopModal();
          if (typeof onMovieSelect === "function") {
            onMovieSelect(selected);
          }
        },
        onFavoriteToggle,
        onWatchedToggle,
        isFavorite: favoriteIds.has(Number(movie.id)),
        isWatched: watchedIds.has(Number(movie.id)),
      });
      track.appendChild(card);
    });
    enableHorizontalDrag(track);
    container.appendChild(track);
  }

  openModal(`${person.name} · Filmography`, container, null, "filmography-modal");
};

export const bindBackToTop = () => {
  const btn = backToTopBtn();
  if (!btn) return;
  btn.addEventListener("click", () => {
    scrollToTop();
  });
};

export const setBackToTopVisibility = (visible) => {
  const btn = backToTopBtn();
  if (!btn) return;
  btn.classList.toggle("visible", visible);
};

export const updateScrollProgress = (ratio = 0) => {
  const bar = scrollProgressBar();
  if (!bar) return;
  const value = Math.max(0, Math.min(1, ratio));
  bar.style.width = `${value * 100}%`;
};



export const closeActiveModal = () => {
  closeTopModal();
};

const ensureLoader = () => {
  // Lottie-based loader removed intentionally. This function remains as a
  // compatibility shim so callers (showLoader/hideLoader) can keep working
  // without attempting to fetch the JSON or load the lottie runtime.
  return;
};

// Backwards-compat shim: some modules still call `ensureLoaderAnimation`.
// Keep it defined so older callers don't throw; forward to the new shim.
const ensureLoaderAnimation = (...args) => ensureLoader(...args);

export const showLoader = () => {
  const overlay = loaderOverlay();
  if (!overlay) return;
  ensureLoaderAnimation();
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
};

export const hideLoader = () => {
  const overlay = loaderOverlay();
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
};

export const updateThemeButton = (themeObj = THEMES.dark) => {
  const btn = themeToggleBtn();
  if (!btn) return;
  btn.innerHTML = `<i class="fa-solid ${themeObj.icon}"></i>`;
};

export const configureThemeToggle = (handler) => {
  const btn = themeToggleBtn();
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (typeof handler === "function") {
      handler();
    }
  });
};

const renderDrawer = () => {
  const drawer = mobileDrawer();
  if (!drawer) return;
  const content = drawerBody();
  if (!content) return;
  content.innerHTML = "";

  const actions = [
    {
      id: DRAWER_ACTIONS.SEARCH,
      label: "Focus Search",
      icon: "fa-magnifying-glass",
    },
    {
      id: DRAWER_ACTIONS.FAVORITES,
      label: "Open Favorites",
      icon: "fa-heart",
    },
    {
      id: DRAWER_ACTIONS.WATCHED,
      label: "Watched History",
      icon: "fa-eye",
    },
    {
      id: DRAWER_ACTIONS.THEME,
      label: "Toggle Theme",
      icon: "fa-moon",
    },
  ];

  const actionSection = createEl("div", "drawer-section");
  const actionTitle = createEl("h3", "", "Quick Actions");
  const buttons = createEl("div", "drawer-actions");
  actions.forEach((action) => {
    const btn = createEl("button", "primary-button");
    btn.type = "button";
    btn.innerHTML = `<i class="fa-solid ${action.icon}"></i> ${action.label}`;
    btn.style.opacity = "0";
    btn.style.transform = "translateX(18px)";
    btn.addEventListener("click", () => {
      drawer.classList.remove("active");
      drawer.setAttribute("aria-hidden", "true");
      const handler = drawerHandlers[action.id];
      if (typeof handler === "function") {
        handler();
      }
    });
    buttons.appendChild(btn);
  });
  actionSection.append(actionTitle, buttons);
  content.append(actionSection);
};

export const configureDrawer = (handlers = {}) => {
  drawerHandlers = handlers;
  renderDrawer();
  const drawer = mobileDrawer();
  if (!drawer) return;
  const openBtn = document.getElementById("hamburger-button");
  const closeBtn = document.getElementById("drawer-close");
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      drawer.classList.add("active");
      drawer.setAttribute("aria-hidden", "false");
      const buttons = drawer.querySelectorAll(".drawer-actions button");
      buttons.forEach((btn) => {
        btn.style.opacity = "0";
        btn.style.transform = "translateX(18px)";
      });
      animateDrawerReveal();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      drawer.classList.remove("active");
      drawer.setAttribute("aria-hidden", "true");
    });
  }
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) {
      drawer.classList.remove("active");
      drawer.setAttribute("aria-hidden", "true");
    }
  });
};

export const closeDrawer = () => {
  const drawer = mobileDrawer();
  if (!drawer) return;
  drawer.classList.remove("active");
  drawer.setAttribute("aria-hidden", "true");
};
