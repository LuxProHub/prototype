# DATALINK DESIGN SYSTEM SPECIFICATION
Version: 2.0 (Next-Generation Spatial Data Platform)

## 1. Design Direction & Philosophy
DataLink combines multiple modern UI design disciplines into one cohesive operational language:
1. **Glassmorphism**: Frosted translucent surfaces with layered depth, controlled transparency, and fine borders reserved for floating controls, dialogs, and navigation.
2. **Liquid Glass**: Fluid translucent surfaces with subtle refraction and smooth transitions on active interactive objects.
3. **Bento UI**: Modular information blocks with clear visual hierarchy, varying card spans based on importance, utilized heavily in Overview and Executive dashboards.
4. **Spatial / 3D UI**: Purposeful Three.js data experiences (`DataTopology3D`, `SpatialPropertyVisualizer`, `SpatialQueueFlow`) providing visual understanding and relationship exploration with automatic 2D fallbacks and reduced-motion compliance.
5. **Flat Design**: Pure 2D high-density presentation for core operational surfaces (Records table, filter bars, data entry forms, schema mappings) prioritizing clarity, speed, and zero blur interference.
6. **Selective Soft 3D**: Tactile segmented controls and interactive buttons with subtle inner shadows and elevation changes.
7. **Neo-Brutalism**: Strong monospaced numerical typography, high-contrast micro-tags (`.neo-tag`), and decisive primary action states.
8. **Motion Design**: Subtle purposeful transitions (panel slide-overs, drawer rises, toast drops, skeleton pulses) respecting `prefers-reduced-motion`.

---

## 2. Design Tokens

### Color Tokens
Both Light and Dark modes share the exact same semantic architecture:

| Semantic Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--color-bg` | `#f4f6f9` (`--ink`) | `#0a0e17` | Canvas background |
| `--color-surface` | `#ffffff` | `#10151f` | Anchored panels, tables |
| `--color-surface-elevated`| `#f7f9fc` | `#161c28` | Recessed wells, header bars |
| `--color-surface-muted` | `#eff2f7` | `#1d2432` | Hover backgrounds, tertiary wells |
| `--color-border` | `rgba(15, 23, 42, 0.09)` | `rgba(255, 255, 255, 0.08)` | Default card and cell borders |
| `--color-border-strong` | `rgba(15, 23, 42, 0.16)` | `rgba(255, 255, 255, 0.15)` | Active borders, dividers |
| `--color-text-primary` | `#101725` | `#e8ecf4` | Headings, main text |
| `--color-text-secondary` | `#475569` | `#a3aec2` | Subtitles, table cells |
| `--color-text-muted` | `#5b677c` | `#7c8798` | Helper text, metadata |
| `--color-accent` | `#2f6be0` | `#4d82f3` | Primary interaction, buttons |
| `--color-accent-hover` | `#2559c4` | `#6296ff` | Hover state on buttons |
| `--color-accent-soft` | `rgba(47, 107, 224, 0.1)`| `rgba(77, 130, 243, 0.14)` | Active row backgrounds |
| `--color-value` | `#8a5f1f` | `#d6a85b` | Monetary values (AED), plot nos |
| `--color-ok` | `#047857` | `#34d399` | Validated, success, won |
| `--color-dup` | `#7c3aed` | `#a78bfa` | Duplicate status |
| `--color-warn` | `#b45309` | `#fbbf24` | Incomplete, warning, pending |
| `--color-bad` | `#e11d48` | `#fb7185` | Errors, invalid, overdue |

### Spacing Scale
- `--space-1`: `4px` (`0.25rem`)
- `--space-2`: `8px` (`0.5rem`)
- `--space-3`: `12px` (`0.75rem`)
- `--space-4`: `16px` (`1rem`)
- `--space-5`: `20px` (`1.25rem`)
- `--space-6`: `24px` (`1.5rem`)
- `--space-8`: `32px` (`2rem`)
- `--space-10`: `40px` (`2.5rem`)
- `--space-12`: `48px` (`3rem`)

### Radius Scale
- `--radius-sm`: `6px` (Controls, input fields, tags)
- `--radius-md`: `8px` (Buttons, small cards, dropdowns)
- `--radius-lg`: `12px` (Panels, Bento cards, side panels)
- `--radius-modal`: `16px` (Dialogs, modal overlays)
- `--radius-pill`: `9999px` (Status badges, chips)

### 5-Tier Elevation Architecture
- **Level 0 (Canvas)**: Background ground (`--color-bg`).
- **Level 1 (Data Surface)**: Anchored opaque panels, data tables (`--color-surface`).
- **Level 2 (Elevated Panel)**: Sub-panels, wells, Bento blocks (`--color-surface-elevated`).
- **Level 3 (Floating Controls)**: Liquid glass headers, filter toolbars, dropdown popovers (`.glass-liquid`).
- **Level 4 (Spatial Overlays)**: Modal dialogs, side-panel inspector, toast notifications (`.glass-raised`).

---

## 3. Typography & Numbers
- **Display / Major Metrics**: `text-2xl` to `text-3xl`, `font-semibold`, tracking-tight.
- **Page Titles**: `text-lg sm:text-xl`, `font-semibold`, sentence case matching sidebar navigation.
- **Section / Bento Headers**: `text-xs sm:text-sm`, `font-semibold`, tracking-wide.
- **Body Text**: `text-[13px]`, `leading-normal`.
- **Table Data & Secondary Info**: `text-[12px]` to `text-[12.5px]`.
- **Monospaced Figures (`.num`)**: `font-mono`, `tabular-nums`, -0.01em tracking for alignment in columns.
- **Valuation & Currency (`.val`)**: `font-mono`, `tabular-nums`, colored in gold `--color-value`.

---

## 4. Component Hierarchy & Composition

```
AppShell
├── Sidebar (Desktop Nav & Mobile Bottom Nav)
├── Header (Global Search with '/', Theme Toggle, User Menu)
├── PageContainer
│   ├── PageHeader (Title, Description, Actions)
│   ├── FilterBar (Search, Filter Buttons, Active FilterChips)
│   ├── DataSurface (DataTable with SortableHeader, Sticky Head, Compact Rows)
│   │   ├── LoadingRows / Skeleton
│   │   ├── EmptyState
│   │   └── ErrorState
│   ├── BulkActionBar (Contextual floating selection bar)
│   ├── RecordInspector (Split-view persistent side panel / Drawer)
│   │   ├── SpatialPropertyVisualizer (3D wireframe / isometric)
│   │   ├── RecordDetailsTabs
│   │   └── LeadActivityTimeline
│   └── DataTopology3D / SpatialQueueFlow (3D Visualizations)
└── ToastProvider (Live region notifications)
```

---

## 5. Responsive Breakpoint Rules
- **1440px+ (Wide Desktop)**: Full 2-column split views (Records table on left, persistent RecordInspector on right), 4-column Bento grids.
- **1024px – 1439px (Standard Desktop)**: 3-column Bento grids, split inspector slightly narrower with horizontal scrollbar protection.
- **768px – 1023px (Tablet)**: Inspector collapses into smooth overlay drawer; sidebar remains available or collapsible.
- **375px – 767px (Mobile)**: Desktop sidebar hides; sticky `MobileBottomNav` with safe-area padding is used; RecordInspector displays full-screen with touch swipe; 3D components automatically scale or switch to lightweight 2D views.
