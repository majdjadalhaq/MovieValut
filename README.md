# 🎬 MovieVault – Cinematic Discovery Interface

MovieVault is a premium, Netflix-inspired movie discovery experience built with semantic HTML, modular CSS, and modern ES modules. It delivers rich browsing, advanced filtering, and polished micro-interactions — all with zero frameworks and a security-first approach to API keys.

---

## 🔍 Preview

| Desktop Preview | Mobile Drawer |
| --------------- | ------------- |
| _Add your 1920×1080 screenshot or GIF here_ | _Add your 414×896 screenshot or GIF here_ |

---

## ✨ Features

- **Transparent Sticky Toolbar** that keeps category chips and multi-select genres anchored beneath the main header.
- **Infinite TMDB Catalog** with trending, popular, top-rated, upcoming, and genre-curated feeds.
- **Debounced Search** exposing movies, people, and collections with keyboard navigation.
- **Rich Movie Modals** featuring cast, trailers, runtime, and watchlist actions.
- **Favorites & Watched Drawers** persisted in localStorage with undo toasts.
- **Session Planner** drag-and-drop queue with haptic feedback and runtime summaries.
- **Theme Toggle & Micro-Interactions** leveraging CSS custom properties, GSAP, and custom keyframes.
- **Intelligent Caching Layer** with retry logic, TTL-based localStorage, and toast notifications.

---

## 🛠 Tech Stack

- **Markup:** Semantic HTML5 with ARIA landmarks and accessible navigation.
- **Styling:** Structured CSS modules (`core`, `layout`, `components`, `overlays`, `animations`, `responsive`) using CSS custom properties, fluid spacing, and backdrop effects.
- **Logic:** Vanilla ES modules, async/await, fetch, IntersectionObserver, GSAP 3, and Lottie.
- **Data:** TMDB REST API (movies, people, collections, assets).
- **State & Storage:** In-memory state container plus localStorage caching and preferences.

---

## 🗂 Folder Structure

```
MovieVault/
├── index.html                 # Base document + script/style wiring
├── README.md                  # Project documentation (this file)
├── .gitignore                 # Keeps private config out of git history
├── assets/                    # Static imagery, icons, lottie animations
├── scripts/
│   ├── app.js                 # Application bootstrap & event orchestration
│   ├── api.js                 # TMDB networking with caching & mappers
│   ├── config.js              # Configuration with TMDB API key (gitignored)
│   ├── constants.js           # Global constants & enums
│   ├── helpers.js             # Shared utilities (storage, debounce, DOM)
│   └── ui.js                  # DOM rendering, animations, and UI helpers
└── styles/
    ├── core.css               # Reset, tokens, typography, base theme
    ├── layout.css             # Macro layout (header, toolbar, grid)
    ├── components.css         # Buttons, cards, nav, planner
    ├── overlays.css           # Modal, drawer, toast styling
    ├── animations.css         # Keyframes & animation helpers
    └── responsive.css         # Breakpoint-specific refinements
```

---

## ⚙️ Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-handle/movievault.git
   cd movievault
   ```
2. **Add your TMDB API key**
   Copy `scripts/config.template.js` to `scripts/config.js` and replace `"your_tmdb_api_key_here"` with your actual TMDB API key. The `.gitignore` entry prevents `config.js` from being committed.
3. **Open the app**
   - Double-click `index.html`, or
   - Serve locally (recommended for CORS safety):
     ```bash
     npx http-server .
     ```
4. **Explore**
   - Scroll trending feeds, use the sticky genre filters, open modals, toggle themes, and manage the planner.

---

## 🔐 Security Notes

- API keys live outside source control in `scripts/config.js` (gitignored).
- Never hardcode your TMDB or YouTube keys in tracked files.
- When deploying, configure the platform to inject `window.__MOVIEVAULT_CONFIG` at runtime (e.g., via server-side template or secure secret management).

---

## 🚧 Future Improvements

- **Serverless Proxy:** Move TMDB calls behind a signed serverless endpoint to hide client keys in production.
- **Offline Snapshot:** Add IndexedDB caching for last-viewed titles and metadata to support offline browsing.
- **Recommendation Engine:** Incorporate collaborative filtering (e.g., similarity scoring) to enhance the planner suggestions.
- **Accessibility Audit:** Expand keyboard shortcuts, improve focus trapping across modals/drawers, and add localization support.
- **Performance Budgets:** Implement automated Lighthouse checks and CSS/JS bundle size limits for CI gating.

---

## 📄 License

This project is licensed under the **MIT License**. You are free to use, modify, and distribute it. Please retain attribution.

---

Crafted with care by a senior front-end engineer. If this project inspires your next cinematic build, give it a ⭐️ and share the experience! 🎥
