export type Theme = "light" | "dark";

const STORAGE_KEY = "astro-playground-theme";

/** Resolve the initial theme from storage, then system preference, then dark. */
export function initialTheme(): Theme {
	if (typeof localStorage !== "undefined") {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === "light" || saved === "dark") return saved;
	}
	if (
		typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-color-scheme: light)").matches
	) {
		return "light";
	}
	return "dark";
}

/** Apply the theme to the document root and persist it. */
export function applyTheme(theme: Theme): void {
	if (typeof document !== "undefined") {
		document.documentElement.dataset.theme = theme;
	}
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(STORAGE_KEY, theme);
	}
}
