export function loginWithRedirect(route: string): string {
  const r = route.startsWith("/") ? route : "/" + route;
  return `/login?redirect=${encodeURIComponent(r)}`;
}
