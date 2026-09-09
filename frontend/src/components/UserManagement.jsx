import { useCallback, useEffect, useState } from 'react';
import { UserPlus, KeyRound, ShieldAlert, Copy, Check, History } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { COMPANY_DOMAIN, EMAIL_PLACEHOLDER, isCompanyEmail } from '../lib/org';

/**
 * Accounts, and the trail of what was done to them.
 *
 * Two things this screen is careful about, because the API is careful about
 * them and a UI that implies otherwise would be lying:
 *
 *   - No password is ever displayed for an existing account. There is nothing
 *     to display; only bcrypt hashes are stored. A reset issues a NEW one-time
 *     password, shown once, right here.
 *   - Roles at or above your own are not offered. The API refuses them anyway,
 *     so showing them would only produce a 403 the operator cannot act on.
 */

const RANK = {
  VIEWER: 1, DATA_PROCESSOR: 2, ADMIN: 3, CCO: 4, CEO: 5, DEVELOPER: 6,
};
const ROLES = ['VIEWER', 'DATA_PROCESSOR', 'ADMIN', 'CCO', 'CEO', 'DEVELOPER'];

const ROLE_STYLE = {
  DEVELOPER: 'text-[var(--dup)]',
  CEO: 'text-[var(--warn)]',
  CCO: 'text-[var(--warn)]',
  ADMIN: 'text-[var(--accent)]',
  DATA_PROCESSOR: 'text-[var(--text-2)]',
  VIEWER: 'text-[var(--text-3)]',
};

