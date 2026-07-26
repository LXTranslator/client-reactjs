import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, getAuthToken, ApiError } from '../lib/apiClient.js';

/**
 * Session and namespace state.
 *
 * Holds three things the whole application needs: who is signed in, which
 * namespaces they can act in, and which namespace is currently active.
 *
 * The active namespace exists because the route structure
 * (`/namespaces/settings`, `/namespaces/projects`) carries no namespace segment.
 * Something has to decide which namespace those pages refer to, and that is this
 * context.
 */

const AuthContext = createContext(null);

/** Remembers the active namespace across reloads within the same tab. */
const ACTIVE_NAMESPACE_KEY = 'lxtranslator_active_namespace';

/**
 * Reads a value from session storage, tolerating storage being unavailable.
 *
 * @param {string} key Storage key.
 * @returns {string|null} Stored value, or null.
 */
function readStored(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes a value to session storage, tolerating storage being unavailable.
 *
 * @param {string} key Storage key.
 * @param {string|null} value Value, or null to remove it.
 * @returns {void}
 */
function writeStored(key, value) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage is a convenience here; the value is also held in React state.
  }
}

/**
 * Provides session state to the tree.
 *
 * @param {{children: React.ReactNode}} props Component props.
 * @returns {JSX.Element} The provider.
 */
export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [namespaces, setNamespaces] = useState([]);
  const [activeNamespaceId, setActiveNamespaceId] = useState(
    () => readStored(ACTIVE_NAMESPACE_KEY),
  );
  // Starts true so the router does not flash the login page while the stored
  // token is still being verified.
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Loads the namespaces the account can act in.
   *
   * @param {object} currentAccount The signed in account.
   * @returns {Promise<Array<object>>} The namespaces.
   */
  const loadNamespaces = useCallback(async (currentAccount) => {
    const result = await api.listNamespaces();
    const list = result?.namespaces ?? [];
    setNamespaces(list);

    // Fall back to the personal namespace whenever the remembered one is no
    // longer reachable, for example after being removed from an organization.
    setActiveNamespaceId((current) => {
      const stillValid = list.some((entry) => entry.user_id === current);
      const next = stillValid ? current : currentAccount.user_id;
      writeStored(ACTIVE_NAMESPACE_KEY, next);
      return next;
    });

    return list;
  }, []);

  /** Restores a session from the stored token on first mount. */
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (getAuthToken() === null) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const result = await api.me();
        if (cancelled) return;
        setAccount(result.account);
        await loadNamespaces(result.account);
      } catch (error) {
        // An expired or revoked token is simply a signed out session.
        if (error instanceof ApiError && error.isUnauthorized) setAuthToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [loadNamespaces]);

  /**
   * Signs in and loads the account's namespaces.
   *
   * @param {{identifier: string, password: string}} credentials Login payload.
   * @returns {Promise<object>} The signed in account.
   */
  const login = useCallback(
    async (credentials) => {
      const result = await api.login(credentials);
      setAuthToken(result.access_token);
      setAccount(result.account);
      await loadNamespaces(result.account);
      return result.account;
    },
    [loadNamespaces],
  );

  /**
   * Registers a new account and signs it in.
   *
   * @param {object} payload Registration payload.
   * @returns {Promise<object>} The new account.
   */
  const register = useCallback(
    async (payload) => {
      const result = await api.register(payload);
      setAuthToken(result.access_token);
      setAccount(result.account);
      await loadNamespaces(result.account);
      return result.account;
    },
    [loadNamespaces],
  );

  /**
   * Clears the session.
   *
   * @returns {void}
   */
  const logout = useCallback(() => {
    setAuthToken(null);
    setAccount(null);
    setNamespaces([]);
    setActiveNamespaceId(null);
    writeStored(ACTIVE_NAMESPACE_KEY, null);
  }, []);

  /**
   * Switches the active namespace.
   *
   * @param {string} namespaceUserId Routing identifier of the namespace.
   * @returns {void}
   */
  const selectNamespace = useCallback((namespaceUserId) => {
    setActiveNamespaceId(namespaceUserId);
    writeStored(ACTIVE_NAMESPACE_KEY, namespaceUserId);
  }, []);

  /**
   * Re-reads the account and its namespaces, after a settings change.
   *
   * @returns {Promise<void>}
   */
  const refresh = useCallback(async () => {
    const result = await api.me();
    setAccount(result.account);
    await loadNamespaces(result.account);
  }, [loadNamespaces]);

  const activeNamespace = useMemo(
    () => namespaces.find((entry) => entry.user_id === activeNamespaceId) ?? null,
    [namespaces, activeNamespaceId],
  );

  const value = useMemo(
    () => ({
      account,
      namespaces,
      activeNamespace,
      activeNamespaceId,
      isAuthenticated: account !== null,
      isLoading,
      login,
      register,
      logout,
      selectNamespace,
      refresh,
    }),
    [
      account,
      namespaces,
      activeNamespace,
      activeNamespaceId,
      isLoading,
      login,
      register,
      logout,
      selectNamespace,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads the session context.
 *
 * @returns {object} Session state and actions.
 * @throws {Error} When used outside the provider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}

export { AuthContext };
