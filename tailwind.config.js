/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	content: [
		"./app/**/*.{js,ts,jsx,tsx}",
		"./pages/**/*.{js,ts,jsx,tsx}",
		"./components/**/*.{js,ts,jsx,tsx}",
		"./src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
				mono: ["JetBrains Mono", "Fira Code", "monospace"],
			},
			colors: {
				/* Background layers */
				"dark-layer-1": "var(--bg-dark-layer-1, #1a1a1f)",
				"dark-layer-2": "var(--bg-dark-layer-2, #0d0d0f)",
				"dark-surface": "var(--bg-surface, #131316)",
				"dark-elevated": "var(--bg-elevated, #1e1e24)",
				"dark-hover": "var(--bg-hover, #252530)",
				"bg-surface": "var(--bg-surface, #131316)",
				"bg-dark-layer-1": "var(--bg-dark-layer-1, #1a1a1f)",
				"text-primary": "var(--text-primary, #f1f1f3)",
				"text-secondary": "var(--text-secondary, #a1a1aa)",
				"text-muted": "var(--text-muted, #52525b)",

				/* Fill utilities */
				"dark-label-2": "rgba(239, 241, 246, 0.75)",
				"dark-divider-border-2": "rgb(61, 61, 61)",
				"dark-fill-2": "var(--bg-dark-fill-2)",
				"dark-fill-3": "var(--bg-dark-fill-3)",

				/* Text */
				"dark-gray-6": "rgb(138, 138, 138)",
				"dark-gray-7": "var(--text-secondary, #a1a1aa)",
				"dark-gray-8": "var(--text-primary, #f1f1f3)",
				"gray-8": "rgb(38, 38, 38)",

				/* Brand */
				"brand-orange":   "var(--brand-orange, #f59e0b)",
				"brand-orange-s": "var(--brand-orange-s, #d97706)",

				/* Semantic */
				"dark-yellow":   "rgb(255 192 30)",
				"dark-pink":     "rgb(255 55 95)",
				olive:           "rgb(0, 184, 163)",
				"dark-green-s":  "var(--color-success, rgb(44 187 93))",
				"dark-blue-s":   "var(--color-info, rgb(10 132 255))",
				"bc-success":    "var(--color-success)",
				"bc-warning":    "var(--color-warning)",
				"bc-error":      "var(--color-error)",
				"bc-info":       "var(--color-info)",
				"bc-primary":    "var(--text-primary)",
				"bc-secondary":  "var(--text-secondary)",
				"bc-muted":      "var(--text-muted)",
				"bc-accent":     "var(--text-accent)",
				"border-subtle": "var(--border-subtle)",
				"border-default": "var(--border-default)",
				"border-strong": "var(--border-strong)",

				/* Custom grays */
				"gray-250": "rgb(200,200,210)",
				"gray-305": "rgb(175,175,185)",
				"gray-350": "rgb(150,150,162)",
				"gray-450": "rgb(125,125,135)",
				"gray-650": "rgb(80,80,90)",
				"gray-750": "rgb(60,60,70)",
				"gray-805": "rgba(50,50,55)",
				"gray-850": "rgb(28,28,32)",
				"gray-855": "rgb(32,32,38)",
			},
			spacing: {
				"px-safe": "max(1rem, env(safe-area-inset-left))",
			},
			borderRadius: {
				sm: "6px",
				DEFAULT: "10px",
				lg: "16px",
				xl: "22px",
			},
			boxShadow: {
				sm:       "0 1px 3px rgba(0,0,0,0.5)",
				md:       "0 4px 16px rgba(0,0,0,0.6)",
				lg:       "0 10px 40px rgba(0,0,0,0.7)",
				glow:     "var(--shadow-glow)",
				"glow-sm": "var(--shadow-glow-sm)",
				"glow-md": "var(--shadow-glow-md)",
				"glow-lg": "var(--shadow-glow-lg)",
				"glow-inner": "var(--shadow-glow-inner)",
				"glow-success": "var(--shadow-glow-success)",
				"glow-error": "var(--shadow-glow-error)",
			},
			dropShadow: {
				glow: "var(--drop-shadow-glow)",
				"glow-sm": "var(--drop-shadow-glow-sm)",
				"glow-md": "var(--drop-shadow-glow-md)",
				"glow-success": "0 0 6px rgba(16, 185, 129, 0.45)",
				"glow-error": "0 0 6px rgba(239, 68, 68, 0.45)",
			},
			transitionTimingFunction: {
				smooth: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
				spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
			},
			keyframes: {
				"fade-in": {
					from: { opacity: "0", transform: "translateY(6px)" },
					to:   { opacity: "1", transform: "translateY(0)" },
				},
				shimmer: {
					"0%":   { backgroundPosition: "-1000px 0" },
					"100%": { backgroundPosition: "1000px 0" },
				},
				shake: {
					"0%, 100%": { transform: "translateX(0)" },
					"20%, 60%": { transform: "translateX(-4px)" },
					"40%, 80%": { transform: "translateX(4px)" },
				},
				float: {
					"0%, 100%": { transform: "translateY(0px)" },
					"50%": { transform: "translateY(-10px)" },
				},
			},
			animation: {
				"fade-in": "fade-in 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
				shimmer:   "shimmer 1.6s linear infinite",
				shake:     "shake 0.25s cubic-bezier(.36,.07,.19,.97) both",
				float:     "float 6s ease-in-out infinite",
			},
		},
	},
	plugins: [
		require("tailwindcss/plugin")(function ({ addUtilities }) {
			addUtilities({
				".text-shadow-glow": {
					"text-shadow": "var(--text-shadow-glow, 0 0 10px rgba(245, 158, 11, 0.4))",
				},
				".text-shadow-glow-success": {
					"text-shadow": "0 0 10px rgba(16, 185, 129, 0.45)",
				},
				".text-shadow-glow-error": {
					"text-shadow": "0 0 10px rgba(239, 68, 68, 0.45)",
				},
			});
		}),
	],
};
