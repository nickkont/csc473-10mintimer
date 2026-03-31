/**
 * Hrefs to static HTML/CSS/JS in the repo root (sibling to react-dist/).
 * - Production: opened as .../react-dist/index.html → use ../file.html
 * - Static server from project root: use /file.html
 * - Vite dev: same /file.html; vite.config serves repo-root files from parent dir
 */
export function siteRootPage(file: string): string {
  const name = file.replace(/^\//, "");
  if (typeof window !== "undefined" && window.location.pathname.includes("/react-dist/")) {
    return `../${name}`;
  }
  return `/${name}`;
}

/** Marketing homepage (root index.html), not the React entry. */
export function siteHomeHref(): string {
  if (typeof window !== "undefined" && window.location.pathname.includes("/react-dist/")) {
    return "../index.html";
  }
  // Vite dev serves repo-root index at /home.html so /index.html stays the SPA entry.
  if (import.meta.env.DEV) {
    return "/home.html";
  }
  // `vite preview` serves the build at / without "react-dist" in the path — same alias as dev.
  if (
    typeof window !== "undefined" &&
    import.meta.env.PROD &&
    window.location.port === "4173" &&
    !window.location.pathname.includes("/react-dist/")
  ) {
    return "/home.html";
  }
  return "/index.html";
}

export function loginWithRedirect(hashRoute: string): string {
  const target = `react-dist/index.html${hashRoute.startsWith("#") ? hashRoute : "#" + hashRoute}`;
  return `${siteRootPage("login.html")}?redirect=${encodeURIComponent(target)}`;
}
