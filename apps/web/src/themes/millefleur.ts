/**
 * The Millefleur theme's lazy chunk (roadmap 46). `useTheme.ts` imports this module with a
 * dynamic `import()` the first time the theme is applied, so Vite emits it, its stylesheet and
 * the Nunito `@font-face` rules as a separate chunk: players on the four dark themes download
 * none of it. Never import this statically (a static import in main.tsx would put the whole
 * theme and Nunito's CSS in every player's shared bundle).
 *
 * Nunito is latin-only: the subset CSS registers one `unicode-range` face per weight, and the
 * browser fetches a font file only when text actually uses it. 400/600/700/800 are the weights
 * the design system uses (body, UI labels, buttons and headings).
 */
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '../styles/theme-millefleur.css';
