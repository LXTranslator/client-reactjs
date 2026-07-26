import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useNamespace } from '../components/routing/NamespaceRoute.jsx';
import { paths } from '../lib/paths.js';
import { api } from '../lib/apiClient.js';
import { SelectField, TextField, TextAreaField } from '../components/ui/FormField.jsx';
import {
  Callout,
  EmptyState,
  ErrorMessage,
  LoadingState,
} from '../components/ui/Feedback.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import {
  PLACEHOLDERS,
  runValidators,
  validateApiKey,
  validateProjectName,
} from '../lib/validation.js';

/**
 * Project settings: AI provider, model, and the API key fallback chain.
 *
 * The key list is the client half of the server's fallback mechanism. Order is
 * meaningful: the worker tries the first key, and moves down the list when one
 * fails because it is revoked, throttled or out of quota. Moving a key up or
 * down here changes which credential is tried first.
 *
 * A stored key is never readable. The interface shows a label and the last four
 * characters, which is enough to tell keys apart without exposing any of them.
 *
 * @returns {JSX.Element} The page.
 */
export function ProjectSettingsPage() {
  const { projectId } = useParams();
  const namespace = useNamespace();
  const ns = namespace.user_id;
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [providers, setProviders] = useState([]);
  const [keys, setKeys] = useState([]);
  const [values, setValues] = useState({
    name: '',
    description: '',
    ai_provider: '',
    ai_model: '',
  });
  const [keyForm, setKeyForm] = useState({ api_key: '', label: '' });
  const [errors, setErrors] = useState({});
  const [keyErrors, setKeyErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedProvider = providers.find((entry) => entry.name === values.ai_provider) ?? null;

  /**
   * Loads the project, its credentials and the provider catalogue.
   *
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [projectResult, keysResult, providerResult] = await Promise.all([
        api.getProject(projectId),
        api.listApiKeys(projectId),
        api.listProviders(),
      ]);

      setProject(projectResult.project);
      setKeys(keysResult.keys ?? []);
      setProviders(providerResult.providers ?? []);
      setValues({
        name: projectResult.project.name,
        description: projectResult.project.description ?? '',
        ai_provider: projectResult.project.ai_provider,
        ai_model: projectResult.project.ai_model,
      });
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Updates a project field and clears its error.
   *
   * @param {string} field Field name.
   * @returns {Function} Change handler.
   */
  function handleChange(field) {
    return (event) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setNotice(null);
    };
  }

  /**
   * Switches provider, resetting the model to that provider's default.
   *
   * @param {React.ChangeEvent} event Change event.
   * @returns {void}
   */
  function handleProviderChange(event) {
    const providerName = event.target.value;
    const provider = providers.find((entry) => entry.name === providerName);
    setValues((current) => ({
      ...current,
      ai_provider: providerName,
      ai_model: provider?.default_model ?? '',
    }));
    setNotice(null);
  }

  /**
   * Saves the project settings.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleSaveProject(event) {
    event.preventDefault();
    setActionError(null);
    setNotice(null);

    const { errors: found, isValid } = runValidators({
      name: () => validateProjectName(values.name),
    });

    setErrors(found);
    if (!isValid) return;

    setIsSaving(true);
    try {
      await api.updateProject(projectId, {
        name: values.name.trim(),
        description: values.description.trim(),
        ai_provider: values.ai_provider,
        ai_model: values.ai_model,
      });
      setNotice('Project settings saved.');
      await load();
    } catch (error) {
      setActionError(error);
      const fieldErrors = error?.fieldErrors ?? {};
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Adds a credential to the end of the fallback chain.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleAddKey(event) {
    event.preventDefault();
    setActionError(null);
    setNotice(null);

    const { errors: found, isValid } = runValidators({
      api_key: () => validateApiKey(keyForm.api_key),
    });

    setKeyErrors(found);
    if (!isValid) return;

    try {
      await api.addApiKey(projectId, {
        api_key: keyForm.api_key.trim(),
        ...(keyForm.label.trim() ? { label: keyForm.label.trim() } : {}),
      });
      setKeyForm({ api_key: '', label: '' });
      setNotice('API key added to the end of the fallback chain.');
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  /**
   * Moves a credential up or down the chain.
   *
   * @param {number} index Current position.
   * @param {number} direction Offset, minus one or plus one.
   * @returns {Promise<void>}
   */
  async function handleMove(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= keys.length) return;

    const reordered = [...keys];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    // Optimistic: the list reorders immediately, then the server confirms.
    setKeys(reordered);
    setActionError(null);

    try {
      await api.reorderApiKeys(
        projectId,
        reordered.map((key) => key.id),
      );
      await load();
    } catch (error) {
      setActionError(error);
      await load();
    }
  }

  /**
   * Enables or disables a credential without deleting it.
   *
   * @param {object} key Credential record.
   * @returns {Promise<void>}
   */
  async function handleToggleActive(key) {
    setActionError(null);
    try {
      await api.updateApiKey(projectId, key.id, { is_active: !key.is_active });
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  /**
   * Removes a credential after confirmation.
   *
   * @param {object} key Credential record.
   * @returns {Promise<void>}
   */
  async function handleRemoveKey(key) {
    if (!window.confirm(`Remove the key ${key.label ?? key.masked_key}?`)) return;

    setActionError(null);
    try {
      await api.removeApiKey(projectId, key.id);
      setNotice('API key removed.');
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  /**
   * Deletes the project and everything under it.
   *
   * @returns {Promise<void>}
   */
  async function handleDeleteProject() {
    const confirmation = window.prompt(
      `This deletes the project, its files and every translation. Type the project name to confirm.`,
    );
    if (confirmation !== project?.name) return;

    setActionError(null);
    try {
      await api.deleteProject(projectId);
      navigate(paths.namespace(ns), { replace: true });
    } catch (error) {
      setActionError(error);
    }
  }

  if (isLoading) {
    return (
      <div className="container">
        <LoadingState label="Loading settings" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container narrow">
        <ErrorMessage error={loadError} />
        <Link className="btn" to="/namespaces/projects">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: paths.namespaces() },
          { label: ns, to: paths.namespace(ns) },
          { label: project?.name ?? 'Project', to: paths.project(ns, projectId) },
          { label: 'Settings' },
        ]}
      />

      <h1>Project settings</h1>

      <ErrorMessage error={actionError} />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <section className="panel">
        <div className="panel__header">
          <h2>General</h2>
        </div>

        <form onSubmit={handleSaveProject} noValidate>
          <TextField
            label="Project name"
            name="name"
            value={values.name}
            onChange={handleChange('name')}
            placeholder={PLACEHOLDERS.projectName}
            error={errors.name}
            required
          />

          <TextAreaField
            label="Description"
            name="description"
            value={values.description}
            onChange={handleChange('description')}
            placeholder={PLACEHOLDERS.projectDescription}
            error={errors.description}
          />

          <div className="field-row">
            <SelectField
              label="AI provider"
              name="ai_provider"
              value={values.ai_provider}
              onChange={handleProviderChange}
              options={providers.map((provider) => ({
                value: provider.name,
                label: provider.label,
              }))}
              hint={
                selectedProvider?.requires_network === false
                  ? 'Runs offline. No API key needed.'
                  : 'Needs at least one API key below.'
              }
            />

            <SelectField
              label="Model"
              name="ai_model"
              value={values.ai_model}
              onChange={handleChange('ai_model')}
              options={(selectedProvider?.models ?? []).map((model) => ({
                value: model,
                label: model,
              }))}
            />
          </div>

          <button type="submit" className="btn btn--primary" disabled={isSaving}>
            {isSaving ? 'Saving' : 'Save settings'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>API keys</h2>
          <span className="badge badge--accent">{keys.length}</span>
        </div>

        <Callout tone="info" title="How the fallback chain works">
          Keys are tried in order. If the first is revoked, rate limited or out of quota,
          the next one is used automatically. Stored keys are encrypted and can never be
          read back, so only the last four characters are shown.
        </Callout>

        {keys.length === 0 ? (
          <EmptyState title="No API keys configured.">
            <p className="muted">
              {selectedProvider?.requires_network === false
                ? 'The offline provider needs no key, so translation works without one.'
                : 'Add at least one key so this project can translate.'}
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
                    {key.label || 'Unlabelled key'}{' '}
                    <span className="mono muted">{key.masked_key}</span>
                    {key.is_active ? null : (
                      <span className="badge" style={{ marginLeft: '0.4rem' }}>
                        disabled
                      </span>
                    )}
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
                    aria-label={`Move ${key.label ?? 'key'} up in priority`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === keys.length - 1}
                    aria-label={`Move ${key.label ?? 'key'} down in priority`}
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
                    onClick={() => handleRemoveKey(key)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddKey} noValidate style={{ marginTop: '1.25rem' }}>
          <h3>Add a key</h3>
          <div className="field-row">
            <TextField
              label="API key"
              name="api_key"
              type="password"
              value={keyForm.api_key}
              onChange={(event) => {
                setKeyForm((current) => ({ ...current, api_key: event.target.value }));
                setKeyErrors({});
              }}
              placeholder={PLACEHOLDERS.apiKey}
              hint="Encrypted before storage. It cannot be read back afterwards."
              error={keyErrors.api_key}
              autoComplete="off"
              required
            />

            <TextField
              label="Label"
              name="label"
              value={keyForm.label}
              onChange={(event) =>
                setKeyForm((current) => ({ ...current, label: event.target.value }))
              }
              placeholder={PLACEHOLDERS.apiKeyLabel}
              hint="Optional. Helps you tell keys apart."
            />
          </div>

          <button type="submit" className="btn btn--primary">
            Add key
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Danger zone</h2>
        </div>
        <p className="muted">
          Deleting a project permanently removes its files, translation keys and every
          translation derived from them.
        </p>
        <button type="button" className="btn btn--danger" onClick={handleDeleteProject}>
          Delete this project
        </button>
      </section>
    </div>
  );
}
