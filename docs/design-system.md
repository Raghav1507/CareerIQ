# CareerIQ — Design System

Stack: **Tailwind CSS 4** (CSS-first `@theme` tokens) + **shadcn/ui** primitives
(Radix) + **Lucide** icons + **sonner** toasts + **Recharts** for charts.

## Tokens (`apps/web/src/styles/globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` / `--foreground` | near-white / zinc-950 | zinc-950 / zinc-50 | page canvas |
| `--card` / `--border` | white / zinc-200 | zinc-900 / zinc-800 | surfaces, hairlines |
| `--primary` | indigo-600 | indigo-500 | actions, focus, chart series |
| `--success` / `--warning` / `--destructive` | green / amber / red | same hues | status chips, score bands |
| `--muted` / `--muted-foreground` | zinc-100 / zinc-500 | zinc-800 / zinc-400 | hints, empty copy |

- Radius `0.625rem`; font **Inter** via `next/font` mapped to `--font-sans`.
- `.surface` utility = card-like panel for compact info blocks.
- Dark mode: class strategy (`<html class="dark">`), toggled from Settings
  (`useSyncExternalStore` + `localStorage` — hydration-safe).

## Component inventory

**Primitives (`components/ui/`)** — button, badge (default/secondary/outline/
success/warning/destructive/muted/info), card, input, label, textarea, select,
dialog, dropdown-menu, tabs, switch, table, progress, separator, skeleton,
avatar, tooltip, sonner (toasts).

**Feature (`components/feature/`)**

| Component | Purpose |
|---|---|
| `PageHeader` | h1 + description + right-aligned actions |
| `EmptyState` | icon, honest title/copy, single action — used whenever a module genuinely has no data |
| `StatCard` | dashboard metric (value + hint + icon) |
| `ModuleNotice` | transparent "build status" callout for phased modules (no fake features) |

**Charts (`components/charts/`)** — `ScoreRing` (deterministic SVG ring, tone
by band ≥80 green / ≥60 primary / ≥40 amber / else muted), `RoleSkillChart`
(grouped bars: required vs optional per role).

**Domain components**

| Component | Module |
|---|---|
| `ProfileEditor` (tabs: Basics / Education / Skills / Goals, chip inputs, searchable skill picker) | onboarding |
| `ResumeManager` (upload dropzone, review checklist, confirm-before-import) | resume |
| `GenerateRecommendationsButton` | recommendations |
| `RoleSwitcher`, `SaveGapButton` | skill gap |
| `RoadmapGenerator`, `RoadmapChecklist` (timeline + progress pills) | roadmap |
| `AnalyzerForm` (JD paste + result panel) | job analyzer |
| `AppShell`, `SidebarNav`, `UserMenu`, `SettingsControls` | layout |

## Patterns

1. **Server Components own data** — pages query via `lib/db` (pg pool) or
   `lib/server/*` engines; **Client Components own interaction** and call
   `/api/*` through `lib/api.ts::apiFetch`, then `router.refresh()`.
2. **Every mutation toasts** success/error via `sonner`; errors surface the API
   `error.message` verbatim (no fake success).
3. **Score honesty** — score UI renders server-computed numbers only; bands:
   ≥80 Strong, ≥60 Good, ≥40 Developing, else Early (`formatScore`/`scoreBand`).
4. **Loading/disabled states** on every async button (`busy` flags).
5. **Accessibility** — labels on inputs, `aria-hidden` on decorative icons,
   `aria-label` on icon-only buttons.
