import { Route, Routes } from 'react-router';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { ProtectedRoute, PublicOnlyRoute } from './components/routing/ProtectedRoute.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx';
import { NamespacesPage } from './pages/NamespacesPage.jsx';
import { OrganizationCreatePage } from './pages/OrganizationCreatePage.jsx';
import { NamespaceSettingsPage } from './pages/NamespaceSettingsPage.jsx';
import { NamespaceMembersPage } from './pages/NamespaceMembersPage.jsx';
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
 * The protected paths carry no namespace segment, matching the agreed route
 * structure. Which namespace they act on comes from the active namespace held
 * in `AuthContext` and switched from the header.
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
          <Route path="/namespaces" element={<NamespacesPage />} />
          <Route path="/namespaces/organizations/new" element={<OrganizationCreatePage />} />
          <Route path="/namespaces/settings" element={<NamespaceSettingsPage />} />
          <Route path="/namespaces/settings/members" element={<NamespaceMembersPage />} />
          <Route path="/namespaces/projects" element={<ProjectsPage />} />
          <Route path="/namespaces/project/:projectId" element={<ProjectDetailPage />} />
          <Route
            path="/namespaces/project/:projectId/uploads"
            element={<ProjectUploadsPage />}
          />
          <Route
            path="/namespaces/project/:projectId/settings"
            element={<ProjectSettingsPage />}
          />
          <Route
            path="/namespaces/project/:projectId/file/:fileId"
            element={<TranslationEditorPage />}
          />
          <Route path="/settings" element={<AccountSettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
