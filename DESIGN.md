---
version: alpha
name: NET//PULSE Intelligent Load Balancer Design System
description: Production-grade design specifications and baseline constraints for the NET//PULSE intelligent load balancer frontend interface.
colors:
  surface-lowest: "#0f0f10"
  surface-low: "#141415"
  surface: "#19191b"
  surface-high: "#232325"
  surface-highest: "#2b2b2f"
  content-primary: "#ededed"
  content-secondary: "#a1a1a6"
  content-muted: "#71717a"
  primary: "#38bdf8"
  primary-light: "#7dd3fc"
  primary-dark: "#0284c7"
  secondary: "#10b981"
  secondary-light: "#34d399"
  secondary-dark: "#059669"
  tertiary: "#818cf8"
  tertiary-light: "#a5b4fc"
  tertiary-dark: "#6366f1"
  amber: "#f59e0b"
  amber-light: "#fbbf24"
  amber-dark: "#d97706"
  error: "#e5484d"
  error-light: "#f87171"
  error-dark: "#dc2626"
typography:
  sans:
    fontFamily: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
  mono:
    fontFamily: JetBrains Mono, Fira Code, ui-monospace, monospace
---

# NET//PULSE Core Design System & UI Baseline

## Overview

NET//PULSE is an AI-powered L7 reverse proxy and network telemetry console. The interface adheres to an opinionated, quiet, editorial, and telemetry-focused design language built for real-time observability and mission-critical reliability.

## 1. Colors & Surfaces

The visual hierarchy is established through a strict surface luminance hierarchy:
- **`surface-lowest` (`#0f0f10`)**: Deep viewport canvas backdrop.
- **`surface-low` (`#141415`)**: Structural panel base and command bar backdrop.
- **`surface` (`#19191b`)**: Interactive cards, tables, and modal dialogs.
- **`surface-high` (`#232325`)**: Form inputs, secondary buttons, and code blocks.
- **`surface-highest` (`#2b2b2f`)**: Progress bar tracks, subtle dividers, and hover fills.

### Functional Accents
- **Primary (`#38bdf8`)**: Active route indicators, AI inference badges, packet flow pulses.
- **Secondary (`#10b981`)**: Node health (ONLINE), SLA conformance, success notifications.
- **Amber (`#f59e0b`)**: Fallback routing mode, chaos simulation active, health warnings.
- **Error (`#e5484d`)**: Backend node offline, request timeouts, circuit breaker trips.

## 2. Typography & Numerical Precision

- **`tabular-nums` Requirement**: All latency statistics, throughput figures (RPS), error rates, CPU/RAM percentages, and timestamps must use `font-variant-numeric: tabular-nums lining-nums` or `.font-mono tabular-nums`. This prevents visual jitter as values update at high frequency.
- **`text-balance` Requirement**: Section titles and headings must use `text-balance` to avoid orphan words and irregular line breaks.
- **`text-pretty` Requirement**: Descriptive paragraphs and help callouts must use `text-pretty` for typographic rhythm.

## 3. Viewport & Layout

- **Dynamic Viewports**: Never use `h-screen`. Use `min-h-dvh` or `h-dvh` to account for mobile navigation bars and dynamic viewports.
- **Safe Area Insets**: Fixed and sticky elements must observe `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- **Z-Index Layering Scale**:
  - `z-10`: Interactive controls and dropdown triggers.
  - `z-40`: Sticky top command bar.
  - `z-50`: Modals, dialog overlays, and toast notifications.

## 4. Accessibility (WCAG 2.2 AA)

- **Accessible Names**: Every interactive element (`button`, `input`, `select`) must have an explicit accessible name. Icon-only controls must provide `aria-label`.
- **Dialog Standards**: Modal dialogs must specify `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- **Keyboard Dismissal**: All overlays and modals must respond to the `Escape` key and provide backdrop dismissal.
- **Focus Rings**: Focusable interactive elements must have visible, high-contrast focus rings (`focus-visible:outline-1 focus-visible:outline-offset-2`).

## 5. Motion & Animation Performance

- **Compositor Properties**: Animations are strictly limited to `transform`, `opacity`, and SVG stroke properties (`stroke-dashoffset`). Never animate `width`, `height`, `margin`, or `padding`.
- **Interaction Feedback Cap**: Micro-interactions and feedback transitions must resolve within `200ms`.
- **Reduced Motion**: Full support for `@media (prefers-reduced-motion: reduce)` which zeroes animation durations and prevents unnecessary GPU cycles.

## 6. Do's and Don'ts

### Do
- Use `tabular-nums` for all telemetry numbers and tables.
- Use `min-h-dvh` for full viewport layouts.
- Provide `aria-label` for all icon-only buttons.
- Close modals on `Escape` key press.
- Respect system color scheme and prefers-reduced-motion.

### Don't
- Never use multicolor, violet, or pink gradients for primary UI controls.
- Never use `h-screen`.
- Never animate layout or paint properties that trigger browser reflows.
- Never leave inputs without accessible labels or placeholders.
- Never use arbitrary `z-[99999]` indices.
