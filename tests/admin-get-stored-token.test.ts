/**
 * Regression test for the "Super Admin can't see Strapi's built-in nav"
 * bug: Strapi only writes the JWT to localStorage when "Remember me" is
 * checked at login (persist=true); "Remember me" defaults to unchecked, so
 * on a default login the token instead lands in a cookie. Any code reading
 * localStorage alone silently sees no token on that (default) login path.
 */
import { getStoredToken } from '../src/admin/getStoredToken';

describe('getStoredToken', () => {
  const TOKEN = 'header.payload.signature';

  beforeEach(() => {
    (global as any).window = { localStorage: { getItem: () => null } };
    (global as any).document = { cookie: '' };
  });

  it('reads a JSON-stringified token from localStorage when present ("Remember me" checked)', () => {
    (global as any).window.localStorage.getItem = (key: string) =>
      key === 'jwtToken' ? JSON.stringify(TOKEN) : null;

    expect(getStoredToken()).toBe(TOKEN);
  });

  it('falls back to the jwtToken cookie when localStorage is empty (default "Remember me" unchecked login)', () => {
    (global as any).document.cookie = `jwtToken=${encodeURIComponent(TOKEN)}; Path=/`;

    expect(getStoredToken()).toBe(TOKEN);
  });

  it('finds the cookie among multiple cookies regardless of position', () => {
    (global as any).document.cookie = `other=1; jwtToken=${encodeURIComponent(TOKEN)}; another=2`;

    expect(getStoredToken()).toBe(TOKEN);
  });

  it('returns null when neither localStorage nor a cookie has a token', () => {
    expect(getStoredToken()).toBeNull();
  });
});
