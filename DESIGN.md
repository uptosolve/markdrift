---
name: MarkDrift
description: Free, private moving watermarks for many videos and photos at once, by UptoSolve.
colors:
  page: "#ffffff"
  band: "#f7f7f5"
  field: "#f4f3ef"
  ink: "#23231e"
  soft: "#63635a"
  line: "#e2e1db"
  hair: "#ebeae4"
  edge: "#8c8b82"
  accent: "#fcec45"
  accent-hover: "#f5e02c"
  accent-wash: "#fffbdc"
  stage: "#23231e"
  stage-raised: "#2e2e28"
  on-stage: "#eae8e0"
  on-stage-soft: "#c3c2b8"
  ok: "#1d7a48"
  err: "#b3261e"
typography:
  wordmark:
    fontFamily: "Google Sans Flex, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Google Sans Flex, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body-large:
    fontFamily: "Google Sans Flex, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
  body:
    fontFamily: "Google Sans Flex, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Google Sans Flex, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  caption:
    fontFamily: "Google Sans Flex, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
  tag:
    fontFamily: "Google Sans Flex, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
rounded:
  inset: "4px"
  thumb: "6px"
  sm: "10px"
  lg: "18px"
  pill: "99px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  panel: "20px"
  column: "24px"
  gutter: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "14px 18px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-idle:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.field}"
  button-disabled:
    backgroundColor: "{colors.hair}"
    textColor: "{colors.edge}"
  input-text:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.body-large}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "44px"
  segmented:
    backgroundColor: "{colors.field}"
    textColor: "{colors.soft}"
    rounded: "{rounded.pill}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
  style-row:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: "44px"
  style-row-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.ink}"
  tag-recommended:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  step-number:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    rounded: "{rounded.pill}"
    size: "22px"
  stage-plate:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.on-stage}"
    rounded: "{rounded.lg}"
  order-panel:
    backgroundColor: "{colors.page}"
    rounded: "{rounded.lg}"
    width: "400px"
  checkout:
    backgroundColor: "{colors.band}"
    padding: "12px 20px 16px"
  queue-item-current:
    backgroundColor: "{colors.field}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
---

# Design System: MarkDrift

## Overview

**Creative North Star: "The Checkout Counter"**

MarkDrift is a tool inside the UptoSolve world, and it behaves like a short checkout rather than an editor. Files sit in a cart on the left, under an ink preview plate; a single order panel on the right lists what will happen, and one yellow pill at its foot does it. The page is paper white and warm ink. Density is that of a form, not a canvas: small, steady type, 44px touch rows, and hairline dividers between numbered steps.

The ink plate is the one dark object on the page. It holds the live preview, so every video, frame and thumbnail sits on the same warm near-black rather than on white. Everything else is flat paper with 1px lines. Yellow is kept for the action and for whatever is currently chosen, so the eye always knows the next step and the current choice.

The system is light only. The brand has no dark scheme, and the ink plate is a surface, not a theme.

**Key Characteristics:**
- Paper page, ink plate, one yellow.
- One family (Google Sans Flex, self-hosted, variable 400 to 700) with tabular figures everywhere.
- Flat containers drawn with 1px lines; depth only on selected pills and floating overlays.
- Three corner families: 10px controls, 18px containers, 99px pills.
- Authored single-weight line icons on a 24 grid, 1.75 stroke, round caps.
- Native controls (range, checkbox, select, color) tinted from the palette instead of rebuilt.

## Colors

A warm neutral palette on white, with one saturated yellow reserved for action and selection.

### Primary
- **Signal Yellow** (accent): the primary pill, the drop-veil pill, the selected style row's mark in its diagram, the selected position cell, the progress fill, the preview scrubber, text selection and the dot in the wordmark. Never used for text, and never on large idle areas.
- **Pressed Yellow** (accent-hover): hover on the primary pill.
- **Yellow Wash** (accent-wash): the selected style row's background and the browser-support note. The quiet form of the accent.

