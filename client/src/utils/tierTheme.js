/**
 * tierTheme.js — Central Dashboard Theme Configuration
 * ─────────────────────────────────────────────────────
 * All tier-specific colors, gradients, and badge config live HERE.
 * To change a theme: edit the token values in the object below.
 * To add a new tier: add a new key with the same token shape.
 *
 * The `applyTierTheme(tier)` function writes CSS custom properties
 * onto `<html>`, so every component inherits them automatically via
 * `var(--token-name)` in Tailwind's arbitrary-value syntax or in CSS.
 *
 * Transition speed is controlled by --theme-transition-duration in CSS.
 */

// ─── Theme Tokens ────────────────────────────────────────────────────────────
// Each key maps to a CSS custom property set on :root.
// To redesign a tier, change ONLY the values here — nothing else.

export const TIER_THEMES = {
  /* ── Free ── Default indigo / purple / pink ────────────────────────────── */
  free: {
    // Background mesh orbs
    '--orb-1': '#4f46e5',
    '--orb-2': '#7c3aed',
    '--orb-3': '#db2777',

    // Primary accent gradient (buttons, CTA, avatar ring)
    '--accent-from': '#3b82f6',
    '--accent-to':   '#9333ea',

    // Sidebar active nav state
    '--nav-active-bg':   'rgba(255,255,255,0.1)',
    '--nav-active-text': '#ffffff',
    '--nav-active-icon': '#60a5fa',

    // Card & sidebar borders / glow
    '--card-border':    'rgba(255,255,255,0.05)',
    '--sidebar-border': 'rgba(255,255,255,0.05)',

    // Avatar gradient
    '--avatar-from': '#3b82f6',
    '--avatar-to':   '#9333ea',

    // Text selection highlight
    '--selection': 'rgba(168,85,247,0.3)',

    // Main content area radial gradient tint
    '--bg-radial': 'rgba(30,58,138,0.2)',

    // Scrollbar thumb
    '--scrollbar': 'rgb(55,65,81)',

    // CTA button shadow color
    '--cta-shadow': 'rgba(59,130,246,0.2)',

    // Topbar accent line (subtle 2px line at top)
    '--topbar-accent': 'transparent',

    // ── Extended: full-page theming ──
    '--glass-bg':       'rgba(17,24,39,0.6)',
    '--glass-border':   'rgba(255,255,255,0.05)',
    '--card-hover-bg':  'rgba(31,41,55,0.5)',
    '--stat-icon-bg':   'rgba(59,130,246,0.2)',
    '--stat-icon-color': '#60a5fa',
    '--progress-from':  '#3b82f6',
    '--progress-to':    '#9333ea',
    '--heading-color':  '#ffffff',
    '--subtext-color':  '#9ca3af',
    '--sidebar-bg':     'rgba(17,24,39,0.95)',
    '--topbar-bg':      'rgba(3,7,18,0.8)',
    '--divider-color':  'rgba(255,255,255,0.05)',
    '--input-border':   'rgba(55,65,81,1)',
    '--input-focus':    'rgba(59,130,246,0.5)',
  },

  /* ── Pro ── Electric Sapphire & Neon Violet — sleek, ultra-modern, high-tech ───── */
  pro: {
    '--orb-1': '#0284c7', // Sapphire Cyan
    '--orb-2': '#4f46e5', // Electric Indigo
    '--orb-3': '#c026d3', // Neon Fuchsia

    '--accent-from': '#38bdf8',
    '--accent-to':   '#818cf8',

    '--nav-active-bg':   'rgba(56, 189, 248, 0.18)',
    '--nav-active-text': '#7dd3fc',
    '--nav-active-icon': '#38bdf8',

    '--card-border':    'rgba(56, 189, 248, 0.16)',
    '--sidebar-border': 'rgba(56, 189, 248, 0.12)',

    '--avatar-from': '#38bdf8',
    '--avatar-to':   '#818cf8',

    '--selection': 'rgba(56, 189, 248, 0.3)',

    '--bg-radial': 'rgba(2, 132, 199, 0.25)',

    '--scrollbar': 'rgb(2, 132, 199)',

    '--cta-shadow': 'rgba(56, 189, 248, 0.3)',

    '--topbar-accent': 'linear-gradient(90deg, #38bdf8, #818cf8)',

    // ── Extended: Sapphire frosted glass ──
    '--glass-bg':       'rgba(10, 22, 40, 0.7)',
    '--glass-border':   'rgba(56, 189, 248, 0.15)',
    '--card-hover-bg':  'rgba(15, 32, 60, 0.5)',
    '--stat-icon-bg':   'rgba(56, 189, 248, 0.2)',
    '--stat-icon-color': '#38bdf8',
    '--progress-from':  '#38bdf8',
    '--progress-to':    '#818cf8',
    '--heading-color':  '#f0f9ff',
    '--subtext-color':  '#bae6fd',
    '--sidebar-bg':     'rgba(6, 15, 30, 0.96)',
    '--topbar-bg':      'rgba(3, 10, 20, 0.85)',
    '--divider-color':  'rgba(56, 189, 248, 0.08)',
    '--input-border':   'rgba(2, 132, 199, 0.4)',
    '--input-focus':    'rgba(56, 189, 248, 0.5)',
  },

  /* ── Business ── Executive Gold & Titanium Black Card — luxury, ultra-sleek ──────── */
  business: {
    '--orb-1': '#d97706', // Rich Gold
    '--orb-2': '#92400e', // Deep Amber
    '--orb-3': '#b45309', // Warm Bronze

    '--accent-from': '#fbbf24',
    '--accent-to':   '#f59e0b',

    '--nav-active-bg':   'rgba(251, 191, 36, 0.18)',
    '--nav-active-text': '#fef08a',
    '--nav-active-icon': '#fbbf24',

    '--card-border':    'rgba(251, 191, 36, 0.15)',
    '--sidebar-border': 'rgba(251, 191, 36, 0.12)',

    '--avatar-from': '#fbbf24',
    '--avatar-to':   '#d97706',

    '--selection': 'rgba(251, 191, 36, 0.3)',

    '--bg-radial': 'rgba(180, 83, 9, 0.22)',

    '--scrollbar': 'rgb(180, 83, 9)',

    '--cta-shadow': 'rgba(251, 191, 36, 0.3)',

    '--topbar-accent': 'linear-gradient(90deg, #fbbf24, #d97706)',

    // ── Extended: Executive Gold Black Card glass ──
    '--glass-bg':       'rgba(24, 18, 10, 0.72)',
    '--glass-border':   'rgba(251, 191, 36, 0.14)',
    '--card-hover-bg':  'rgba(45, 32, 15, 0.55)',
    '--stat-icon-bg':   'rgba(251, 191, 36, 0.2)',
    '--stat-icon-color': '#fbbf24',
    '--progress-from':  '#fbbf24',
    '--progress-to':    '#d97706',
    '--heading-color':  '#fefce8',
    '--subtext-color':  '#fef08a',
    '--sidebar-bg':     'rgba(14, 10, 5, 0.97)',
    '--topbar-bg':      'rgba(10, 7, 3, 0.88)',
    '--divider-color':  'rgba(251, 191, 36, 0.08)',
    '--input-border':   'rgba(217, 119, 6, 0.4)',
    '--input-focus':    'rgba(251, 191, 36, 0.5)',
  },

  /* ── Master Admin ── Crimson / orange / gold (migrated from .master-theme) */
  master: {
    '--orb-1': '#dc2626',
    '--orb-2': '#ea580c',
    '--orb-3': '#ca8a04',

    '--accent-from': '#dc2626',
    '--accent-to':   '#ea580c',

    '--nav-active-bg':   'rgba(239,68,68,0.15)',
    '--nav-active-text': '#fca5a5',
    '--nav-active-icon': '#f87171',

    '--card-border':    'rgba(239,68,68,0.1)',
    '--sidebar-border': 'rgba(239,68,68,0.1)',

    '--avatar-from': '#dc2626',
    '--avatar-to':   '#ea580c',

    '--selection': 'rgba(239,68,68,0.3)',

    '--bg-radial': 'rgba(127,29,29,0.2)',

    '--scrollbar': 'rgb(127,29,29)',

    '--cta-shadow': 'rgba(220,38,38,0.25)',

    '--topbar-accent': 'linear-gradient(90deg, #dc2626, #ca8a04)',

    // ── Extended ──
    '--glass-bg':       'rgba(30,5,5,0.65)',
    '--glass-border':   'rgba(239,68,68,0.1)',
    '--card-hover-bg':  'rgba(60,15,15,0.5)',
    '--stat-icon-bg':   'rgba(239,68,68,0.2)',
    '--stat-icon-color': '#f87171',
    '--progress-from':  '#dc2626',
    '--progress-to':    '#ea580c',
    '--heading-color':  '#fecaca',
    '--subtext-color':  '#fca5a5',
    '--sidebar-bg':     'rgba(15,3,3,0.96)',
    '--topbar-bg':      'rgba(10,2,2,0.85)',
    '--divider-color':  'rgba(239,68,68,0.06)',
    '--input-border':   'rgba(185,28,28,0.3)',
    '--input-focus':    'rgba(239,68,68,0.5)',
  },
};


