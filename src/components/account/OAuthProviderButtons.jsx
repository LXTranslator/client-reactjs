import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient.js';

/** Where the callback page reads back which kind of flow it is finishing. */
export const OAUTH_MODE_KEY = 'lxtranslator_oauth_mode';

/**
 * Offers the provider sign in buttons this deployment actually configured.
 *
 * Renders **nothing** when the catalogue is empty, which is the ordinary state
 * of a deployment that configured no provider. That is how "no environment
 * variables set, the application still works" shows up in the interface: not a
 * disabled button, not an empty divider, nothing at all.
 *
 * Which providers exist is the server's to know. A `VITE_` flag would be static
 * per build, public, and free to drift from what the server will actually
 * accept.
 *
 * @param {{mode: 'LOGIN'|'LINK', onError?: Function}} props Component props.
 * @returns {JSX.Element|null} The buttons, or nothing.
 */
export function OAuthProviderButtons({ mode, onError }) {
  const [providers, setProviders] = useState([]);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api
      .listAuthProviders()
      .then((result) => {
        if (!cancelled) setProviders(result.providers ?? []);
      })
      .catch(() => {
        // A catalogue that cannot be read is the same as an empty one: offer
        // nothing rather than a button that leads nowhere.
        if (!cancelled) setProviders([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (providers.length === 0) return null;

  /**
   * Starts a flow and hands the browser to the provider.
   *
   * A full page navigation, not a popup: the served headers set
   * `Cross-Origin-Opener-Policy: same-origin`, which breaks a popup flow.
   *
   * @param {string} provider Provider name.
   * @returns {Promise<void>}
   */
  async function start(provider) {
    setPending(provider);
    try {
      const result =
        mode === 'LINK' ? await api.startOauthLink(provider) : await api.startOauthLogin(provider);

      try {
        window.sessionStorage.setItem(OAUTH_MODE_KEY, mode);
      } catch {
        // A browser refusing session storage is not a reason to fail the flow;
        // the callback falls back to a sign in, and the server decides anyway.
      }

      window.location.assign(result.authorize_url);
    } catch (error) {
      setPending(null);
      if (onError) onError(error);
    }
  }

  return (
    <div className="auth__providers">
      {providers.map((provider) => (
        <button
          key={provider.name}
          type="button"
          className="btn btn--block"
          onClick={() => start(provider.name)}
          disabled={pending !== null}
        >
          {mode === 'LINK' ? `Connect ${provider.label}` : `Continue with ${provider.label}`}
        </button>
      ))}
    </div>
  );
}
