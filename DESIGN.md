---
name: Coffee Shop
description: A warm-utilitarian, self-hosted coffee-shop operations app — counter-first, single shop, no vendor lock-in.
colors:
  honey-50: "#fffbeb"
  honey-100: "#fef3c7"
  honey-200: "#fde68a"
  honey-300: "#fcd34d"
  honey-400: "#fbbf24"
  honey-500: "#f59e0b"
  honey-600: "#d97706"
  honey-700: "#b45309"
  honey-800: "#92400e"
  honey-900: "#78350f"
  roast-50: "#fafaf9"
  roast-100: "#f5f5f4"
  roast-200: "#e7e5e4"
  roast-300: "#d6d3d1"
  roast-400: "#a8a29e"
  roast-500: "#78716c"
  roast-600: "#57534e"
  roast-700: "#44403c"
  roast-800: "#292524"
  roast-900: "#1c1917"
  roast-950: "#0c0a09"
  signal-50: "#fef2f2"
  signal-200: "#fecaca"
  signal-600: "#dc2626"
  signal-700: "#b91c1c"
  sage-50: "#ecfdf5"
  sage-200: "#a7f3d0"
  sage-800: "#065f46"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.18em"
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  2xl: "1rem"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
  8: "2rem"
  10: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.honey-700}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
  button-primary-hover:
    backgroundColor: "{colors.honey-600}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.roast-900}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
  alert-error:
    backgroundColor: "{colors.signal-50}"
    textColor: "{colors.signal-700}"
    rounded: "{rounded.xl}"
    padding: "1rem"
---

# Design System: Coffee Shop

## Overview

**Creative North Star: "The Counter at Dawn"**

Before the first customer comes in, the shop is quiet and everything is ready: the espresso machine is warmed, the order slips are in reach, the ledger is honest. This system serves staff standing at that counter, half-caffeinated and mid-rush — calm confidence, nothing decorative that isn't useful, and a single warm accent used the way the shop uses its good honey: sparingly, on purpose, where it matters.

It is warm-utilitarian by choice, not by default. Warmth shows up in the materials (charcoal-brown sidebar, paper-warm backgrounds, honey), utilitarianism in the discipline (one accent, few radii, borders and tonal layers over ornament, obvious focus states, motion only where it helps the task). Nothing in the app pretends to be more than it is: no glossy marketing theatrics inside the shift, no fake capability.

Key Characteristics:

- **Tonal layering, not chrome.** Dark sidebar against warm paper carries the depth; shadows stay quiet.
- **One accent.** Brewed Honey appears only where attention or warmth is functional.
- **Density where it counts.** Staff screens privilege scan speed; marketing screens may breathe.
- **Steady and forgiving.** Generous hit targets, obvious focus, calm hover, forgiving error paths.
- **Counter truth.** Real numbers, real orders, real states — no illustrative skeletons pretending to be content.

## Colors

One warm accent over a paper-and-espresso neutral ramp. The palette is the café before opening: crema, roast, lamp-warm amber.

