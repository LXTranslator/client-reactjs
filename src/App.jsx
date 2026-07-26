import { Route, Routes } from 'react-router';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { ProtectedRoute, PublicOnlyRoute } from './components/routing/ProtectedRoute.jsx';
import { NamespaceRoute } from './components/routing/NamespaceRoute.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx';
import { NamespacesPage } from './pages/NamespacesPage.jsx';
import { OrganizationCreatePage } from './pages/OrganizationCreatePage.jsx';
import { NamespaceSettingsPage } from './pages/NamespaceSettingsPage.jsx';
import { NamespaceMembersPage } from './pages/NamespaceMembersPage.jsx';
import { NamespaceExportFormatsPage } from './pages/NamespaceExportFormatsPage.jsx';
import { NamespaceAiSettingsPage } from './pages/NamespaceAiSettingsPage.jsx';
import { ChatPage } from './pages/ChatPage.jsx';
import { ProjectsPage } from './pages/ProjectsPage.jsx';
import { ProjectDetailPage } from './pages/ProjectDetailPage.jsx';
import { ProjectUploadsPage } from './pages/ProjectUploadsPage.jsx';
import { ProjectSettingsPage } from './pages/ProjectSettingsPage.jsx';
import { TranslationEditorPage } from './pages/TranslationEditorPage.jsx';
import { AccountSettingsPage } from './pages/AccountSettingsPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

/**
 * Route table.
 *
 * Three groups:
 *
 *   - Public only: sign in and registration, which redirect away when a session
 *     already exists.
 *   - Protected: everything behind `ProtectedRoute`.
 *   - Always available: the root redirect and the not found fallback.
 *
 * A namespace occupies the first path segment, so `/orgA` is the organization
 * `orgA` and `/jetsada` is that person's namespace. Which namespace a page acts
 * on is therefore in the URL rather than in context, which makes every page
 * linkable and every link unambiguous.
 *
 * Order matters below. The fixed segments are declared before `/:namespace` so
 * they win; the server refuses to register an identifier matching one of them,
 * so no account can be shadowed by this.
 *
 * @returns {JSX.Element} The routes.
 */
export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />

        {/* Signed out only. */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/*
          Password recovery stays reachable in both states: a signed in visitor
          may still be completing a reset started elsewhere.
        */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Signed in only. */}
        <Route element={<ProtectedRoute />}>
          {/* Fixed segments, which belong to no single namespace. */}
          <Route path="/namespaces" element={<NamespacesPage />} />
          <Route path="/organizations/new" element={<OrganizationCreatePage />} />
          <Route path="/settings" element={<AccountSettingsPage />} />

          {/*
            Everything below acts inside the namespace named in the path.
            NamespaceRoute resolves it once for all of them, so no page repeats
            the lookup.
          */}
          <Route path="/:namespace" element={<NamespaceRoute />}>
            <Route index element={<ProjectsPage />} />
            <Route path="settings" element={<NamespaceSettingsPage />} />
            <Route path="settings/members" element={<NamespaceMembersPage />} />
            <Route path="settings/export_formats" element={<NamespaceExportFormatsPage />} />
            <Route path="settings/ai" element={<NamespaceAiSettingsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="project/:projectId" element={<ProjectDetailPage />} />
            <Route path="project/:projectId/uploads" element={<ProjectUploadsPage />} />
            <Route path="project/:projectId/settings" element={<ProjectSettingsPage />} />
            <Route path="project/:projectId/file/:fileId" element={<TranslationEditorPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