// ─── Badge Configuration ─────────────────────────────────────────────────────
// Controls the tier badge rendered next to the username in the sidebar.
// `null` = no badge.  Change label/class to restyle without touching JSX.

export const TIER_BADGES = {
  free:     null,
  pro:      { label: 'PRO',      className: 'badge-pro' },
  business: { label: 'BUSINESS', className: 'badge-business' },
  master:   { label: 'ADMIN',    className: 'badge-master' },
};


// ─── Apply Theme ─────────────────────────────────────────────────────────────
// Sets CSS custom properties on <html>. The `transition` rule in index.css
// ensures the change animates smoothly (~800ms).
//
// Usage:  applyTierTheme('pro')
//         applyTierTheme(getEffectiveTier(user))

let _currentTier = null;

export const applyTierTheme = (tier) => {
  const theme = TIER_THEMES[tier] || TIER_THEMES.free;
  const root = document.documentElement;

  // Skip redundant writes
  if (_currentTier === tier) return;

  Object.entries(theme).forEach(([prop, value]) => {
    root.style.setProperty(prop, value);
  });

  // Expose tier as data attribute (useful for conditional CSS)
  root.dataset.tier = tier;

  _currentTier = tier;
};


// ─── Get Current Tier ────────────────────────────────────────────────────────
export const getCurrentAppliedTier = () => _currentTier;


// ─── Theme Token List (for CSS @property registration) ───────────────────────
// Exported so index.css's JS-generated @property rules stay in sync.
export const THEME_CSS_PROPS = Object.keys(TIER_THEMES.free);