### Primary — Brewed Honey (amber ramp)
- **Honey 700** (#b45309): the working accent — primary buttons, focus outlines, key links. The one you can't miss and never sees twice in a viewport.
- **Honey 600** (#d97706): hover state for Honey 700 surfaces.
- **Honey 400** (#fbbf24): brand blocks on dark (logo chip, sidebar wordmark dot) — glow against charcoal.
- **Honey 300** (#fcd34d): active-state text on the dark sidebar.
- **Honey 800** (#92400e): icon stroke on Honey 100 chips.
- **Honey 100** (#fef3c7): soft icon chips behind card icons.
- **Honey 50** (#fffbeb): informational callout fill.
- **Honey 200** (#fde68a): callout ring/border, used with Honey 50.

### Neutral — Roast Stone (stone ramp)
- **Roast 950** (#0c0a09): the dark workspace — sidebar and mobile top bar. The deepest surface; nothing else sits above its own darkness.
- **Roast 900** (#1c1917): primary text on light.
- **Roast 500–600** (#78716c, #57534e): secondary text; 600 for text that must hold on colored tints.
- **Roast 400** (#a8a29e): captions and decorative icon strokes on dark.
- **Roast 100** (#f5f5f4): app background.
- **Roast 50** (#fafaf9): hover fill on light surfaces.
- **Roast 200** (#e7e5e4): the default hairline — card rings, input borders.
- **Roast 300** (#d6d3d1): darker border on inputs and buttons-ghost on light.
- **Roast 200/50** (#e7e5e4 / #fafaf9): subtle dividers and fills inside white cards.

### Semantic
- **Signal Red** (#b91c1c on #fef2f2, #d6d3d1-adjacent ring #fecaca): errors and destructive states.
- **Sage** (#065f46 on #ecfdf5, ring #a7f3d0): success and healthy states.

### Named Rules

**The One Accent Rule.** Brewed Honey covers ≤10% of any screen. Its rarity marks actions and brand; spending it on decoration destroys it.

**The Warm-Neutral Rule.** No pure #ffffff page background and no blue-grays; neutrals stay in the stone family. Pure white exists only as a card surface against Roast 100.

**The Tint Rule.** Colored surfaces use tints of the same family for secondary text — never neutral gray on a colored ground.

## Typography

**Display Font:** ui-sans-serif system stack (system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial)
**Body Font:** the same system stack — one family, weight does the work

**Character:** An honest humanist sans at a single scale — no display face, no second font. Personality comes from tracking and weight discipline, not novelty. Matches the utilitarian brief: instantly legible at a till, never stylish at the expense of speed.

### Hierarchy
- **Display** (600, clamp(1.875rem, 4vw, 2.25rem), 1.15, −0.025em): page-level headings only ("Welcome back").
- **Headline** (600, 1.125rem, 1.35, −0.015em): card and section titles on light surfaces.
- **Title** (600, 1rem, 1.4): emphasized inline titles — payment panels, table headers, form group titles.
- **Body** (400/500, 0.875rem, 1.5): all reading text; stone-500 for secondary, stone-600/900 for primary.
- **Label** (600, 0.6875rem, uppercase, 0.18em tracking): tiny form/field labels and the sidebar "Workspace" tag. Usage is rare and intentional.

### Named Rules

**The Same-Family Rule.** One sans family, weights 400/500/600. No italics for emphasis, no bold >600, no font-size above display, no tracking tighter than −0.04em.

**The No-Kicker Rule.** No eyebrow text above headings. The heading carries the hierarchy alone.

## Layout

- **Workspace layout**: fixed left sidebar (288px on small screens as an off-canvas drawer; 320px static on `md+`) + fluid content. Content sits on Roast 100 with comfortable gutters (`px-4` → `sm:px-6` → `md:px-10`).
- **Dashboard/content grids**: responsive card grids (`sm:grid-cols-2`, `xl:grid-cols-3` for workspace cards; single column below).
- **Forms and order flows**: narrow measure (`max-w-2xl`/`max-w-3xl` content, `max-w-5xl` for summary panels); generous vertical rhythm (16px between related controls, 24–32px between groups).
- **Mobile**: the sidebar collapses to a top bar; every workspace route remains reachable via the drawer. Content never requires horizontal scroll.
- **Density**: staff screens are compact by default (text-sm base); generous whitespace is spent only on the welcome/home surface.

## Elevation & Depth

Depth is **tonal layering first**: the dark Roast 950 sidebar against the Roast 100 paper carries the deepest plane change; white cards then float on that paper with a hairline ring. Shadows are ambient garnish, never the mechanism.

### Shadow Vocabulary
- **Card resting** (`shadow-sm` + `ring-1 ring-stone-200`): the only resting shadow. Cards are flat surfaces with an edge, not floating slabs.
- **Card hover** (`shadow-md` + translate-y −0.5): a quiet lift, response to state, not a resting condition.
- **Drawer backdrop** (`bg-stone-950/60`, full-screen scrim): separates the mobile drawer from dimmed content; no blur.
- **Nothing else.** No glows, no colored shadows, no inset depth. The dark sidebar is flat by construction.

### Named Rules

**The Flat-Rest Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, elevation, focus). If it isn't state, it isn't shadow.

**The One-Plane Rule.** Never stack more than two elevated planes over the paper (card → drawer). Three includes an error.

## Shapes

- **Radii**: 8px (`rounded-lg`) for controls and inputs — the everyday corner; 12px (`rounded-xl`) for nav chips, icon containers, alert banners; 16px (`rounded-2xl`) for cards. No other radii; nothing fully rounded.
- **Borders**: 1px hairlines (Roast 200/300) do most separation; rings only on interactive elements (focus, hover, selected).
- **Form language**: soft, squared-off rounded rectangles — the "clean tray" silhouette. No clipped corners, no blobs, no organic masks.
- **Icons**: drawn 1.7–1.8px stroke, round caps/joins, 24px grid (Lucide/Feather-style geometry), `currentColor`. One family of icons, no mixed fills.

## Components

### Buttons
- **Shape:** 8px corners (lg), `text-sm font-semibold`, no all-caps.
- **Primary:** Honey 700 ground, white text, `shadow-sm`; padding `0.5rem 0.75rem`; disabled = 60% opacity.
- **Hover/Focus:** Honey 600 ground on hover; `outline-2 outline-offset-2 outline-amber-700` on focus; never an outline without offset.
- **Ghost/secondary:** transparent ground, Roast 300 ring, Roast 700 text; hover Roast 50 fill. Used for Log out and tertiary actions.

### Cards
- **Corner Style:** 16px (2xl), white ground on Roast 100, `ring-1 ring-stone-200`, `shadow-sm`, padding 20–24px.
- **Content:** icon chip (Honey 100, Honey 800 glyph) → title → one-line description; arrow glyph nudges on hover.
- **Hover:** `shadow-md`, −2px lift, ring shifts to Honey 400. No other per-card choreography.

### Inputs
- **Shape:** 8px corners; `text-sm`; `px-3 py-2`; white ground; Roast 200 ring, Roast 900 text; placeholder Roast 400.
- **Focus:** 2px Honey 700 outline with 2px offset; invalid state uses Signal Red outline.

### Alerts & Banners
- **Error:** Honey-free — Signal Red 50 ground, Signal 700 text, Signal 200 ring, 12px radius; always names the problem and the recovery.
- **Success:** Sage 50/800/200 — rare, only for completed state transitions.
- **Info:** Honey 50/900/200 — used for shop-state callouts; never for decoration.

### Navigation (Workspace Sidebar)
- **Ground:** Roast 950; brand block = Honey 400 rounded-square with Roast 950 cup glyph + "Coffee Shop / WORKSPACE" wordmark (Label style).
- **Link:** 12px radius, `text-sm font-medium`, Roast 300 default; hover `white/5` ground + Roast 50 text; active = `amber-400/10` ground + Honey 300 text.
- **Icon:** stone-500 default, inherits state color on active.
- **Footer:** Log out ghost row, separated by a 1px `white/5` hairline.
- **Mobile:** fixed top bar (Roast 950) with hamburger → off-canvas drawer, backdrop scrim, Escape closes, brand + close button in-drawer.

### Badges & Status (order states)
- **PENDING/ACCEPTED/PREPARING/READY** render as small rounded chips (12px), tints of Honey (attention) / Sage (done) / Roast (neutral), never saturated fills.

## Do's and Don'ts

**Do**
- Design for the busiest minute of the day: few flows, obvious states, forgiving corrections (refunds, cancels).
- Keep the accent rare and load-bearing; let Roast carry the neutrals.
- Use real data in every screen — empty states name the missing action, errors name the problem and the recovery.
- Prefer borders and tonal layers over shadows and ornament.
- Keep one icon family, one accent, one radius vocabulary, one typeface.

**Don't**
- Don't add a second accent, a gradient heat, or colored glows to "enliven" an operational screen.
- Don't round fully (pills) or invent new radii; don't nest cards inside cards.
- Don't use gray text on colored grounds; use the tint rule.
- Don't write kickers above headings or section numbers that don't carry sequence information.
- Don't fake capability — no placeholder charts with invented values; no "coming soon" modules.
- Don't change the money format, tax, or permission model for visual reasons — the UI explains, the backend decides.
