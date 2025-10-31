# 🎬 MovieVault • Modern Film Explorer

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![TMDB API](https://img.shields.io/badge/TMDB_API-E50914?style=for-the-badge&logo=the-movie-database&logoColor=white)

A beautiful, performant movie discovery platform built with vanilla JavaScript and the TMDB API

---

## 📖 About

**MovieVault** is a cutting-edge single-page application that brings the cinematic universe to your browser. Curate watchlists, discover trending blockbusters, and explore filmographies with an intuitive drag-and-drop interface. Built with **zero frameworks**—pure HTML, CSS, and JavaScript for maximum performance and accessibility.

### ✨ Key Highlights

- 🎯 **Framework-free** architecture—no build step required
- 🎨 **Glassmorphism design** with smooth animations
- ♿ **WCAG 2.1 AA** compliant accessibility
- 📱 **Responsive** across all device sizes
- ⚡ **Optimized** with lazy loading, caching, and prefetching
- 🎭 **Rich interactions** including drag-to-plan and magnetic tilt effects

---

## 🚀 Features

### Core Functionality

- **📊 Movie Discovery** - Browse trending, popular, top-rated, and upcoming releases
- **🔍 Advanced Search** - Multi-column search across movies, people, and collections
- **🎭 Genre Filtering** - Stack multiple genres for refined discovery
- **⭐ Favorites & Watch History** - Track your personalized lists locally
- **🎪 Session Planner** - Drag-and-drop marathon queue with runtime tracking
- **🎥 Detailed Views** - Comprehensive modals with cast, trailers, and stats

### User Experience

- **🎨 Theme Switcher** - Light/Dark mode with system preference detection
- **⌨️ Keyboard Navigation** - Full accessibility support (ESC, arrow keys, Enter)
- **📏 Infinite Scroll** - Seamless pagination with Intersection Observer
- **💾 Smart Caching** - 10-minute TTL with localStorage persistence
- **🔄 Drag & Throw Gestures** - Intuitive poster-to-planner interactions
- **🎭 Magnetic Tilt** - Subtle 3D hover effects on movie cards
- **📱 Progressive Enhancement** - Works offline with graceful degradation

### Accessibility

- **🌐 Screen Reader Support** - Semantic HTML and ARIA labels
- **🔊 Live Announcements** - Dynamic content updates via `aria-live`
- **🎨 Color Contrast** - WCAG AAA compliant color schemes
- **⚡ Reduced Motion** - Respects `prefers-reduced-motion`
- **🏗️ Focus Management** - Visible focus indicators and logical tab order

---

## 🛠️ Technologies Used

| Category | Technologies |
|----------|--------------|
| **Frontend** | HTML5, CSS3 (Custom Properties, Grid, Flexbox), Vanilla JavaScript (ES6+) |
| **Animation** | GSAP 3.12.2, CSS Transitions, Web Animations API |
| **API** | [The Movie Database (TMDB)](https://www.themoviedb.org/) REST API v4 |
| **Storage** | localStorage with TTL-based caching |
| **Icons** | Font Awesome 6.5.1 |
| **Fonts** | Inter (body), Poppins (headings) - Google Fonts |
| **Build** | None - zero dependencies, deploy-ready |

---

## 📁 Project Structure

```text
MovieVault/
├── index.html                  # Main HTML entry point
├── assets/
│   ├── logo.svg               # Brand logo
│   └── placeholders/
│       └── poster-fallback.png # Image fallback
├── scripts/
│   ├── app.js                 # Application bootstrap & state management
│   ├── api.js                 # TMDB API communication layer
│   ├── ui.js                  # DOM rendering & micro-interactions
│   ├── helpers.js             # Shared utilities (cache, storage, etc.)
│   ├── constants.js           # App-wide constants & configuration
│   └── config.js              # API keys & environment setup
└── styles/
    ├── core.css               # Theme tokens, reset, base styles
    ├── layout.css             # Grid, flexbox, page structure
    ├── components.css         # Buttons, cards, modals, forms
    ├── overlays.css           # Drawers, search overlay, tutorials
    ├── animations.css         # Keyframes, transitions, transforms
    └── responsive.css         # Breakpoints & mobile adaptations
```

---

## 🚀 Getting Started

### Prerequisites

- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- TMDB API key ([Get one free](https://www.themoviedb.org/settings/api))

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/MovieVault.git
   cd MovieVault
   ```

2. **Add your TMDB API key**

   Open `scripts/config.js` and replace the placeholder:

   ```javascript
   const TMDB_V4_TOKEN = "your_tmdb_api_key_here";
   ```

   Or use the provided token in `config.js` (if available).

3. **Launch locally**

   **Option A: Python HTTP Server**

   ```bash
   python3 -m http.server 8000
   ```

   **Option B: Node.js HTTP Server**

   ```bash
   npx http-server -p 8000
   ```

   **Option C: VS Code Live Server**

   - Install "Live Server" extension
   - Right-click `index.html` → "Open with Live Server"

4. **Access the app**

   Open `http://localhost:8000` in your browser.

### Production Deployment

#### GitHub Pages

1. Push your repo to GitHub
2. Go to **Settings → Pages**
3. Select `main` branch and `/` root
4. Deploy and access via `https://username.github.io/MovieVault`

#### Netlify/Vercel

- Drag-and-drop the `MovieVault` folder to deploy instantly
- Or connect your GitHub repo for auto-deployments

---

## 📸 Screenshots

Click to view screenshots:

### 🎬 Main Dashboard

![Main Dashboard](./docs/screenshots/dashboard.png)

### 🔍 Search Overlay

![Search Overlay](./docs/screenshots/search.png)

### 🎭 Movie Details Modal

![Movie Details](./docs/screenshots/modal.png)

### 📋 Session Planner

![Session Planner](./docs/screenshots/planner.png)

### 📱 Mobile View

![Mobile View](./docs/screenshots/mobile.png)

---

## 💻 Code Style & Best Practices

### JavaScript

- **ES6+ Modules** - Modern import/export syntax
- **DRY Principles** - Reusable helper functions
- **Separation of Concerns** - Modular architecture (API, UI, State, Helpers)
- **Async/Await** - Promise-based async operations
- **Error Handling** - Comprehensive try-catch blocks
- **Performance** - Debouncing, throttling, Intersection Observer
- **Accessibility** - Semantic HTML, ARIA attributes, keyboard navigation

### CSS

- **CSS Custom Properties** - Theme tokens for easy customization
- **BEM-like Naming** - Semantic class names
- **Mobile-First** - Progressive enhancement approach
- **Animations** - Hardware-accelerated transforms
- **Glassmorphism** - Modern frosted glass effects
- **Responsive Typography** - Fluid `clamp()` functions

### Architecture

- **State Management** - Centralized `app.js` with localStorage sync
- **API Layer** - Abstraction over TMDB with caching
- **Event Delegation** - Efficient event handling
- **Lazy Loading** - Images load on-demand with Intersection Observer
- **Prefetching** - Next page loaded in background
- **Cache Strategy** - 10-minute TTL with automatic expiration

---

## 🎯 Performance Optimizations

- ⚡ **Code Splitting** - Load stylesheets on-demand for overlays
- 🖼️ **Lazy Images** - `loading="lazy"` with Intersection Observer
- 💾 **API Caching** - localStorage with TTL prevents redundant requests
- 📦 **Prefetching** - Next page loaded in `requestIdleCallback`
- 🎨 **Debouncing** - Search input throttled to 400ms
- 🔄 **Virtual Scrolling** - Max 300 movies in memory
- 🎭 **GSAP Animations** - GPU-accelerated transforms
- 🏷️ **Alt Text** - Descriptive alt attributes for SEO

---

## 🔒 Security & Privacy

- ✅ API key stored client-side (required for TMDB v4)
- ✅ No user data transmitted beyond API calls
- ✅ localStorage isolation per domain
- ✅ HTTPS recommended for production
- ✅ CORS handled by TMDB servers
- ✅ XSS protection via DOM sanitization

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

- **Data Provider** - [The Movie Database (TMDB)](https://www.themoviedb.org/) API
- **Icons** - [Font Awesome](https://fontawesome.com/)
- **Fonts** - [Google Fonts](https://fonts.google.com/) (Inter, Poppins)
- **Animations** - [GSAP](https://greensock.com/gsap/)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📧 Contact

- **Project Maintainer** - [Your Name](https://github.com/yourusername)
- **Project Link** - [MovieVault Repository](https://github.com/yourusername/MovieVault)
- **Live Demo** - [https://yourusername.github.io/MovieVault](https://yourusername.github.io/MovieVault)

---

## 🌟 Acknowledgments

Special thanks to the TMDB community for providing an incredible free API for movie enthusiasts worldwide.

---

Made with ❤️ and lots of ☕ by [Your Name]

⭐ Star this repo if you find it helpful!
