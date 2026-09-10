import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, KeyRound, ShieldAlert, Copy, Check, History, Users, Shield } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { apiFetch } from '../lib/api';
import { humanize } from '../lib/labels';
import { COMPANY_DOMAIN, EMAIL_PLACEHOLDER, isCompanyEmail } from '../lib/org';

const RANK = {
  VIEWER: 1,
  DATA_PROCESSOR: 2,
  ADMIN: 3,
  CCO: 4,
  CEO: 5,
  DEVELOPER: 6,
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
    email: '',
    full_name: '',
    password: '',
    role: 'DATA_PROCESSOR',
  });

  const canGrant = grantable(currentUser?.role);
  const isExecutive = ['DEVELOPER', 'CEO', 'CCO'].includes(currentUser?.role);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/users');
      if (res.ok) setUsers(await res.json());
    } catch {
      /* surfaced on action */
    }
    if (!isExecutive) return;
    try {
      const res = await apiFetch('/api/auth/audit?limit=50');
      if (res.ok) setAudit(await res.json());
    } catch {
      /* supplementary */
    }
  }, [isExecutive]);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Could not create the account.');
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
      const res = await apiFetch(`/api/auth/users/${user.id}/reset-password`, {
        method: 'POST',
      });
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
        method: 'PUT',
        body: JSON.stringify({ is_active }),
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-[1520px] mx-auto animate-fade-in">
      <PageHeader
        title="Team accounts"
        description="Manage system users and access roles below your authorization level. Passwords are encrypted."
        actions={
          <div className="t-meta flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[var(--accent)]" />

            <span className="num text-[var(--text-2)]">{users.length}</span> members
          </div>
        }
      />

      {error && (
        <div className="p-3 rounded-[var(--r-md)] bg-[var(--bad-soft)] text-[var(--bad)] text-xs font-semibold border border-[var(--bad)]/30">
          {error}
        </div>
      )}

      {/* One-Time Password Reveal Card */}
      {tempPassword && (
        <div className="l2 p-4 space-y-3 border-[var(--warn)]/40 bg-[color-mix(in_srgb,var(--surface)_92%,var(--warn)_8%)]">
          <span className="text-[12.5px] font-medium text-[var(--warn)] flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            Shown once — give this to {tempPassword.email}
          </span>
          <div className="flex items-center gap-2">
            <code className="field px-3 py-2 text-[14px] font-mono text-[var(--text)] flex-1 break-all">
              {tempPassword.password}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(tempPassword.password);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="btn h-9 px-3 text-xs flex items-center gap-1.5"
              aria-label="Copy password"
            >
              {copied ? <Check className="w-4 h-4 text-[var(--ok)]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-3)]">
            They will be prompted to set a permanent password upon first sign in.
          </p>
          <button
            onClick={() => setTempPassword(null)}
            className="text-[11.5px] font-semibold text-[var(--text-2)] hover:text-[var(--text)] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New User Creation Bento Card */}
      {canGrant.length > 0 && (
        <div className="l2 p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-[var(--edge)] pb-2.5">
            <UserPlus className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="t-heading">
              Add a team member
            </h3>
          </div>

          <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-5 items-end pt-1">
            <label className="sm:col-span-1">
              <span className="t-label">Full name</span>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="field rounded-[var(--r-md)] px-3 h-8 mt-1 w-full text-xs focus:outline-none"
                placeholder="Full name"
              />
            </label>
            <label className="sm:col-span-1">
              <span className="t-label">Email</span>
              <input
                required
                type="email"
                value={form.email}
                placeholder={EMAIL_PLACEHOLDER}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="field rounded-[var(--r-md)] px-3 h-8 mt-1 w-full text-xs focus:outline-none"
              />
              {form.email && !isCompanyEmail(form.email) && (
                <span className="text-[10px] text-[var(--warn)] mt-0.5 block">
                  Not a @{COMPANY_DOMAIN} address
                </span>
              )}
            </label>
            <label className="sm:col-span-1">
              <span className="t-label">Starting password</span>
              <input
                required
                minLength={10}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="field rounded-[var(--r-md)] px-3 h-8 mt-1 w-full text-xs focus:outline-none"
                placeholder="Min 10 characters"
              />
            </label>
            <label className="sm:col-span-1">
              <span className="t-label">Role</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="field rounded-[var(--r-md)] px-2.5 h-8 mt-1 w-full text-xs focus:outline-none cursor-pointer"
              >
                {canGrant.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={creating}
              className="btn-primary h-8 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{creating ? 'Creating…' : 'Create Account'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Users List Bento Table */}
      <div className="l2 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--edge)] pb-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">
              Members
            </h3>
          </div>
        </div>

        <ul className="space-y-2">
          {users.map((u) => {
            const mine = u.id === currentUser?.id;
            const canManage = (RANK[currentUser?.role] || 0) > (RANK[u.role] || 0);
            return (
              <li
                key={u.id}
                className="p-3.5 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--edge)] flex flex-wrap items-center justify-between gap-3 hover:border-[var(--edge-strong)] transition-all"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-[7px] bg-[var(--accent-soft)] border border-[var(--accent-ring)] text-[11.5px] font-semibold flex items-center justify-center text-[var(--accent)] shrink-0">
                    {u.full_name?.slice(0, 2).toUpperCase() || 'U'}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-[var(--text)] truncate">
                      {u.full_name} {mine && <span className="text-[10px] text-[var(--text-3)] font-normal">(you)</span>}
                    </div>
                    <div className="text-[11px] text-[var(--text-3)] truncate">{u.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`badge badge-neutral ${
                      ROLE_STYLE[u.role] || 'text-[var(--text-2)]'
                    }`}
                  >
                    {humanize(u.role)}
                  </span>

                  {u.must_change_password && (
                    <span className="badge badge-warn">
                      Pending password
                    </span>
                  )}
                  {!u.is_active && (
                    <span className="badge badge-bad">
                      Disabled
                    </span>
                  )}

                  {canManage && (
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => resetPassword(u)}
                        className="btn h-7 px-2 text-[11px] font-semibold flex items-center gap-1 text-[var(--text-2)]"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Reset PW</span>
                      </button>
                      <button
                        onClick={() => setActive(u, !u.is_active)}
                        className={`btn h-7 px-2.5 text-[11px] font-semibold ${
                          u.is_active ? 'hover:text-[var(--bad)]' : 'text-[var(--ok)]'
                        }`}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Executive Activity Audit Trail */}
      {isExecutive && audit.length > 0 && (
        <div className="l2 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--edge)] pb-2.5">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Security & Account Activity Audit Trail
              </h3>
            </div>
            <span className="t-meta">Last 50 events</span>
          </div>

          <ul className="p-3 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--edge)] space-y-1.5 max-h-72 overflow-y-auto">
            {audit.map((a, i) => (
              <li
                key={i}
                className="text-[11px] font-mono flex flex-wrap items-center gap-x-2 text-[var(--text-2)] py-0.5"
              >
                <span className="text-[var(--text-3)]">
                  {a.at?.slice(0, 16).replace('T', ' ')}
                </span>
                <span className={`font-bold ${ROLE_STYLE[a.actor_role] || ''}`}>{a.actor}</span>
                <span className="font-semibold text-[var(--text)]">{a.action}</span>
                {a.target && <span className="text-[var(--accent)]">→ {a.target}</span>}
                {a.detail && <span className="text-[var(--text-3)]">({a.detail})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
