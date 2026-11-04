# UI Skills Integration Plan

## Scope

NET//PULSE is a product dashboard, not a marketing-only page. The selected UI
skills are therefore limited to skills that improve the existing operator
workflow without replacing its cyber-operations visual identity.

Source library: [UI Skills](https://www.ui-skills.com/skills)

## Selected skills

| Skill | Application |
|---|---|
| `impeccable` | Coordinate the dashboard audit and targeted polish pass. |
| `baseline-ui` | Improve hierarchy, spacing, and visual consistency without redesigning the product. |
| `better-accessibility` | Keyboard paths, labels, focus, live announcements, reduced motion, and status cues. |
| `better-colors` | Validate dark-theme contrast and avoid color-only status communication. |
| `better-layout` | Check responsive behavior, overflow, density, and touch targets. |
| `better-typography` | Keep technical labels readable at desktop and mobile sizes. |
| `better-writing` | Clarify routing, fallback, error, and empty-state language. |
| `animation-performance` | Keep packet flows, beacons, sparklines, and auto-pilot motion efficient. |
| `browser-testing-with-devtools` | Verify the rendered app, console, network requests, and visual output. |
| `best-practices` | Review frontend security, compatibility, and implementation quality. |
| `vercel-react-best-practices` | Review React rendering and state-management costs. |

Unrelated mobile, game, branding, and native-platform skills were not installed.
UI Skills are workflow guidance, not runtime dependencies, so adding the entire
library to the application would increase noise without improving the product.

## Applied in this pass

- Added a real page-level `h1` for the dashboard identity.
- Added an accessible label and autocomplete metadata to the admin-token input.
- Added accessible names to icon-only controls.
- Added polite live-region semantics to toast notifications.
- Added an alert role and accessible dismiss action for errors.
- Removed the hard-coded “Use Local” token shortcut from the public UI.
- Added a `prefers-reduced-motion` fallback for animated packet flows, beacons,
  toasts, and refresh indicators.

## Next audit sequence

1. Run keyboard-only and screen-reader checks across the operator controls.
2. Measure dark-theme contrast and verify status colors have text or icon cues.
3. Check narrow viewports for overflow and touch-target failures.
4. Profile auto-pilot and packet-flow animation on a mid-range device.
5. Run a browser console/network regression pass after each UI change.