function grantable(myRole) {
  // Mirrors UserRole.outranks: strictly below your own level.
  return ROLES.filter((r) => RANK[r] < (RANK[myRole] || 0));
}

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: '', full_name: '', password: '', role: 'DATA_PROCESSOR',
  });

  const canGrant = grantable(currentUser?.role);
  const isExecutive = ['DEVELOPER', 'CEO', 'CCO'].includes(currentUser?.role);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/users');
      if (res.ok) setUsers(await res.json());
    } catch { /* surfaced by the error banner on the next action */ }
    if (!isExecutive) return;
    try {
      const res = await apiFetch('/api/auth/audit?limit=50');
      if (res.ok) setAudit(await res.json());
    } catch { /* audit is supplementary; its absence must not blank the page */ }
  }, [isExecutive]);

  useEffect(() => { load(); }, [load]);

  async function createUser(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/users', {
        method: 'POST', body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Could not create the account.');
      // Shown once: they must hand this over, and it is not recoverable later.
      setTempPassword({ email: form.email, password: form.password });
      setForm({ email: '', full_name: '', password: '', role: 'DATA_PROCESSOR' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function resetPassword(user) {
    setError(null);
    try {
      const res = await apiFetch(`/api/auth/users/${user.id}/reset-password`,
                                 { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Could not reset the password.');
      setTempPassword({ email: body.email, password: body.temporary_password });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setActive(user, is_active) {
    setError(null);
    try {
      const res = await apiFetch(`/api/auth/users/${user.id}`, {
        method: 'PUT', body: JSON.stringify({ is_active }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not update the account.');
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--text)]">Team Accounts</h2>
        <p className="text-xs text-[var(--text-3)] font-medium">
          You can manage people below your own level. Passwords are never
          visible — a reset issues a new one-time password.
        </p>
      </div>

      {error && <p role="alert" className="text-xs font-semibold text-[var(--bad)]">{error}</p>}

      {tempPassword && (
        <div className="panel rounded-lg p-4 space-y-2 border border-amber-300/70">
          <span className="text-[10px] font-mono font-semibold text-[var(--warn)] flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
            SHOWN ONCE — HAND THIS TO {tempPassword.email}
          </span>
          <div className="flex items-center gap-2">
            <code className="field rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] flex-1 break-all">
              {tempPassword.password}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(tempPassword.password);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="btn p-2 text-[var(--text-2)]"
              aria-label="Copy password"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-3)]">
            They must replace it at first sign-in. It cannot be shown again —
            issue another reset if it is lost.
          </p>
          <button
            onClick={() => setTempPassword(null)}
            className="text-[11px] font-semibold text-[var(--text-3)] hover:text-[var(--text)]"
          >
            Done, hide it
          </button>
        </div>
      )}

      {canGrant.length > 0 && (
        <form onSubmit={createUser}
              className="panel rounded-lg p-4 grid gap-2 sm:grid-cols-5 items-end">
          <label className="sm:col-span-1">
            <span className="text-[10px] font-mono text-[var(--text-3)] font-semibold">NAME</span>
            <input required value={form.full_name}
                   onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                   className="field rounded-lg px-2 py-1.5 mt-1 w-full text-xs focus:outline-none" />
          </label>
          <label className="sm:col-span-1">
            <span className="text-[10px] font-mono text-[var(--text-3)] font-semibold">EMAIL</span>
            <input required type="email" value={form.email}
                   placeholder={EMAIL_PLACEHOLDER}
                   onChange={(e) => setForm({ ...form, email: e.target.value })}
                   className="field rounded-lg px-2 py-1.5 mt-1 w-full text-xs focus:outline-none" />
            {/* A hint, not a block: an outside address may be deliberate (a
                contractor, an auditor), and the UI should not decide that. */}
            {form.email && !isCompanyEmail(form.email) && (
              <span className="text-[10px] text-[var(--warn)]">
                Not a @{COMPANY_DOMAIN} address
              </span>
            )}
          </label>
          <label className="sm:col-span-1">
            <span className="text-[10px] font-mono text-[var(--text-3)] font-semibold">STARTING PASSWORD</span>
            <input required minLength={10} value={form.password}
                   onChange={(e) => setForm({ ...form, password: e.target.value })}
                   className="field rounded-lg px-2 py-1.5 mt-1 w-full text-xs focus:outline-none" />
          </label>
          <label className="sm:col-span-1">
            <span className="text-[10px] font-mono text-[var(--text-3)] font-semibold">ROLE</span>
            <select value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="field rounded-lg px-2 py-1.5 mt-1 w-full text-xs focus:outline-none">
              {canGrant.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={creating}
                  className="btn-primary px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {users.map((u) => {
          const mine = u.id === currentUser?.id;
          const canManage = (RANK[currentUser?.role] || 0) > (RANK[u.role] || 0);
          return (
            <li key={u.id} className="panel rounded-lg p-3.5 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[var(--text)] truncate">
                  {u.full_name} {mine && <span className="text-[10px] text-[var(--text-3)]">(you)</span>}
                </div>
                <div className="text-xs text-[var(--text-3)] truncate">{u.email}</div>
              </div>

              <span className={`text-[10px] font-mono font-semibold ${ROLE_STYLE[u.role] || 'text-[var(--text-2)]'}`}>
                {u.role.replace(/_/g, ' ')}
              </span>

              {u.must_change_password && (
                <span className="text-[10px] font-mono font-semibold text-[var(--warn)]">
                  AWAITING PASSWORD CHANGE
                </span>
              )}
              {!u.is_active && (
                <span className="text-[10px] font-mono font-semibold text-[var(--bad)]">DISABLED</span>
              )}

              {canManage && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => resetPassword(u)}
                          className="btn px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] flex items-center gap-1">
                    <KeyRound className="w-3 h-3" aria-hidden="true" />
                    Reset password
                  </button>
                  <button onClick={() => setActive(u, !u.is_active)}
                          className="btn px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)]">
                    {u.is_active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isExecutive && audit.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-1.5">
            <History className="w-4 h-4" aria-hidden="true" />
            Account activity
          </h3>
          <p className="text-[11px] text-[var(--text-3)]">
            Every account action, including those taken by accounts that do not
            appear in the list above.
          </p>
          <ul className="panel rounded-lg p-3 space-y-1 max-h-72 overflow-y-auto">
            {audit.map((a, i) => (
              <li key={i} className="text-[11px] font-mono flex flex-wrap gap-x-2 text-[var(--text-2)]">
                <span className="text-[var(--text-3)]">{a.at?.slice(0, 16).replace('T', ' ')}</span>
                <span className={`font-semibold ${ROLE_STYLE[a.actor_role] || ''}`}>{a.actor}</span>
                <span className="font-semibold text-[var(--text)]">{a.action}</span>
                {a.target && <span>→ {a.target}</span>}
                {a.detail && <span className="text-[var(--text-3)]">({a.detail})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
