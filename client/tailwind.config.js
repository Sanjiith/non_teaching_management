/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // ─── Stitch Design System: BIT Portal Colors ───────────────────────
      colors: {
        // Surface colors
        "surface":                    "#f7f9fb",
        "surface-dim":                "#d8dadc",
        "surface-bright":             "#f7f9fb",
        "surface-container-lowest":   "#ffffff",
        "surface-container-low":      "#f2f4f6",
        "surface-container":          "#eceef0",
        "surface-container-high":     "#e6e8ea",
        "surface-container-highest":  "#e0e3e5",
        "surface-tint":               "#4059aa",
        "surface-variant":            "#e0e3e5",
        // On-surface
        "on-surface":                 "#191c1e",
        "on-surface-variant":         "#444651",
        "inverse-surface":            "#2d3133",
        "inverse-on-surface":         "#eff1f3",
        // Primary
        "primary":                    "#00236f",
        "on-primary":                 "#ffffff",
        "primary-container":          "#1e3a8a",
        "on-primary-container":       "#90a8ff",
        "inverse-primary":            "#b6c4ff",
        "primary-fixed":              "#dce1ff",
        "primary-fixed-dim":          "#b6c4ff",
        "on-primary-fixed":           "#00164e",
        "on-primary-fixed-variant":   "#264191",
        // Secondary
        "secondary":                  "#505f76",
        "on-secondary":               "#ffffff",
        "secondary-container":        "#d0e1fb",
        "on-secondary-container":     "#54647a",
        "secondary-fixed":            "#d3e4fe",
        "secondary-fixed-dim":        "#b7c8e1",
        "on-secondary-fixed":         "#0b1c30",
        "on-secondary-fixed-variant": "#38485d",
        // Tertiary
        "tertiary":                   "#4b1c00",
        "on-tertiary":                "#ffffff",
        "tertiary-container":         "#6e2c00",
        "on-tertiary-container":      "#f39461",
        "tertiary-fixed":             "#ffdbcb",
        "tertiary-fixed-dim":         "#ffb691",
        "on-tertiary-fixed":          "#341100",
        "on-tertiary-fixed-variant":  "#773205",
        // Outline
        "outline":                    "#757682",
        "outline-variant":            "#c5c5d3",
        // Background
        "background":                 "#f7f9fb",
        "on-background":              "#191c1e",
        // Error
        "error":                      "#ba1a1a",
        "on-error":                   "#ffffff",
        "error-container":            "#ffdad6",
        "on-error-container":         "#93000a",
      },
      // ─── Typography ─────────────────────────────────────────────────────
      fontFamily: {
        sans:         ["Inter", "sans-serif"],
        "display-lg": ["Inter"],
        "headline-md":["Inter"],
        "headline-sm":["Inter"],
        "title-md":   ["Inter"],
        "body-md":    ["Inter"],
        "body-sm":    ["Inter"],
        "label-md":   ["Inter"],
        "label-sm":   ["Inter"],
      },
      fontSize: {
        "display-lg":  ["32px", { lineHeight: "40px",  letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "32px",  letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "28px",  fontWeight: "600" }],
        "title-md":    ["16px", { lineHeight: "24px",  fontWeight: "600" }],
        "body-md":     ["14px", { lineHeight: "20px",  fontWeight: "400" }],
        "body-sm":     ["13px", { lineHeight: "18px",  fontWeight: "400" }],
        "label-md":    ["12px", { lineHeight: "16px",  letterSpacing: "0.05em", fontWeight: "600" }],
        "label-sm":    ["11px", { lineHeight: "14px",  fontWeight: "500" }],
      },
      // ─── Border Radius ──────────────────────────────────────────────────
      borderRadius: {
        DEFAULT: "0.25rem",   // 4px
        lg:      "0.5rem",    // 8px
        xl:      "0.75rem",   // 12px
        "2xl":   "1rem",      // 16px
        full:    "9999px",
      },
      // ─── Spacing ────────────────────────────────────────────────────────
      spacing: {
        xs:   "4px",
        sm:   "8px",
        md:   "16px",
        lg:   "24px",
        xl:   "32px",
        base: "4px",
        gutter: "16px",
        "container-max": "1440px",
        "sidebar-width": "256px",
        "header-height": "64px",
      },
    },
  },
  plugins: [],
}
