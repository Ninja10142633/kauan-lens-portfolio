---
name: Kauan — lens.by.zy
description: Premium and cinematic photography portfolio
colors:
  primary: "#d4b27a"
  primary-hover: "#e6c896"
  primary-dark: "#a48450"
  neutral-bg: "#080808"
  neutral-bg-sec: "#121212"
  neutral-bg-ter: "#1a1a1a"
  neutral-text: "#eae7e1"
  neutral-text-muted: "#a09d95"
  neutral-text-dim: "#706e68"
typography:
  display:
    fontFamily: "DM Serif Display, serif"
    fontSize: "clamp(3.5rem, 12vw, 7.5rem)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 300
    lineHeight: 1.6
  label:
    fontFamily: "Courier New, Consolas, monospace"
    fontSize: "0.65rem"
    fontWeight: 400
    letterSpacing: "0.3em"
rounded:
  sm: "2px"
  md: "4px"
spacing:
  sm: "1.2rem"
  md: "2rem"
  lg: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "0.9rem 2.2rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "0.9rem 2.2rem"
---

# Design System: Kauan — lens.by.zy

## 1. Overview

**Creative North Star: "The Viewfinder Gallery"**

This visual system treats the web interface as the chassis of a high-end camera. The canvas is dark and unobtrusive, mirroring the sensory experience of a darkroom or a cinema, allowing the photographs themselves to command full attention. The design combines structured monospace metadata with high-contrast serif headlines to convey professional precision and artistic quality.

It rejects the warm-beige/sand defaults of standard AI-generated sites and refuses typical SaaS card layouts and gradient text decoration. Every spacing choice and visual element acts as an intentional frame for Kauan's autoral work.

**Key Characteristics:**
- Viewfinder-inspired framing and camera-like brackets.
- Pure dark background canvas to emphasize color and contrast in photos.
- High contrast serif typography paired with strict, technical monospaced metadata.

## 2. Colors

A high-contrast cinematic palette designed to vanish into the background, accented by a single warm metallic tone.

### Primary
- **Chamber Gold** (#d4b27a): A premium, low-saturation warm metallic accent. Used strictly for active states, key CTAs, highlights, and viewfinder focus markings.

### Neutral
- **Obsidian Black** (#080808): Canonical body background. Deep and rich, providing maximum contrast for photographs.
- **Dark Slate** (#121212): Secondary background for sections (e.g. About, Admin).
- **Ink Gray** (#1a1a1a): Tertiary background for container elements and inputs.
- **Parchment White** (#eae7e1): High-contrast primary body text.
- **Muted Gray** (#a09d95): Low-contrast text for captions, descriptions, and labels.
- **Dim Gray** (#706e68): Minimal contrast boundary color for borders, rules, and placeholders.

### Named Rules
**The Golden Thread Rule.** The Chamber Gold accent color must represent less than 10% of any single viewport surface. Its power is in its scarcity.

## 3. Typography

**Display Font:** 'DM Serif Display' (with serif fallback)
**Body Font:** 'DM Sans' (with sans-serif fallback)
**Label/Mono Font:** 'Courier New', 'Consolas', monospace

### Hierarchy
- **Display** (weight 400, size clamp(3.5rem, 12vw, 7.5rem), line-height 0.95): Used exclusively for the hero brand/name presentation.
- **Headline** (weight 400, size clamp(2rem, 5vw, 3.8rem), line-height 1.1): Used for main section headers (`h2`).
- **Title** (weight 400, size clamp(1.8rem, 4vw, 2.8rem), line-height 1.15): Used for modal or album titles.
- **Body** (weight 300, size 0.9rem, line-height 1.6): Used for bios, info paragraphs, and descriptions. Maximum line length capped at 65–75ch.
- **Label** (weight 400, size 0.65rem, letter-spacing 0.3em, uppercase): Used for eyebrows, metadata tags, and viewfinder indicators.

### Named Rules
**The Balanced Heading Rule.** Always apply `text-wrap: balance` to headings (H1-H3) to prevent awkward line breaks and orphaned words.

## 4. Elevation

The system is flat-by-default to preserve the two-dimensional nature of print photography and film sheets. Depth is established through border-color state transitions and subtle hover elevations, never through soft/wide generic SaaS dropshadows.

### Shadow Vocabulary
- **Ambient Glow** (`box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5)`): Ambient dark shadowing for active hover cards or photo overlays.
- **Structural Shadow** (`box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4)`): Deep framing shadow used under the portrait image container to lift it off the slate background.

### Named Rules
**The Flat Rest Rule.** Containers and buttons are perfectly flat at rest. Elevation shadows and glow states must only occur in response to user interaction (hover, active, focus).

## 5. Components

### Buttons
- **Shape:** Soft square (4px radius).
- **Primary:** Chamber Gold bg with Obsidian Black text. Padding (0.9rem 2.2rem).
- **Hover / Focus:** Translate -2px, background transitions to primary-hover (#e6c896), letter-spacing increases from 0.2em to 0.28em.
- **Secondary / Outline:** Transparent bg with 1px border (#ffffff26). On hover, border-color transitions to Chamber Gold.

### Cards / Containers
- **Corner Style:** Sharp corners (0px radius) for album grids to resemble film contact sheets; rounded (4px radius) for dialogs and portrait framing.
- **Background:** Dark Slate (#121212) or Ink Gray (#1a1a1a).
- **Shadow Strategy:** Flat at rest; Ambient Glow on hover.

### Inputs / Fields
- **Style:** Ink Gray (#1a1a1a) bg, 1px border (#ffffff0d), rounded (4px radius).
- **Focus:** Border-color transitions to Chamber Gold (#d4b27a) with a subtle blur glow.

### Navigation
- **Style:** Transparent top bar that becomes Dark Slate with backdrop-filter (blur(12px)) on scroll. Uppercase labels with wide letter-spacing. On hover, a 1px Chamber Gold accent line slides in under the text.

## 6. Do's and Don'ts

### Do:
- **Do** wrap image assets in viewport-like border containers with `overflow: hidden` to simulate camera framing.
- **Do** use monospace metadata (shutter speed, ISO, focal length) alongside portfolio photos to reinforce technical authenticity.
- **Do** ensure all elements have high contrast ratios (body text is Parchment White or Muted Gray on Obsidian Black/Dark Slate).

### Don't:
- **Don't** use standard SaaS metric templates (large number + tiny label) to showcase stats.
- **Don't** use gradient text under any circumstances.
- **Don't** use border-left/right greater than 1px as decorative side-stripes.
- **Don't** use card radii larger than 4px. Insanely rounded corners (e.g. 16px, 24px) are forbidden.
