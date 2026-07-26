import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useNamespace } from '../components/routing/NamespaceRoute.jsx';
import { paths } from '../lib/paths.js';
import { api } from '../lib/apiClient.js';
import { SelectField, TextField } from '../components/ui/FormField.jsx';
import {
  Callout,
  EmptyState,
  ErrorMessage,
  LoadingState,
} from '../components/ui/Feedback.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import { PLACEHOLDERS, runValidators, validateApiKey } from '../lib/validation.js';

/**
 * Namespace level AI credentials.
 *
 * A project's credentials pay for that project's translation pipeline. These
 * pay for what the namespace does outside any one project, which today means
 * the assistant.
 *
 * The list is a chain rather than a set, and the order is what the server walks
 * when a credential fails. Inside an organization the organization's keys are
 * tried first and the person's own follow, so an expired company card stops one
 * request rather than the whole team. The interface says that plainly, because
 * it is the difference between "why is my key being used" and "of course it is".
 *
 * Each row names its own platform and models, which a project credential does
 * not have to: a project already records those, and an account has nothing to
 * take them from.
 *
 * @returns {JSX.Element} The page.
 */
export function NamespaceAiSettingsPage() {
  const namespace = useNamespace();
  const ns = namespace.user_id;
  const isOrg = namespace.type === 'ORG';

  const [keys, setKeys] = useState([]);
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    provider: '',
    chat_model: '',
    embedding_model: '',
    api_key: '',
    label: '',
  });

  const selectedProvider = providers.find((entry) => entry.name === form.provider) ?? null;
  const embeddingModels = selectedProvider?.embedding_models ?? [];

  /**
   * Loads the credential chain and the platform catalogue.
   *
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [keysResult, providerResult] = await Promise.all([
        api.listAccountKeys(ns),
        api.listProviders(),
      ]);

      const catalogue = providerResult.providers ?? [];
      setKeys(keysResult.keys ?? []);
      setProviders(catalogue);
      setForm((current) => {
        if (current.provider !== '') return current;
        const first = catalogue[0];
        return {
          ...current,
          provider: first?.name ?? '',
          chat_model: first?.default_model ?? '',
          embedding_model: '',
        };
      });
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [ns]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Updates a form field and clears its error.
   *
   * @param {string} field Field name.
   * @returns {Function} Change handler.
   */
  function handleChange(field) {
    return (event) => {
      const { value } = event.target;
      setForm((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setNotice(null);
    };
  }

  /**
   * Switches platform, resetting both models to that platform's own.
   *
   * The embedding model resets to empty rather than to a default, because
   * leaving it unset is a legitimate choice and the ordinary one. A platform
   * that serves no embeddings at all, such as Anthropic, offers nothing here.
   *
   * @param {React.ChangeEvent} event Change event.
   * @returns {void}
   */
  function handleProviderChange(event) {
    const providerName = event.target.value;
    const provider = providers.find((entry) => entry.name === providerName);

    setForm((current) => ({
      ...current,
      provider: providerName,
      chat_model: provider?.default_model ?? '',
      embedding_model: '',
    }));
    setErrors({});
    setNotice(null);
  }

  /**
   * Adds a credential.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleAdd(event) {
    event.preventDefault();
    setActionError(null);
    setNotice(null);

    const { errors: found, isValid } = runValidators({
      api_key: () => validateApiKey(form.api_key),
    });

    if (!isValid) {
      setErrors(found);
      return;
    }

    setIsSaving(true);
    try {
      await api.addAccountKey(ns, {
        provider: form.provider,
        chat_model: form.chat_model,
        // Empty means no embeddings, which the server accepts and which leaves
        // the assistant working with search falling back to text matching.
        ...(form.embedding_model === '' ? {} : { embedding_model: form.embedding_model }),
        api_key: form.api_key,
        ...(form.label.trim().length > 0 ? { label: form.label.trim() } : {}),
      });

      setNotice('Credential added.');
      setForm((current) => ({ ...current, api_key: '', label: '' }));
      await load();
    } catch (error) {
      setActionError(error);
      setErrors(error.fieldErrors ?? {});
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Moves a credential up or down the chain.
   *
   * @param {number} index Current position.
   * @param {number} direction -1 for up, 1 for down.
   * @returns {Promise<void>}
   */
  async function handleMove(index, direction) {
    const next = [...keys];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];

    setActionError(null);
    try {
      await api.reorderAccountKeys(
        ns,
        next.map((key) => key.id),
      );
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  /**
   * Enables or disables a credential without removing it.
   *
   * @param {object} key The credential.
   * @returns {Promise<void>}
   */
  async function handleToggleActive(key) {
    setActionError(null);
    try {
      await api.updateAccountKey(ns, key.id, { is_active: !key.is_active });
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  /**
   * Removes a credential.
   *
   * @param {object} key The credential.
   * @returns {Promise<void>}
   */
  async function handleRemove(key) {
    const confirmed = window.confirm(
      `Remove ${key.label || 'this credential'}? The assistant will fall through to the next one.`,
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      await api.removeAccountKey(ns, key.id);
      setNotice('Credential removed.');
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  if (isLoading) {
    return (
      <div className="container">
        <LoadingState label="Loading AI settings" />
      </div>
    );
  }

  /*
   * Inside an organization every one of these endpoints needs ADMIN, reading
   * included. A member reaching this page gets a 403 rather than an empty list,
   * so it is explained rather than rendered as though nothing is configured.
   */
  if (loadError?.status === 403) {
    return (
      <div className="container narrow">
        <Breadcrumbs
          items={[
            { label: 'Namespaces', to: paths.namespaces() },
            { label: ns, to: paths.namespace(ns) },
            { label: 'AI settings' },
          ]}
        />
        <h1>AI settings</h1>
        <Callout tone="info" title="Owners and administrators only">
          These credentials pay for what the organization does, so the list is restricted
          the way membership and billing are. Ask an owner or an administrator if something
          needs changing.
        </Callout>
        <Link className="btn" to={paths.namespace(ns)}>
          Back to projects
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container narrow">
        <ErrorMessage error={loadError} />
        <Link className="btn" to={paths.namespace(ns)}>
          Back to projects
        </Link>
      </div>
    );
  }

  const hasEmbeddingModel = keys.some(
    (key) => key.is_active && typeof key.embedding_model === 'string',
  );

  return (
    <div className="container narrow">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: paths.namespaces() },
          { label: ns, to: paths.namespace(ns) },
          { label: 'AI settings' },
        ]}
      />

      <h1>AI settings</h1>
      <p className="lead">
        Credentials for what <span className="mono">{ns}</span> does outside a single
        project, which today means the assistant. A project keeps its own keys for
        translating.
      </p>

      <ErrorMessage error={actionError} />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <section className="panel">
        <div className="panel__header">
          <h2>Credential chain</h2>
          <span className="badge badge--accent">{keys.length}</span>
        </div>

        <Callout tone="info" title="How the chain is walked">
          {isOrg ? (
            <>
              This organization&apos;s credentials are tried first, in this order. If one is
              revoked, throttled or out of quota, the next is used, and after the last of
              them the person asking falls back to their own personal credentials. An
              expired company card stops one request rather than the whole team.
            </>
          ) : (
            <>
              Credentials are tried in this order. If one is revoked, throttled or out of
              quota, the next is used automatically. These are also the credentials that
              stand behind any organization you belong to, when its own keys fail.
            </>
          )}{' '}
          Stored keys are encrypted and can never be read back, so only the last four
          characters are shown.
        </Callout>

        {keys.length === 0 ? (
          <EmptyState title="No credentials configured.">
            <p className="muted">
              The assistant falls back to the built in offline provider, which answers
              without reaching a vendor. Add a credential to use a real model.
            </p>
          </EmptyState>
        ) : (
          <div className="keylist">
            {keys.map((key, index) => (
              <div className="keylist__item" key={key.id}>
                <span className="keylist__order" aria-hidden="true">
                  {index + 1}
                </span>

                <div className="keylist__body">
                  <div className="keylist__label">
                    {key.label || 'Unlabelled credential'}{' '}
                    <span className="mono muted">{key.masked_key}</span>
                    {key.is_active ? null : (
                      <span className="badge" style={{ marginLeft: '0.4rem' }}>
                        disabled
                      </span>
                    )}
                  </div>
                  <div className="keylist__meta">
                    <span className="mono">{key.provider}</span> · chat{' '}
                    <span className="mono">{key.chat_model}</span>
                    {key.embedding_model ? (
                      <>
                        {' '}
                        · embeddings <span className="mono">{key.embedding_model}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="keylist__meta">
                    {key.last_error_at ? (
                      <span className="field__error">
                        Last failure: {key.last_error_reason}
                      </span>
                    ) : key.last_used_at ? (
                      <>Last used {new Date(key.last_used_at).toLocaleString()}</>
                    ) : (
                      'Not used yet'
                    )}
                  </div>
                </div>

                <div className="keylist__actions">
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${key.label || 'credential'} up in priority`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === keys.length - 1}
                    aria-label={`Move ${key.label || 'credential'} down in priority`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => handleToggleActive(key)}
                  >
                    {key.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    onClick={() => handleRemove(key)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {keys.length > 0 && !hasEmbeddingModel ? (
          <Callout tone="info" title="No embedding model configured">
            The assistant works exactly as it does now. Searching past conversations
            matches text rather than meaning, and no vectors are stored. Naming an
            embedding model on any credential turns that on.
          </Callout>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Add a credential</h2>
        </div>

        <form onSubmit={handleAdd} noValidate>
          <div className="field-row">
            <SelectField
              label="Platform"
              name="provider"
              value={form.provider}
              onChange={handleProviderChange}
              options={providers.map((provider) => ({
                value: provider.name,
                label: provider.label,
              }))}
              hint={
                selectedProvider?.requires_network === false
                  ? 'Runs offline. Useful for trying the assistant out.'
                  : selectedProvider?.supports_caching
                    ? 'Caches the prompt prefix, which matters when one question takes several steps.'
                    : undefined
              }
            />

            <SelectField
              label="Chat model"
              name="chat_model"
              value={form.chat_model}
              onChange={handleChange('chat_model')}
              options={(selectedProvider?.models ?? []).map((model) => ({
                value: model,
                label: model,
              }))}
            />
          </div>

          <SelectField
            label="Embedding model"
            name="embedding_model"
            value={form.embedding_model}
            onChange={handleChange('embedding_model')}
            options={[
              { value: '', label: 'None, search matches text' },
              ...embeddingModels.map((model) => ({ value: model, label: model })),
            ]}
            error={errors.embedding_model}
            hint={
              embeddingModels.length === 0
                ? `${selectedProvider?.label ?? 'This platform'} serves no embeddings. Leave this empty, or add a second credential on a platform that does.`
                : 'Optional. Lets the assistant search past conversations by meaning rather than by text.'
            }
            disabled={embeddingModels.length === 0}
          />

          <div className="field-row">
            <TextField
              label="API key"
              name="api_key"
              type="password"
              value={form.api_key}
              onChange={handleChange('api_key')}
              placeholder={PLACEHOLDERS.apiKey}
              hint="Encrypted before storage. It cannot be read back afterwards."
              error={errors.api_key}
              autoComplete="off"
              required
            />

            <TextField
              label="Label"
              name="label"
              value={form.label}
              onChange={handleChange('label')}
              placeholder={PLACEHOLDERS.apiKeyLabel}
              hint="Optional. Helps you tell credentials apart."
            />
          </div>

          <button type="submit" className="btn btn--primary" disabled={isSaving}>
            {isSaving ? 'Adding' : 'Add credential'}
          </button>
        </form>
      </section>
    </div>
  );
}
