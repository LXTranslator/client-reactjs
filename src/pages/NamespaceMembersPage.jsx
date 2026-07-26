import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/apiClient.js';
import { SelectField, TextField } from '../components/ui/FormField.jsx';
import {
  Callout,
  EmptyState,
  ErrorMessage,
  LoadingState,
} from '../components/ui/Feedback.jsx';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import { PLACEHOLDERS } from '../lib/validation.js';

/** Roles offered in the interface, most privileged first. */
const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner: full control, including members' },
  { value: 'ADMIN', label: 'Admin: manage projects and members' },
  { value: 'MEMBER', label: 'Member: read only access' },
];

/**
 * Organization member management.
 *
 * The interface offers every role, but the server caps what any caller may
 * actually grant at their own rank. A refused promotion surfaces as an error
 * rather than being hidden, since hiding it would leave a user confused about
 * why an option existed.
 *
 * @returns {JSX.Element} The page.
 */
export function NamespaceMembersPage() {
  const { activeNamespace, account } = useAuth();

  const [members, setMembers] = useState([]);
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOrganization = activeNamespace?.type === 'ORG';

  /**
   * Loads the membership list.
   *
   * @returns {Promise<void>}
   */
  const loadMembers = useCallback(async () => {
    if (!activeNamespace || !isOrganization) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.listMembers(activeNamespace.user_id);
      setMembers(result.members ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [activeNamespace, isOrganization]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  /**
   * Invites an existing account into the organization.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleInvite(event) {
    event.preventDefault();
    setActionError(null);
    setNotice(null);

    if (identifier.trim().length === 0) {
      setActionError(new Error('Enter the user id or email address of the person to invite.'));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.addMember(activeNamespace.user_id, {
        identifier: identifier.trim().toLowerCase(),
        role,
      });
      setIdentifier('');
      setRole('MEMBER');
      setNotice('Member added.');
      await loadMembers();
    } catch (error) {
      setActionError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Changes a member's role.
   *
   * @param {string} memberId Membership identifier.
   * @param {string} nextRole New role.
   * @returns {Promise<void>}
   */
  async function handleRoleChange(memberId, nextRole) {
    setActionError(null);
    setNotice(null);
    try {
      await api.updateMember(activeNamespace.user_id, memberId, { role: nextRole });
      setNotice('Role updated.');
      await loadMembers();
    } catch (error) {
      setActionError(error);
      // Reload so the select snaps back to the role the server actually holds.
      await loadMembers();
    }
  }

  /**
   * Removes a member.
   *
   * @param {object} member Membership record.
   * @returns {Promise<void>}
   */
  async function handleRemove(member) {
    const name = member.member?.user_id ?? 'this member';
    // Removal cascades a person's access away, so it is confirmed first.
    if (!window.confirm(`Remove ${name} from this organization?`)) return;

    setActionError(null);
    setNotice(null);
    try {
      await api.removeMember(activeNamespace.user_id, member.id);
      setNotice('Member removed.');
      await loadMembers();
    } catch (error) {
      setActionError(error);
    }
  }

  if (!activeNamespace) {
    return (
      <div className="container">
        <LoadingState label="Loading namespace" />
      </div>
    );
  }

  if (!isOrganization) {
    return (
      <div className="container narrow">
        <Breadcrumbs
          items={[{ label: 'Namespaces', to: '/namespaces' }, { label: 'Members' }]}
        />
        <Callout tone="info" title="Personal namespace">
          Only organization namespaces have members. Create an organization from the{' '}
          <Link to="/namespaces">dashboard</Link> to collaborate with other people.
        </Callout>
      </div>
    );
  }

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: '/namespaces' },
          { label: activeNamespace.user_id },
          { label: 'Members' },
        ]}
      />

      <h1>Members</h1>
      <p className="lead">
        People who can act inside <span className="mono">{activeNamespace.user_id}</span>.
      </p>

      <ErrorMessage error={loadError} />
      <ErrorMessage error={actionError} />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <section className="panel">
        <div className="panel__header">
          <h2>Invite a member</h2>
        </div>

        <form onSubmit={handleInvite} noValidate>
          <div className="field-row">
            <TextField
              label="User id or email"
              name="identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={PLACEHOLDERS.memberIdentifier}
              hint="The person must already have an LXTranslator account."
              required
            />

            <SelectField
              label="Role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              options={ROLE_OPTIONS}
              hint="You cannot grant a role above your own."
            />
          </div>

          <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Adding' : 'Add member'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Current members</h2>
          <span className="badge badge--accent">{members.length}</span>
        </div>

        {isLoading ? (
          <LoadingState label="Loading members" />
        ) : members.length === 0 ? (
          <EmptyState title="No members yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Organization members and their roles</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Role</th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.member?.id === account?.id;
                  return (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.member?.display_name || member.member?.user_id}</strong>
                        <br />
                        <span className="mono muted">{member.member?.user_id}</span>
                        {isSelf ? (
                          <span className="badge badge--accent" style={{ marginLeft: '0.4rem' }}>
                            You
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <label className="visually-hidden" htmlFor={`role_${member.id}`}>
                          Role for {member.member?.user_id}
                        </label>
                        <select
                          id={`role_${member.id}`}
                          className="field__control"
                          style={{ width: 'auto', padding: '0.3rem 0.5rem' }}
                          value={member.role}
                          onChange={(event) => handleRoleChange(member.id, event.target.value)}
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.value}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="muted">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--small btn--danger"
                          onClick={() => handleRemove(member)}
                        >
                          {isSelf ? 'Leave' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
