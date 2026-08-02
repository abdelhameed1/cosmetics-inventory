import type { StrapiApp } from '@strapi/strapi/admin';

const SUPER_ADMIN_ROLE_CODE = 'strapi-super-admin';
const PLUGIN_HOME_PATH = '/admin/plugins/inventory-dashboard';

let cachedToken: string | null = null;
let cachedIsSuperAdmin = false;

async function resolveIsSuperAdmin(): Promise<boolean> {
  const rawToken = window.localStorage.getItem('jwtToken');
  if (!rawToken) {
    cachedToken = null;
    return false;
  }
  if (rawToken === cachedToken) {
    return cachedIsSuperAdmin;
  }

  try {
    const token = JSON.parse(rawToken);
    const res = await fetch('/admin/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;

    const { data } = (await res.json()) as { data?: { roles?: Array<{ code?: string }> } };
    cachedToken = rawToken;
    cachedIsSuperAdmin = Boolean(data?.roles?.some((role) => role.code === SUPER_ADMIN_ROLE_CODE));
    return cachedIsSuperAdmin;
  } catch {
    return false;
  }
}

/**
 * Strapi's own built-in nav has no stable selector to hook into, but it's
 * always rendered as the first <nav> in the document (AuthenticatedLayout
 * mounts it before the routed page content). Our plugin's AppSidebar is
 * also a <nav>, but always nested deeper inside that routed content, so it
 * always sorts after it in document order — index 0 is reliably Strapi's.
 */
function applyNavVisibility(isSuperAdmin: boolean) {
  const strapiNav = document.querySelectorAll('nav')[0] as HTMLElement | undefined;
  if (!strapiNav) return;

  strapiNav.style.display = isSuperAdmin ? '' : 'none';
  strapiNav.setAttribute('aria-hidden', isSuperAdmin ? 'false' : 'true');
}

/**
 * Strapi's own Home page (the bare admin root) is where a user lands right
 * after login. Non-super-admins have no way to reach it deliberately once
 * the built-in nav is hidden, so if they're there it's either the post-login
 * landing or a stale/typed URL — either way, send them to the plugin's own
 * Overview instead of Strapi's default dashboard.
 */
function redirectNonSuperAdminFromHome(isSuperAdmin: boolean) {
  if (isSuperAdmin) return;
  if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
    window.location.replace(PLUGIN_HOME_PATH);
  }
}

export default {
  config: {
    locales: [],
  },
  async bootstrap(_app: StrapiApp) {
    const check = async () => {
      const isSuperAdmin = await resolveIsSuperAdmin();
      applyNavVisibility(isSuperAdmin);
      redirectNonSuperAdminFromHome(isSuperAdmin);
    };

    check();

    // Re-run on every DOM change (login/logout swap the whole layout without
    // a full page reload, so there's no other reliable hook to react to).
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        check();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Cross-tab login/logout also needs a re-check since it won't trigger a
    // mutation in this tab.
    window.addEventListener('storage', check);
  },
};
