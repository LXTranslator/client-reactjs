import { useState } from 'react';
import { Link } from 'react-router';
import { useNamespace } from '../components/routing/NamespaceRoute.jsx';
import { paths } from '../lib/paths.js';
import { api } from '../lib/apiClient.js';
import { useLoader } from '../hooks/useLoader.js';
import { useForm } from '../hooks/useForm.js';
import { TextField } from '../components/ui/FormField.jsx';
import { PlatformFields } from '../components/project/PlatformFields.jsx';
import {
  Callout,
  EmptyState,
  ErrorMessage,
  LoadingState,
} from '../components/ui/Feedback.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import { PLACEHOLDERS, validateProjectName } from '../lib/validation.js';

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
  const namespace = useNamespace();

  const { values, setValues, errors, submitError, isSubmitting, handleChange, submit } = useForm({
    name: '',
    description: '',
    ai_provider: '',
    ai_model: '',
  });
  const [notice, setNotice] = useState(null);

  const {
    data: projects = [],
    isLoading,
    error: loadError,
    reload: loadProjects,
  } = useLoader(
    async () => (await api.listProjects(namespace.user_id)).projects ?? [],
    [namespace],
  );

  /*
   * The provider catalogue loads once and preselects the server's defaults. The
   * form still works without it; the server applies its own defaults when the
   * fields are omitted.
   */
  const { data: providers = [] } = useLoader(async () => {
    const result = await api.listProviders();
    setValues((current) => ({
      ...current,
      ai_provider: current.ai_provider || result.default_provider,
      ai_model: current.ai_model || result.default_model,
    }));
    return result.providers ?? [];
  }, []);

  /**
   * Creates a project.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleCreate(event) {
    event.preventDefault();
    setNotice(null);

    await submit({ name: () => validateProjectName(values.name) }, async () => {
      await api.createProject(namespace.user_id, {
        name: values.name.trim(),
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        ...(values.ai_provider ? { ai_provider: values.ai_provider } : {}),
        ...(values.ai_model ? { ai_model: values.ai_model } : {}),
      });

      setNotice('Project created.');
      setValues((current) => ({ ...current, name: '', description: '' }));
      await loadProjects();
    });
  }

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: paths.namespaces() },
          { label: namespace.user_id },
        ]}
      />

      <h1>Projects</h1>
      <p className="lead">
        Projects in <span className="mono">{namespace.user_id}</span>. Each one holds
        its own AI provider settings and credentials.
      </p>

      {/*
        Namespace wide settings are reached from here rather than only from the
        organization settings page, because a personal namespace has no such
        page and would otherwise have no way to reach them at all.
      */}
      <div className="btn-row" style={{ marginBottom: '1.25rem' }}>
        <Link className="btn btn--ghost" to={paths.namespaceExportFormats(namespace.user_id)}>
          Export formats
        </Link>
        <Link className="btn btn--ghost" to={paths.namespaceAiSettings(namespace.user_id)}>
          AI settings
        </Link>
        <Link className="btn btn--primary" to={paths.namespaceChat(namespace.user_id)}>
          Ask the assistant
        </Link>
      </div>

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
            <PlatformFields
              providers={providers}
              provider={values.ai_provider}
              model={values.ai_model}
              onChange={(next) => setValues((current) => ({ ...current, ...next }))}
              hint={(selected) =>
                selected?.requires_network === false
                  ? 'Runs offline. No API key needed.'
                  : "Paid for by this account's keys for the platform, in AI settings."
              }
            />
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
                to={paths.project(namespace.user_id, project.id)}
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
