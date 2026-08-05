const TOKEN_KEY = 'jwtToken';

/**
 * Strapi's admin only writes the JWT to localStorage when "Remember me" is
 * checked at login (persist=true, see @strapi/admin's reducer `login`
 * action). "Remember me" defaults to unchecked, so on a default login the
 * token instead lands in a plain (non-httpOnly) cookie of the same name.
 * Code that reads localStorage alone silently finds no token — and
 * therefore no super-admin status — on the default login flow.
 */
export function getStoredToken(): string | null {
  const fromLocalStorage = window.localStorage.getItem(TOKEN_KEY);
  if (fromLocalStorage) {
    try {
      return JSON.parse(fromLocalStorage);
    } catch {
      return null;
    }
  }

  const prefix = `${TOKEN_KEY}=`;
  const cookieEntry = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));

  if (!cookieEntry) return null;
  return decodeURIComponent(cookieEntry.slice(prefix.length));
}