### Neutral
- **Paper** (page): the page, the order panel, text fields, selected segment pills.
- **Band** (band): the checkout footer of the order panel, row hover, info notes, the add-photo tile.
- **Field** (field): the track of segmented controls and tab switches, ghost hover, the current cart row.
- **Warm Ink** (ink): all primary text, step numbers, the Recommended tag, focus rings, selected borders, idle-pill outline, and the fill of range sliders and checkboxes.
- **Soft Ink** (soft): secondary text: metadata, hints, unselected segments, output values.
- **Line** (line): container borders (cart, order panel, style rows) and the checkout divider.
- **Hair** (hair): dividers between steps, empty progress tracks, disabled pill fill.
- **Edge** (edge): control boundaries that must read as interactive: text field and select borders, ghost pill outline, dashed logo picker, current-row inset ring.

### Stage
- **Plate Ink** (stage): the preview plate, thumbnails, logo well, style diagrams and position grid. Same value as Warm Ink by intent.
- **Raised Plate** (stage-raised): controls sitting on the plate (play button, position cells).
- **Plate Text** (on-stage) and **Plate Soft** (on-stage-soft): text and hints on the plate.

### Status
- **Saved Green** (ok) and **Stop Red** (err): row status, result lines, field errors, remove-button hover. Text only, never fills.

### Named Rules
**The One Yellow Rule.** Yellow means "do this" or "this is chosen". If an element is neither the action nor the current selection, it is not yellow.

**The Plate Rule.** Media always sits on Plate Ink, never on paper. Thumbnails, previews and diagrams share the same dark ground so mixed shapes read as one set.

## Typography

**Display Font:** none. The system has no display tier.
**Body Font:** Google Sans Flex (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)

**Character:** One friendly geometric sans at small, steady sizes. Hierarchy comes from weight (400, 500, 600, 700) and colour (ink against soft), not from big jumps in size.

### Hierarchy
- **Wordmark** (700, 1.25rem, -0.02em): the product name in the top bar and the drop-veil message only.
- **Title** (600, 1rem, -0.01em): step headings, the cart heading, the big checkout pill.
- **Body Large** (400, 0.9375rem): text typed into fields and selects; the More options summary uses it at 600.
- **Body** (400, 0.875rem, 1.5): the base size; file names, style names, control text.
- **Label** (500, 0.8125rem): field labels, tabs, small pills, checkbox labels, the order summary, hints on the plate. Footer copy runs at this size to 72ch.
- **Caption** (400, 0.75rem, 1.45): file metadata, row status (at 600), style descriptions, hints.
- **Tag** (600, 0.6875rem): the Recommended tag only.

### Named Rules
**The Tabular Rule.** Figures are tabular on the whole body. Durations, counts, percentages and progress never jitter as they change.

**The Weight-Not-Size Rule.** New emphasis goes up a weight or from soft to ink before it goes up a size. The type ramp tops out at 1.25rem.

## Layout

Desktop is a two-column grid inside a 1360px container with 28px gutters: a fluid cart column and a fixed 400px order panel, 24px apart, top-aligned. The top bar sits above it at 14px vertical padding. The order panel is sticky 16px from the top, is capped at the viewport height less 80px, scrolls internally (a 36px fade mask at its foot), and keeps its checkout footer pinned at the panel's bottom.

The cart column stacks the stage plate, a caption line, and a bordered cart list with 14px between them. The stage keeps a 16:9 drop area at least 340px tall; the loaded preview caps media at 62vh.

The order panel is a vertical run of numbered steps (12px top, 14px bottom, hairline between), then a collapsible More options, then the checkout. Inside steps, spacing moves in 10 to 14px increments; components use 4, 6, 8, 10, 12 and 14px internally. Short controls share a row instead of stacking: the watermark text field takes the free width beside its colour swatches (10px apart), and "How visible" is one inline row of label, slider and a right-aligned value.

