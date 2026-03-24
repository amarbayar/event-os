# Design System — Event OS

## Product Context
- **What this is:** Event management platform — hybrid web app + Telegram agent for running recurring developer conferences
- **Who it's for:** Small event organizing teams (3-5 people) in markets where enterprise tools don't work (Mongolia first, then Central Asia, SE Asia)
- **Space/industry:** Event management (peers: Cvent, Bizzabo, Sessionize — all enterprise, expensive, generic)
- **Project type:** Web app / dashboard (APP UI) — agenda builder, check-in, stakeholder portals
- **Tech stack:** Next.js + shadcn/ui + Tailwind CSS + Drizzle ORM

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian with warmth
- **Decoration level:** Minimal — typography and layout do all the work. No decorative gradients, blobs, or illustrations. Status colors and badges are the only visual accent.
- **Mood:** Confident, calm, human-centered command center. Like Linear's density and keyboard-first feel, but with warm tones because this tool manages human connections (speakers, sponsors, attendees), not just data. Speed is the brand.
- **Reference:** Linear (calm + dense), Notion (workspace feel), Vercel dashboard (dark sidebar + clean content)

## Typography
- **Display/Hero:** Cabinet Grotesk Bold — geometric but with character. Confident without being cold. Used for page titles, hero text, section headers.
- **Body:** DM Sans — clean, readable at small sizes, excellent tabular-nums support. Used for all body text, labels, descriptions.
- **UI/Labels:** DM Sans Medium (same as body, weight 500)
- **Data/Tables:** DM Sans with font-variant-numeric: tabular-nums — numbers align in columns
- **Code:** JetBrains Mono — clear distinction between similar characters (0/O, 1/l/I)
- **Loading:** Google Fonts CDN (`family=DM+Sans:wght@300;400;500;600;700` + `family=JetBrains+Mono:wght@400;500`). Cabinet Grotesk via cdnfonts or self-hosted.
- **Scale:**
  - xs: 11px / 0.6875rem
  - sm: 13px / 0.8125rem
  - base: 14px / 0.875rem
  - lg: 16px / 1rem
  - xl: 20px / 1.25rem
  - 2xl: 24px / 1.5rem
  - 3xl: 32px / 2rem
  - display: 42px / 2.625rem

## Color
- **Approach:** Restrained — 1 bold accent + warm neutrals. Color is rare and meaningful.
- **Primary/Accent:** #eab308 (yellow-500) — vibrant, energetic, unmistakably Event OS. Dark text on yellow backgrounds for contrast.
- **Accent hover:** #facc15 (yellow-400)
- **Accent light:** #fefce8 (yellow-50) — for subtle highlights, active rows
- **Accent dark (for text on light bg):** #a16207 (yellow-700) — when yellow needs to be readable as text
- **Neutrals (warm stone):**
  - 50: #fafaf9 (page background)
  - 100: #f5f5f4
  - 200: #e7e5e4 (borders)
  - 300: #d6d3d1
  - 400: #a8a29e (muted text)
  - 500: #78716c (secondary text)
  - 600: #57534e
  - 700: #44403c
  - 800: #292524
  - 900: #1c1917 (primary text, sidebar background)
  - 950: #0c0a09 (dark mode background)
- **Semantic:**
  - Success: #047857 (emerald-700) / light: #ecfdf5
  - Warning: #ea580c (orange-600) / light: #fff7ed — NOT yellow (avoids accent conflict)
  - Error: #b91c1c (red-700) / light: #fef2f2
  - Info: #0284c7 (sky-600) / light: #f0f9ff
- **Dark mode strategy:**
  - Background: stone-950 (#0c0a09)
  - Surface: stone-900 (#1c1917)
  - Elevated surface: stone-800 (#292524)
  - Border: stone-800 (#292524)
  - Text: stone-100 (#f5f5f4)
  - Secondary text: stone-400 (#a8a29e)
  - Accent: #facc15 (yellow-400) — brighter yellow for dark backgrounds
  - Accent light: #422006 — deep warm tint for active states
  - Reduce semantic color saturation 10-20% for dark mode comfort

## Spacing
- **Base unit:** 4px
- **Density:** Compact — this is a data-dense command center, not a spacious marketing page
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Content padding:** 24px (desktop), 16px (mobile)
- **Section spacing:** 32px between major sections
- **Card padding:** 14px-18px (compact)

## Layout
- **Approach:** Grid-disciplined — collapsible left sidebar, consistent content area
- **Sidebar:** 220px width, dark background (stone-900), collapsible to 56px icon-only
- **Grid:** 12 columns on desktop, 4 columns on tablet, 1 column on mobile
- **Max content width:** 1280px
- **Breakpoints:** sm(640px) md(768px) lg(1024px) xl(1280px)
- **Border radius:** Hierarchical scale:
  - sm: 4px (inputs, small badges)
  - md: 6px (buttons, cards, alerts)
  - lg: 8px (modals, panels)
  - xl: 12px (page sections)
  - full: 9999px (pills, avatar circles)

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension. Speed is the brand.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(100ms) short(150ms) medium(200ms) — nothing over 200ms
- **What gets motion:** sidebar collapse/expand, dropdown/popover open/close, page transitions (opacity fade), toast notifications (slide in from top)
- **What does NOT get motion:** data table rows, badge changes, form validation, stat updates

## Component Patterns
- **Buttons:** primary (yellow bg + dark text), secondary (border + text), ghost (no border), danger (red tint)
- **Badges:** pill-shaped (full radius), semantic color backgrounds with matching text. Always include text label, never color-only.
- **Tables:** DM Sans, tabular-nums for numbers, hover highlight with accent-light, sticky headers
- **Inputs:** stone-200 border, accent border on focus, 8px-12px padding, stone-400 placeholder
- **Alerts:** full-width, semantic light background + matching text, left-aligned, no icons by default
- **Sidebar nav:** dark background, icon + text, active state = accent color with subtle background tint
- **Empty states:** centered text + primary action button. Warm, helpful copy — never "No items found."

## Anti-Patterns (never use)
- Purple/violet gradients
- 3-column feature grid with icons in colored circles
- Centered everything with uniform spacing
- Uniform bubbly border-radius on every element
- Decorative blobs, floating circles, wavy SVG dividers
- Colored left-border on cards (border-left: 3px solid)
- Generic hero copy ("Welcome to Event OS", "Your all-in-one solution")
- Inter, Roboto, Arial, or system fonts as primary typography

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-23 | Initial design system created | Created by /design-consultation. Industrial/utilitarian with warmth, yellow accent on warm stone neutrals. |
| 2026-03-23 | Yellow (#eab308) chosen over teal and amber | User preference for strong, vivid yellow. Most distinctive choice — no event management tool uses yellow as primary. |
| 2026-03-23 | Cabinet Grotesk + DM Sans chosen | Geometric display font with character (Cabinet Grotesk) + clean body font with tabular-nums (DM Sans). Avoids overused Inter/Roboto. |
| 2026-03-23 | Warning color shifted to orange (#ea580c) | Avoids confusion with yellow primary accent. Orange is visually distinct from yellow. |
| 2026-03-23 | shadcn/ui + Tailwind CSS chosen | Accessible components out of the box. Theme customizable to match this design system. |
