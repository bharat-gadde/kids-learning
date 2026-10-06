// src/app/ui/art.ts
/** A picture's URL: under the site's base path, so a GitHub Pages project site (served under /<repo>/) finds it. */
export const artUrl = (asset: string): string => `${import.meta.env.BASE_URL}art/${asset}`;
