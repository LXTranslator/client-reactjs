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
import { PLACEHOLDERS, runValidators, validateProjectName } from '../lib/validation.js';

/**
 * Project settings: name, description, AI platform and model.
 *
 * A project holds no credentials. It names a platform and a model, and the key
 * that pays for a translation comes from the account that owns the project,
 * falling back to the personal keys of whoever asked. That is a billing
 * relationship, and it belongs where the billing does, so this page points at
 * the namespace AI settings rather than carrying a key form of its own.
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
  const [accountKeys, setAccountKeys] = useState([]);
  const [values, setValues] = useState({
    name: '',
    description: '',
    ai_provider: '',
    ai_model: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedProvider = providers.find((entry) => entry.name === values.ai_provider) ?? null;

  // Only the account keys that could actually pay for the platform this project
  // names. A key for another vendor is not a fallback, it is a different bill.
  const keysForPlatform = accountKeys.filter(
    (key) => key.is_active && key.provider === values.ai_provider,
  );

  /**
   * Loads the project, the platform catalogue and the account credential chain.
   *
   * The chain is read only here. It tells the person choosing a platform whether
   * the account can actually pay for it, which is the one thing about it that
   * belongs on this page. Inside an organization a plain member is refused the
   * list, so a failure there is absorbed rather than failing the whole page.
   *
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [projectResult, providerResult, keysResult] = await Promise.all([
        api.getProject(projectId),
        api.listProviders(),
        api.listAccountKeys(ns).catch(() => null),
      ]);

      setProject(projectResult.project);
      setAccountKeys(keysResult?.keys ?? []);
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
  }, [projectId, ns]);

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
                  ? 'Offline. Produces placeholder text rather than a translation.'
                  : `Paid for by the ${ns} keys for this platform.`
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
          <h2>Credentials</h2>
          {keysForPlatform.length > 0 ? (
            <span className="badge badge--accent">{keysForPlatform.length}</span>
          ) : null}
        </div>

        <Callout tone="info" title="Keys belong to the account, not to this project">
          A key is a billing relationship, so it lives on{' '}
          <span className="mono">{ns}</span> and is shared by every project underneath.
          Change the platform above and this project starts drawing on that
          platform&apos;s keys instead, with nothing to re-enter.
        </Callout>

        {selectedProvider?.requires_network === false ? (
          <Callout tone="warn" title="This platform translates nothing">
            <span className="mono">{selectedProvider.label}</span> never contacts a vendor.
            It hands back the English text with a locale marker in front of it, and the file
            still reports itself as finished, so the editor fills with rows that look like
            translations and are not. It exists so the application runs with no
            configuration. Pick a real platform above to translate for real.
          </Callout>
        ) : keysForPlatform.length === 0 ? (
          <EmptyState title={`No ${selectedProvider?.label ?? 'matching'} key on this account.`}>
            <p className="muted">
              Translating on this platform will fall back to the built in offline
              provider, or fail in production. Add one in AI settings.
            </p>
          </EmptyState>
        ) : (
          <p className="muted">
            {keysForPlatform.length === 1
              ? 'One key on this account can pay for this platform.'
              : `${keysForPlatform.length} keys on this account can pay for this platform, tried in the order set in AI settings.`}
          </p>
        )}

        <Link className="btn" to={paths.namespaceAiSettings(ns)}>
          Manage AI settings
        </Link>
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
