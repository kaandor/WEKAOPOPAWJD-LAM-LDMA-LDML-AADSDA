# KLYX IPTV App — Page Design Spec (Desktop-first)

## Global (applies to all pages)
### Layout
- Primary system: CSS Grid for page shells (header/content), Flexbox inside modules (rails, cards, forms).
- Breakpoints: desktop (≥1200px) is default; tablet (768–1199px) reduces rail columns; mobile (<768px) stacks sections.

### Meta Information (defaults)
- Title template: `KLYX — {Page}`
- Description: `Stream movies, series, and live TV with KLYX.`
- Open Graph: `og:title`, `og:description`, `og:type=website`, `og:image` (brand banner), `og:url`.

### Global Styles (design tokens)
- Background: #0B0E14
- Surface: #121826
- Text primary: #E6EAF2; text secondary: #A7B0C0
- Accent: #6D5EF5
- Danger: #F04438
- Typography scale: 12/14/16 body, 20/24 headings, 32 hero.
- Buttons: primary filled accent; secondary outline; disabled 40% opacity.
- Links: accent color; underline on hover.
- Focus states: 2px outline accent, offset 2px.
- Motion: 150–250ms transitions for hover/focus; avoid heavy animation during playback.

### Shared Components
- Top App Bar: logo (left), nav tabs (Movies/Series/Live/Search), account button (right).
- Content Card: poster/thumbnail, title, type badge; hover raises surface + shows play icon.
- Toast/Inline Alerts: success/error for auth, playback, network issues.
- Empty/Loading: skeletons for rails and details; friendly empty states for search.

---

## 1) Auth — Login / Register
### Meta
- Title: `KLYX — Sign in` / `KLYX — Create account`

### Page Structure
- Centered auth panel on dark background; optional subtle brand gradient.

### Sections & Components
1. Header: logo + short tagline.
2. Auth Tabs: “Login” and “Register” (or separate routes).
3. Form:
   - Email input
   - Password input
   - Register only: confirm password
   - Primary CTA: “Sign in” / “Create account”
4. Error handling: inline field errors + top-level form error.
5. Footer links: Terms/Privacy placeholders (non-functional unless you add them later).

### Interactions
- On success: redirect to Home.
- If already authenticated: redirect to Home.

---

## 2) Home (Browse)
### Meta
- Title: `KLYX — Browse`

### Page Structure
- Shell: sticky top app bar + scrollable content area.
- Content: stacked sections with rails (horizontal) and occasional grid blocks.

### Sections & Components
1. Top App Bar: nav + account.
2. Featured Row: large hero card for highlighted item (optional single item).
3. Movies Rail:
   - Section title + “See all” (optional)
   - Horizontal card rail
4. Series Rail:
   - Same structure as Movies
5. Live Entry:
   - Row of featured channels or a “Browse Live” panel

### Interactions
- Clicking a card opens Details.
- Protected route: if JWT invalid/expired, redirect to Login.

---

## 3) Details & Player
### Meta
- Title: `KLYX — {Title}`
- OG: `og:title={Title}`, `og:image={posterUrl}`

### Page Structure
- Two-column layout on desktop:
  - Left: poster + metadata + actions
  - Right: player (or episode list for series)

### Sections & Components
1. Details Header (left column):
   - Poster/thumbnail
   - Title, type badge (Movie/Series/Live)
   - Short description
2. Primary Action:
   - Movie: “Play” and “Resume” (if progress exists)
   - Live: “Watch live”
3. Series Panel (right column when series):
   - Season selector (dropdown)
   - Episode list (vertical)
4. Player Panel (right column when playing):
   - HTML5 `<video>` element
   - HLS playback via hls.js fallback (native HLS when available)
   - Controls: play/pause, seek bar, time elapsed/remaining, volume, fullscreen
   - Live mode: live indicator + “Go Live” button (jump to live edge)
   - States: loading spinner, playback error with retry
5. Continue Watching:
   - On pause/exit: save playback position
   - On load: prompt to resume

---

## 4) Search
### Meta
- Title: `KLYX — Search`

### Page Structure
- Top search bar + results area.
- Results default to a responsive grid.

### Sections & Components
1. Search Bar:
   - Input with placeholder “Search movies, series, live…”
   - Clear (x) button
2. Type Filters:
   - Toggle chips: All / Movies / Series / Live
3. Results Grid:
   - Content cards; supports empty state (“No results”)
4. Recent Searches (optional if stored locally):
   - Quick chips below the search bar

### Interactions
- Debounced search as you type; enter triggers immediate search.
- Clicking a result opens Details.

---

## 5) Profile & Settings
### Meta
- Title: `KLYX — Account`

### Page Structure
- Two-column settings layout:
  - Left: settings navigation
  - Right: panel content

### Sections & Components
1. Settings Nav (left): Profile, Security, Preferences.
2. Profile Panel:
   - Read-only email
   - Editable display name
   - Save button + success/error feedback
3. Security Panel:
   - Current password
   - New password
   - Confirm new password
   - Update password CTA
4. Preferences Panel:
   - Autoplay next episode toggle
5. Logout:
   - Prominent button at bottom

### Interactions
- Saving settings shows inline validation and toast confirmation.
- Logout clears session and redirects to Login.