At 960px and below, the grid becomes one column with 16px gutters and a 14px 16px top bar. The stage goes full-bleed and sticks to the top of the viewport (drop area 40vh, media 26vh) so the preview stays in view while settings change. The checkout leaves the panel and pins to the bottom edge with a top-rounded sheet and safe-area padding, but only once files exist; before that it is hidden. At 520px the top bar wraps and the device note takes its own line.

## Elevation & Depth

Flat by default. Containers are paper with 1px Line borders, and the only dark surface is the stage plate. Shadows appear in three places only: the selected pill inside a segmented track, the pinned phone checkout, and the toast.

### Shadow Vocabulary
- **Pill lift** (`box-shadow: 0 1px 2px rgba(35,35,30,.12)` to `.14`): the selected tab or segment inside a Field track.
- **Bottom sheet** (`box-shadow: 0 -6px 20px rgba(35,35,30,.14)`): the pinned phone checkout.
- **Toast** (`box-shadow: 0 8px 24px rgba(0,0,0,.18)`): the status toast.

Focus is an outline, not a shadow: a 3px solid Warm Ink ring at a 3px offset, switched to Signal Yellow for controls on the plate.

Selection rings are drawn with box-shadow, not elevation: a 2px Paper gap then a 2px Ink ring (`0 0 0 2px page, 0 0 0 4px ink`) for swatches and thumbnails, and a 1px Ink inset for the selected style row.

### Named Rules
**The Lines-Not-Shadows Rule.** Cards and panels are separated by 1px lines and tone, never by drop shadows at rest.

## Shapes

Three corner families. Controls, rows, notes, the logo well, the position grid and photo tiles are gently rounded (10px). Containers and the stage plate are softly rounded (18px). Every button, tab track, tag, step number, swatch and toast is a full pill (99px). Media inside the plate uses tighter corners: 4px on the preview frame and position cells, 6px on cart thumbnails. On phones the stage rounds only its bottom corners and the checkout sheet only its top corners. Borders are 1px; the idle checkout pill uses a 1.5px ink inset; the logo picker alone uses a dashed Edge border.

## Components

### Buttons
Round, calm, one loud.
- **Shape:** full pill (99px), 600 weight, icon and label 8px apart.
- **Primary:** Signal Yellow with ink text. The big checkout pill is full width at 14px 18px, Title size. Hover goes to Pressed Yellow; active nudges down 1px.
- **Idle primary:** before any files exist, the checkout pill is Paper with a 1.5px ink inset outline and reads "Choose files to start"; hover goes to Field. It turns yellow only when there is something to do.
- **Ghost:** transparent with a 1px Edge inset; small size is 6px 12px at Label size. Hover fills with Field. Used for Replace, Add more, Shuffle and Stop.
- **Disabled:** Hair fill, Edge-grey text, no shadow.
- **On plate:** 36px round Raised Plate icon buttons with Plate Text icons; focus ring switches to yellow. While an export runs, they and the scrubber are disabled at 40% opacity.

### Segmented control and tabs
- **Style:** Field track, 3px padding, pill segments in Soft Ink at 500.
- **State:** the selected segment becomes Paper with Ink text and the pill lift. Used for Text/Logo, Small/Medium/Large and the Videos/Photos switch in the cart header.

### Style rows (signature)
The one choice most people make, as five plain rows.
- **Shape:** 10px corners, 1px Line border, 44px minimum, 6px 12px padding, 5px apart.
- **Diagram:** a 52 by 33 animated path drawing on a Plate Ink frame, grey marks showing the motion (bounce, jump, tile). Motion stops under reduced motion.
- **Selected:** Ink border plus 1px Ink inset, Yellow Wash background, the diagram's marks turn Signal Yellow, and the one-line description appears. Unselected rows show the name only.
- **Tag:** the Recommended tag is an Ink pill with Paper text at Tag size.

