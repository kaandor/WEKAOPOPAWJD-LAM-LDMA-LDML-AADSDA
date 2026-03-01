# Klyx Official Marketing Website — Page Design Specification (Desktop-first)

## Global Styles (Design Tokens)

* Layout grid: 12-column container, max-width 1200px, 24px gutters; section vertical padding 64–96px.

* Colors:

  * Background: #0B0F17 (dark) or #FFFFFF (light). Default: dark.

  * Surface: #111827, border: rgba(255,255,255,0.08)

  * Text primary: #F9FAFB, text secondary: rgba(249,250,251,0.72)

  * Accent: #6D28D9 (primary), hover: #7C3AED

* Typography:

  * H1 48/56, H2 32/40, H3 20/28, Body 16/24, Small 14/20

  * Font: Inter (or system sans fallback)

* Buttons:

  * Primary: filled accent; hover lifts (translateY -1px) + subtle shadow

  * Secondary: outline with 1px border; hover background on surface

  * Disabled (for placeholders): reduced opacity, no hover

* Links: underline on hover; focus ring: 2px accent

* Motion: 150–200ms ease-out for hover/expand/lightbox

* Breakpoints:

  * Desktop (default): >=1024

  * Tablet: 768–1023 (reduce columns, tighten spacing)

  * Mobile: <768 (single-column, stacked CTAs)

***

## Page: Home (/)

### Layout

* Hybrid: CSS Grid for section layouts, Flexbox for nav and CTAs.

* Sticky top navbar on scroll; content sections stacked vertically.

### Meta Information

* Title: "Klyx — \[Tagline]"

* Description: "Discover Klyx: features, screenshots, and what’s coming next."

* Open Graph: og:title, og:description, og:type=website, og:image (placeholder), og:url

### Page Structure

1. Top Navigation
2. Hero (App presentation)
3. Features
4. Screenshots Preview
5. FAQ
6. Footer

### Sections & Components

1. Top Navigation (sticky)

* Left: wordmark/logo

* Center/right: anchor links (Features, Screenshots, FAQ) + link to Gallery

* Right: CTA buttons "Login" and "Download" (route to `/coming-soon?intent=...`)

* Interaction: active section highlight on scroll (optional), focus-visible ring

1. Hero (App presentation)

* Two-column grid:

  * Left: H1 headline, 1–2 line value proposition, short supporting paragraph

  * CTA row: Primary "Download" (placeholder), Secondary "Login" (placeholder)

  * Microcopy: "Coming soon" text under CTAs (subtle)

  * Right: device mock (static image placeholder)

1. Features

* Section header (H2 + short intro)

* 3–6 feature cards (responsive grid 3 columns desktop, 2 tablet, 1 mobile)

* Card: icon placeholder, feature title, 1–2 line description

1. Screenshots Preview

* Horizontal row or 2x2 mini-grid of 4–6 screenshots

* Each screenshot: image + caption

* Primary link/button: "View all screenshots" -> /gallery

1. FAQ

* Accordion list (6–10 items max)

* Interaction: expand/collapse with smooth height transition; only one open at a time (optional)

1. Footer

* Columns: Product, Company, Legal (all can be placeholders)

* Bottom row: copyright

* Repeat CTAs: Login/Download (placeholders)

***

## Page: Gallery (/gallery)

### Layout

* CSS Grid gallery: 3–4 columns desktop, 2 tablet, 1 mobile.

* Filter row using Flex wrap.

### Meta Information

* Title: "Klyx Screenshots Gallery"

* Description: "Explore Klyx screenshots across key flows."

* Open Graph: og:title, og:description, og:image (first screenshot placeholder)

### Page Structure

1. Header + breadcrumbs/light back link
2. Filter chips
3. Gallery grid
4. Lightbox overlay (on demand)

### Sections & Components

1. Header

* Title, short description

* Back link: "← Home"

1. Filter chips

* Chips: All, Onboarding, Core, Settings (labels are placeholders)

* Interaction: selected state; client-side filter only

1. Gallery grid

* Card: screenshot thumbnail, caption, category tag

* Interaction: click opens lightbox

1. Lightbox

* Fullscreen overlay, dark backdrop

* Centered image, caption, close button (top-right)

* Prev/Next controls (keyboard arrows optional)

***

## Page: Coming Soon (/coming-soon)

### Layout

* Centered single-column layout using Flexbox (min-height: 70vh).

### Meta Information

* Title: "Coming Soon — Klyx"

* Description: "This feature isn’t available yet."

* Open Graph: og:title, og:description

### Page Structure

1. Minimal header (optional)
2. Message card
3. Navigation actions

### Sections & Components

1. Message card

* Icon placeholder + H2 "Login coming soon" or "Download coming soon"

* Body text: brief explanation that it’s a placeholder

1. Actions

* Primary button: "Back to Home"

* Secondary link/button: "View screenshots" -> /gallery

* Optional: show disabled input/button as a visual placeholder (no data collection)

