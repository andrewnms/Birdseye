# Birdseye — Design System

> **See it. Learn it. Do it.**
> The single source of truth for Birdseye's brand and product design.
> Derived from the live site (https://openbirdseye.com) — use this to build the mobile app so web and app feel like one product.

---

## 1. Brand

| | |
|---|---|
| **Name** | Birdseye (wordmark: lowercase `birdseye`) |
| **Tagline** | See more. Learn better. Do more. |
| **Hero line** | See it. Learn it. Do it. |
| **Kicker** | Your real-time learning coach |
| **Personality** | Clean. Optimistic. Human. A patient expert, never a know-it-all. |
| **Domain** | openbirdseye.com |

Birdseye is a camera + voice AI learning coach. The design language is **friendly and encouraging**: rounded type, soft cards, colorful but never loud, always celebrating progress.

---

## 2. Logo & mark

The mark is a bird head that doubles as an eye: blue body, sweeping crest, white eye ring, deep-navy pupil with a white glint, coral beak at 4:30.

**Primary mark (blue on light)** — viewBox `0 0 120 120`:

```svg
<path fill="#4C8DFF" d="M4 24 C 22 4 58 0 88 18 L 60 68 Z"/>      <!-- crest -->
<circle cx="60" cy="68" r="42" fill="#4C8DFF"/>                    <!-- head -->
<path fill="#FF8A70" d="M92 90 C 102 96 107 105 108 116 C 95 113 86 105 81 95 Z"/> <!-- beak -->
<circle cx="71" cy="64" r="25" fill="#FFFFFF"/>                    <!-- eye ring -->
<circle cx="73" cy="66" r="15" fill="#16213E"/>                    <!-- pupil -->
<circle cx="66.5" cy="59" r="5" fill="#FFFFFF"/>                   <!-- glint -->
```

**App icon**: white bird (no eye ring — head is white, navy pupil, coral beak) centered on a Clear Sky `#4C8DFF` rounded square, corner radius ≈ 23% of icon size. Dark variant: same bird on Deep Navy `#16213E`.

**Wordmark**: `birdseye` lowercase, Fredoka SemiBold (600), Deep Navy on light / white on dark. Mark-to-wordmark gap ≈ 0.45× mark width. Minimum mark size 24px; drop the glint below 20px.

---

## 3. Color

### Core palette

| Token | Hex | Use |
|---|---|---|
| **Clear Sky** | `#4C8DFF` | Primary brand, links, active states, logo body |
| **Fresh Mint** | `#6ED8C5` | Success accents, gradient start, selection highlight |
| **Papaya Coral** | `#FF8A70` | Warm accents, beak, celebration, step-4/"do" energy |
| **Warm Sand** | `#FFF5E8` | Warm section backgrounds, cozy panels |
| **Cloud** | `#F7F9FC` | Card backgrounds, subtle fills |
| **Deep Navy** | `#16213E` | Headlines, body text, dark surfaces, footer |

### Extended (used in product)

| Token | Hex | Use |
|---|---|---|
| Teal (deep mint) | `#26B49C` / `#1E9C87` | Icon strokes, teal text on light |
| Purple | `#8B7CF6` | Gradient stop, step-3 color |
| Pink | `#FF5E8A` / `#E8548A` | Gradient stop, playful accents |
| Green (success) | `#34C08B` | Checkmarks, done states |
| Signal green | `#34E0A1` | "Detected" dots, live indicators (with glow) |
| Yellow | `#FFC900` | Confetti / cooking accent only |
| Muted text | `#5A6478` | Body copy on light |
| Soft text | `#64718F` | Captions, fine print (AA-safe on white) |
| Line | `#E3E9F2` | Borders, dividers |
| Dark surface | `#0D1428` / `#101A33` | Phone frame, camera fallback |
| Footer muted | `#A9B4CC` | Text on navy |

### Rules

- Text on white: Deep Navy for headings, `#5A6478` body, `#64718F` minimum for fine print (never lighter — contrast ≥ 4.5:1).
- One warm accent per composition — don't stack coral + pink + yellow in a single component.
- Success is green `#34C08B`; live/detected is signal green `#34E0A1` with a soft glow.

---

## 4. Gradients (signature)

| Name | CSS | Use |
|---|---|---|
| **Brand sweep** (buttons) | `linear-gradient(115deg, #26B49C, #4C8DFF 48%, #8B7CF6)` | All primary buttons & primary actions |
| **Voice** (mic, user bubbles) | `linear-gradient(135deg, #4C8DFF, #8B7CF6)` | Mic button, user chat bubbles |
| **Aurora field** (hero/marketing) | vertical multi-stop: `#6ED8C5 → #45B5EC → #4C8DFF → #8B7CF6 → #E86BC0 → #FF8A70 → #FFB36B` | Big brand moments: hero, splash, onboarding backdrops |
| **CTA banner** | `linear-gradient(96deg, #4C8DFF, #7B6CF6 36%, #C86CD8 62%, #FF7BA9 82%, #FF8A70)` | Full-bleed promo panels |
| **Headline trio** | See = `#1CB9A8 → #55BEEE` · Learn = `#4C8DFF → #8B7CF6` · Do = `#FF8A70 → #FF5E8A` | The three-line hero treatment only |

Button gradient behavior: `background-size: 170% 100%`, shift `background-position` 0% → 95% on hover/press for a living-gradient feel.

---

## 5. Typography

| Role | Font | Weights | Notes |
|---|---|---|---|
| **Headings / display** | **Fredoka** (Google Fonts) | 600 (SemiBold) default, 700 for big numerals | Rounded, friendly. h1–h3, wordmark, prices |
| **Body / UI** | **Satoshi** (Fontshare) | 400 / 500 / 700 | Everything else: paragraphs, buttons, labels, captions |

- App equivalents: iOS/Android — bundle both fonts; fall back to SF Pro Rounded / system rounded only if unavoidable.
- Heading letter-spacing: `-0.012em`. Body line-height: 1.6–1.72.
- Scale (web reference): h1 50–80px · h2 30–46px · section eyebrow 12px caps `+0.24em` tracking · body 15–16.5px · captions 12–13.5px.
- Eyebrow pattern: small uppercase letterspaced label above every section headline. The hero kicker uses gradient text (`#1CB9A8 → #4C8DFF → #FF5E8A`).
- Buttons: Satoshi 700, 14–15.5px.

---

## 6. Iconography

- **Style**: outline/stroke SVG, `stroke-width` 2–2.4, `round` caps + joins, 24 or 44 viewBox. Never emoji as UI icons (emoji allowed inside conversational message content only).
- **Color**: single brand color per icon (teal, sky, coral, green, purple) — matched to its card tint.
- **Tinted chip pattern**: icon sits in a 44px rounded square (radius 13px) filled with its color at 14–22% alpha. E.g. wrench `#E86A50` on `rgba(255,138,112,.16)`.
- Brand/company logos (integrations, trust rows): always Google's favicon service — `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://DOMAIN&size=64`.

---

## 7. Surfaces, radii, shadows

| Element | Radius |
|---|---|
| Section cards / panels | 22–28px |
| Small cards, chat sheet | 18px |
| Chips / overlay cards | 14–16px |
| Buttons, pills, inputs | 999px (full) |
| Icon chips | 13px |
| Phone frame / screen | 50px / 40px |

Shadows (soft, blue-tinted, never gray-harsh):

- Card: `0 12px 26px -20px rgba(22,33,62,.3)`
- Floating chip: `0 14px 30px -10px rgba(22,33,62,.42)`
- Primary button: `0 12px 26px -12px rgba(76,141,255,.65)`
- Sheet/modal: `0 24px 50px -18px rgba(22,33,62,.55)`

Backgrounds alternate for rhythm: white → Cloud card → Warm Sand section → white → navy footer. Dark surfaces use Deep Navy family, never pure black.

---

## 8. Components

### Buttons

| Variant | Spec |
|---|---|
| **Primary (gradient)** | Brand sweep gradient, white text, full radius, h 48px (52 in forms, 54 sticky), Satoshi 700 14.5px, blue glow shadow, hover: gradient slides + lift 2px, optional `→` arrow that nudges 3px |
| **Secondary (ghost)** | Transparent, 1.5px border `rgba(22,33,62,.2)`, navy text, h 48px; hover: navy border + 4% navy fill |
| **On-gradient** | Primary + inset white ring `inset 0 0 0 1.5px rgba(255,255,255,.38)` |
| Focus | `outline: 2.5px solid #16213E; outline-offset: 3px` |

Touch targets ≥ 44×44px always.

### Chips (overlay cards) — core app pattern

White card, radius 14–16px, padding 10–13px, 12–12.5px Satoshi 500, navy text, floating shadow. Variants:
- **Coach message**: plain text chip (+ optional speaker button in a white circle beside it).
- **Step chip**: tiny uppercase label (`STEP 2`, 9.5px, `+0.12em`, `#8A94AB`) + instruction + **progress dots** (5.5px circles, `#D7DEEB` → filled `#4C8DFF`).
- **Success chip**: leading 22px green circle with white check + bold text. Celebrate with an 8-piece confetti burst (brand colors, 0.95s, fly-out + rotate + fade).
- **Detect tag**: dark translucent pill `rgba(16,26,51,.76)`, white 10.5px text, glowing signal-green dot — for "Caliper detected" moments.

### Voice / conversation

- **Mic button**: 66px circle, Voice gradient, white mic glyph, white 14%-alpha outer ring. Listening state: pulsing ring animation (box-shadow expanding to 18px, 1.5s loop).
- **Listening pill**: dark translucent pill, "Listening…" + 5 equalizer bars (3px wide) each in a gradient color (mint→cyan→sky→purple→pink), staggered bounce.
- **User bubble**: Voice gradient, white text, radius `16 16 5 16` (tail bottom-right).
- **AI typing**: white chip with 3 bouncing gray dots.
- **Chat sheet**: white, radius 18px, header + messages (AI = Cloud bubble left, user = gradient bubble right) + pill input row. Slides up 14px on open.

### AR annotations (camera overlays)

- **Target ring**: 84–92px circle, 3px **dashed** `#3ED0B4`, scale-in from 0.45 with a soft spring; pulse (scale 1→1.14→1, 0.7s) on step changes.
- **Guide arrow**: 3.5–4px `#3ED0B4` stroke, round caps, **draws itself** (stroke-dashoffset animation ~0.8s), arrowhead appears after the line.
- **Secondary ring**: thin solid pink `rgba(255,123,169,.95)` for secondary points of interest.
- **Scan corners**: four 26px white L-brackets (3px, one rounded outer corner), framing the subject during detection.
- All overlays carry a subtle dark drop-shadow for legibility over camera feeds.

### Forms

Full-radius white input, h 52px, padding-inline 22px, placeholder `#97A0B5`; on gradient surfaces focus = white ring `0 0 0 3px rgba(255,255,255,.4)`. Always `autocomplete` + `inputmode`. Success state replaces the form with a check + confirmation line.

---

## 9. Motion

| | |
|---|---|
| Micro-interactions | 150–300ms, `ease` |
| Reveals / entrances | 450–800ms, `cubic-bezier(.16,.84,.28,1)` (soft decel) |
| Element entrances | fade + rise 8–28px; chips also scale 0.96 → 1 |
| Scroll reveals | IntersectionObserver, stagger siblings ~80–120ms |
| Signature moments | self-drawing arrows, ring spring-in, equalizer bars, confetti burst |
| Demo pacing | conversational beats ~0.8–2.2s apart (see hero demo timeline) |

**Always** honor `prefers-reduced-motion`: collapse to instant state changes, kill loops (marquee, pulse, bounce), skip auto-play sequences.

---

## 10. Voice & copy

- **Coach, not lecturer.** Short sentences. Second person. Present tense. One step at a time.
- Encourage constantly: "Great job! 🎉", "Nice work!", "You've got this."
- Steps are imperative + specific: "Loosen the bolt on the caliper", "Add fresh soil around the roots."
- AI acknowledges what it sees before instructing: "Got it — let's adjust your brakes. I can see the caliper."
- Never shame, never hedge. Emojis allowed sparingly **inside conversation content**, never as UI.
- CTA language: "Get Early Access", "Try it on your world", "See how it works". Objection-handlers everywhere a commitment happens: "No spam, just your invite", "No credit card required."

---

## 11. Accessibility checklist

- Text contrast ≥ 4.5:1 (fine print uses `#64718F` minimum on white).
- Touch targets ≥ 44px; visible focus rings on every interactive element (navy ring on gradient surfaces).
- `alt` on meaningful images, `aria-label` on icon-only buttons, `aria-hidden` on decorative SVG.
- Camera overlays must remain legible over any feed (shadow or dark-pill backing).
- Reduced motion fully supported (see §9).

---

## 12. Assets & references

| Asset | Location |
|---|---|
| Live site | https://openbirdseye.com |
| Site source | `public/` in this repo (`index.html` has all logo/icon SVG inline) |
| Favicon / app icon | `public/favicon.svg` |
| Fredoka | `https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap` |
| Satoshi | `https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap` |
| In-app UI reference | Hero phone demo on the live site — chips, mic states, AR annotations, chat sheet are the app's component blueprint |
| Deploy | `npx wrangler deploy` (Cloudflare Worker `birdseye`, Marc Media account) |
