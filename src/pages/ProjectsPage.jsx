import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
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
 * Project list and creation.
 *
 * The provider catalogue is fetched from the API rather than hard coded here,
 * so adding a provider on the server surfaces in this form with no client
 * change.
 *
 * @returns {JSX.Element} The page.
 */
export function ProjectsPage() {
  const { activeNamespace } = useAuth();

  const [projects, setProjects] = useState([]);
  const [providers, setProviders] = useState([]);
  const [values, setValues] = useState({
    name: '',
    description: '',
    ai_provider: '',
    ai_model: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const selectedProvider = providers.find((entry) => entry.name === values.ai_provider) ?? null;

  /**
   * Loads projects for the active namespace.
   *
   * @returns {Promise<void>}
   */
  const loadProjects = useCallback(async () => {
    if (!activeNamespace) return;

    setIsLoading(true);
    try {
      const result = await api.listProjects(activeNamespace.user_id);
      setProjects(result.projects ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [activeNamespace]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  /* Load the provider catalogue once. */
  useEffect(() => {
    let cancelled = false;

    api
      .listProviders()
      .then((result) => {
        if (cancelled) return;
        setProviders(result.providers ?? []);
        setValues((current) => ({
          ...current,
          ai_provider: current.ai_provider || result.default_provider,
          ai_model: current.ai_model || result.default_model,
        }));
      })
      .catch(() => {
        // The form still works without the catalogue; the server applies its
        // own defaults when the fields are omitted.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Updates a field and clears its error.
   *
   * @param {string} field Field name.
   * @returns {Function} Change handler.
   */
  function handleChange(field) {
    return (event) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  /**
   * Switches provider, resetting the model to that provider's default.
   *
   * Keeping the old model would almost certainly name something the new
   * provider does not offer.
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
  }

  /**
   * Creates a project.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleCreate(event) {
    event.preventDefault();
    setSubmitError(null);
    setNotice(null);

    const { errors: found, isValid } = runValidators({
      name: () => validateProjectName(values.name),
    });

    setErrors(found);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await api.createProject(activeNamespace.user_id, {
        name: values.name.trim(),
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        ...(values.ai_provider ? { ai_provider: values.ai_provider } : {}),
        ...(values.ai_model ? { ai_model: values.ai_model } : {}),
      });

      setNotice('Project created.');
      setValues((current) => ({ ...current, name: '', description: '' }));
      await loadProjects();
    } catch (error) {
      setSubmitError(error);
      const fieldErrors = error?.fieldErrors ?? {};
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!activeNamespace) {
    return (
      <div className="container">
        <LoadingState label="Loading namespace" />
      </div>
    );
  }

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: '/namespaces' },
          { label: activeNamespace.user_id },
          { label: 'Projects' },
        ]}
      />

      <h1>Projects</h1>
      <p className="lead">
        Projects in <span className="mono">{activeNamespace.user_id}</span>. Each one holds
        its own AI provider settings and credentials.
      </p>

      <ErrorMessage error={loadError} />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <section className="panel">
        <div className="panel__header">
          <h2>New project</h2>
        </div>

        <ErrorMessage error={submitError} />

        <form onSubmit={handleCreate} noValidate>
          <div className="field-row">
            <TextField
              label="Project name"
              name="name"
              value={values.name}
              onChange={handleChange('name')}
              placeholder={PLACEHOLDERS.projectName}
              hint="Unique within this namespace."
              error={errors.name}
              required
            />

            <TextField
              label="Description"
              name="description"
              value={values.description}
              onChange={handleChange('description')}
              placeholder={PLACEHOLDERS.projectDescription}
              error={errors.description}
            />
          </div>

          {providers.length > 0 ? (
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
                    : 'Needs at least one API key, added in project settings.'
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
          ) : null}

          <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating' : 'Create project'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>All projects</h2>
          <span className="badge badge--accent">{projects.length}</span>
        </div>

        {isLoading ? (
          <LoadingState label="Loading projects" />
        ) : projects.length === 0 ? (
          <EmptyState title="No projects yet.">
            <p className="muted">Create your first project using the form above.</p>
          </EmptyState>
        ) : (
          <div className="card-grid">
            {projects.map((project) => (
              <Link
                key={project.id}
                className="card"
                to={`/namespaces/project/${project.id}`}
              >
                <span className="card__icon" aria-hidden="true">
                  {project.name.slice(0, 2).toUpperCase()}
                </span>
                <p className="card__title">{project.name}</p>
                <p className="card__desc">
                  {project.description || 'No description'}
                </p>
                <div className="chip-row" style={{ marginTop: '0.65rem' }}>
                  <span className="badge">{project.ai_provider}</span>
                  <span className="badge">{project.ai_model}</span>
                </div>
                <span className="card__more">Open project</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