### Inputs / Fields
- **Style:** 44px tall, Paper, 1px Edge border, 10px corners, Body Large text; placeholder is a mid warm grey.
- **Focus:** border goes to Ink with a 3px yellow halo (`rgba(252,236,69,.7)`).
- **Error:** Stop Red border with a faint red halo.
- **Native controls:** range sliders, checkboxes (18px) and selects are native, tinted with `accent-color: ink`. The preview scrubber on the plate is tinted yellow.
- **Range rows:** a range can sit inline: the label at 500, a fluid slider, and the value in Soft at Label size, right-aligned in a fixed 3.2em slot so the row never shifts.
- **Swatches:** 30px pill swatches with a 28% ink hairline (26px and 6px apart when they share the text field's row); the selected one gets the paper-gap ink ring. The custom colour swatch is a conic rainbow, the usual cue for "any colour"; its hues appear nowhere else.

### Cart
- **Container:** 1px Line border, 18px corners, 14px padding, a Title heading with the Videos/Photos switch and an Add more ghost pill.
- **Row:** 72 by 44 plate thumbnail that fills its box (cropped to the centre) and carries the live mark at no less than about 7px on screen; name at 500, metadata in Caption, status in Caption 600 (Soft while queued, Ink while working, Saved Green when done, Stop Red on failure), a 30px round remove button. Hover is Band; the current row is Field with a 1px Edge inset.
- **Photos:** a grid of square plate tiles (84px minimum, 8px gap, 10px corners), filled and centre-cropped with the same minimum mark; the current tile gets the ink ring.
- **Row progress:** a 4px Hair track under the name with a Signal Yellow fill and the same 35% ink inset edge as the checkout bar.

### Order panel and checkout (signature)
- **Panel:** Paper, 1px Line border, 18px corners, 400px wide, 20px side padding.
- **Steps:** each opens with a 22px Ink pill carrying a Paper numeral, then the Title heading.
- **Checkout:** Band footer with a Line top border, the order summary in Label size and Ink (items separated by middots), the big pill, then the progress block: an 8px Hair track with a Line inset, a yellow fill with a 35% ink inset edge, the status line in Soft, and a Stop ghost pill.
- **While exporting:** the preview player is released. The last frame stays on the plate as a still, the player controls are disabled, and a Band note under the plate reads "The preview is paused while your videos are made."

### Navigation
A top bar with the wordmark (a 28 by 20 outlined frame icon with a yellow inset dot, the name at Wordmark size, "by UptoSolve" in Soft Label) and a lock icon with the device line pushed right. No menu.

## Do's and Don'ts

### Do:
- **Do** keep yellow to the action and the current selection (The One Yellow Rule), with ink text on it.
- **Do** put every piece of media on Plate Ink, including thumbnails and diagrams.
- **Do** separate containers with 1px Line borders and steps with Hair dividers.
- **Do** keep the checkout pill in its ink-outline idle state until there is something to process.
- **Do** use native form controls tinted with the palette, at 44px touch height.
- **Do** draw new icons in the authored set's style: 24 grid, no fill, currentColor, 1.75 stroke, round caps and joins.
- **Do** stop all diagram and demo motion under prefers-reduced-motion.

### Don't:
- **Don't** add a dark theme; the page is light only and the plate is the only dark surface.
- **Don't** add a second UI typeface. The serif, mono and heavy options are watermark content drawn on the canvas, not interface type.
- **Don't** put drop shadows on cards or panels at rest.
- **Don't** set text in yellow or use yellow as a status colour.
- **Don't** use emoji or font glyphs as icons.
- **Don't** make every setting an equal-weight slider; defaults live up front and the rest sits under More options.

<!-- Known gaps between build and system, recorded, not resolved: Unselected style-diagram marks use a hard-coded #9d9c92, outside the token set. The custom-colour swatch is a hard-coded conic gradient of six off-palette hues (#ff5b5b, #ffd24a, #5bd97a, #4ab8ff, #9b6bff, #ff5bd1). Other literals outside the token set: scrollbar thumb #c8c7bf, plate hovers #3b3b34 and #45453d, disabled pill text #8c8b82 (Edge written as a literal). A --shadow token is declared in :root but never used. -->
