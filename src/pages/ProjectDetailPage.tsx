import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useNamespace } from '../components/routing/NamespaceRoute.tsx';
import { paths } from '../lib/paths.ts';
import { api } from '../lib/apiClient.ts';
import type { ProjectFile } from '../lib/types.ts';
import { useLoader } from '../hooks/useLoader.ts';
import {
  Callout,
  EmptyState,
  ErrorMessage,
  LoadingState,
  StatusBadge,
} from '../components/ui/Feedback.tsx';
import { Breadcrumbs } from '../components/layout/AppLayout.tsx';

/** How often to re-check a file that is still being processed. */
const POLL_INTERVAL_MS = 2000;

/**
 * Project detail: the files belonging to a project.
 *
 * Files are polled while any of them is still processing, because the pipeline
 * runs on the server after the upload responds. Polling stops as soon as
 * everything reaches a terminal state, so an idle page makes no requests.
 *
 * @returns The page.
 */
export function ProjectDetailPage() {
  // The route pattern names the segment, so it is always present here.
  const { projectId } = useParams() as { projectId: string };
  const namespace = useNamespace();
  const ns = namespace.user_id;

  /* The project and its files load together. */
  const { data, isLoading, error: loadError, reload: load } = useLoader(async () => {
    const [{ project }, filesResult] = await Promise.all([
      api.getProject(projectId),
      api.listFiles(projectId),
    ]);
    return { project, files: filesResult.files ?? [] };
  }, [projectId]);
  const project = data?.project ?? null;
  const files = data?.files ?? [];
  const [actionError, setActionError] = useState<Error | null>(null);

  // Held in a ref so the polling effect does not restart on every file change.
  const hasPendingWork = useRef(false);
  hasPendingWork.current = files.some(
    (file) => file.status === 'PENDING' || file.status === 'PROCESSING',
  );

  /* Poll only while something is still being processed. */
  useEffect(() => {
    const timer = setInterval(() => {
      if (hasPendingWork.current) load({ quiet: true });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [load]);

  /**
   * Deletes a file after confirmation.
   *
   * @param file File record.
   */
  async function handleDelete(file: ProjectFile): Promise<void> {
    if (!window.confirm(`Delete ${file.filename} and all of its translations?`)) return;

    setActionError(null);
    try {
      await api.deleteFile(file.id);
      await load();
    } catch (error) {
      setActionError(error as Error);
    }
  }

  /**
   * Re-runs the pipeline for a file.
   *
   * @param file File record.
   */
  async function handleReprocess(file: ProjectFile): Promise<void> {
    setActionError(null);
    try {
      await api.reprocessFile(file.id);
      await load({ quiet: true });
    } catch (error) {
      setActionError(error as Error);
    }
  }

  if (isLoading) {
    return (
      <div className="container">
        <LoadingState label="Loading project" />
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

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: paths.namespaces() },
          { label: ns, to: paths.namespace(ns) },
          { label: project?.name ?? 'Project' },
        ]}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>{project?.name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {project?.description || 'No description'}
          </p>
        </div>
        <div className="btn-row">
          <Link className="btn btn--primary" to={paths.projectUploads(ns, projectId)}>
            Upload file
          </Link>
          <Link className="btn" to={paths.projectSettings(ns, projectId)}>
            Settings
          </Link>
        </div>
      </div>

      <div className="chip-row" style={{ margin: '1rem 0 1.5rem' }}>
        <span className="badge badge--accent">{project?.ai_provider}</span>
        <span className="badge">{project?.ai_model}</span>
      </div>

      <ErrorMessage error={actionError} />

      <section className="panel">
        <div className="panel__header">
          <h2>Translation files</h2>
          <span className="badge badge--accent">{files.length}</span>
        </div>

        {files.length === 0 ? (
          <EmptyState title="No files uploaded yet.">
            <p className="muted">
              Upload a JSON locale file to start translating.
            </p>
            <Link className="btn btn--primary" to={paths.projectUploads(ns, projectId)}>
              Upload your first file
            </Link>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Translation files in this project</caption>
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Source</th>
                  <th scope="col">Targets</th>
                  <th scope="col">Keys</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <Link to={paths.projectFile(ns, projectId, file.id)}>
                        <strong>{file.filename}</strong>
                      </Link>
                      {file.error_message ? (
                        <>
                          <br />
                          <span className="field__error">{file.error_message}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="mono">{file.source_lang_code}</td>
                    <td>
                      <div className="chip-row">
                        {file.target_lang_codes.map((code) => (
                          <span key={code} className="badge">
                            {code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{file.key_count}</td>
                    <td>
                      <StatusBadge status={file.status} />
                    </td>
                    <td>
                      <div className="btn-row">
                        {file.status === 'READY' ? (
                          <Link
                            className="btn btn--small"
                            to={paths.projectFile(ns, projectId, file.id)}
                          >
                            Edit
                          </Link>
                        ) : null}
                        {file.status === 'FAILED' ? (
                          <button
                            type="button"
                            className="btn btn--small"
                            onClick={() => handleReprocess(file)}
                          >
                            Retry
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn--small btn--danger"
                          onClick={() => handleDelete(file)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasPendingWork.current ? (
          <Callout tone="info">
            <span className="spinner" aria-hidden="true" /> Some files are still being
            translated. This list refreshes automatically.
          </Callout>
        ) : null}
      </section>
    </div>
  );
}
