'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, User, Plus, X, ChevronDown, ChevronRight, Copy, Check, Link2 } from 'lucide-react';
import Picker from '@/components/ui/Picker';

type OrgRole = 'owner' | 'admin' | 'manager' | 'viewer';
type UserProfile = { id: string; full_name: string | null; role: OrgRole };
type Property = { id: string; name: string };
type AccessEntry = { property_id: string; user_id: string; role: 'admin' | 'client' };
type Invite = { id: string; token: string; role: OrgRole; expires_at: string; used_at: string | null; created_at: string };

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'viewer', label: 'Viewer' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [access, setAccess] = useState<AccessEntry[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [grantPropertyId, setGrantPropertyId] = useState('');
  const [grantRole, setGrantRole] = useState<'admin' | 'client'>('client');
  const [inviteRole, setInviteRole] = useState<OrgRole>('viewer');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = async () => {
    const [uRes, pRes, aRes, iRes] = await Promise.all([
      fetch('/api/admin/users').then((r) => r.json()),
      fetch('/api/properties').then((r) => r.json()),
      fetch('/api/admin/property-access').then((r) => r.json()),
      fetch('/api/org/invites').then((r) => r.json()),
    ]);
    setUsers(uRes.users ?? []);
    setProperties(pRes.properties ?? []);
    setAccess(aRes.access ?? []);
    setInvites(iRes.invites ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });
    await load();
  };

  const handleGrant = async (userId: string) => {
    if (!grantPropertyId) return;
    await fetch('/api/admin/property-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, propertyId: grantPropertyId, role: grantRole }),
    });
    setGrantPropertyId('');
    setGrantRole('client');
    await load();
  };

  const handleRevoke = async (userId: string, propertyId: string) => {
    await fetch('/api/admin/property-access', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, propertyId }),
    });
    await load();
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      await fetch('/api/org/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole }),
      });
      await load();
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 2000);
  };

  const userAccess = (userId: string) => access.filter((a) => a.user_id === userId);
  const activeInvites = invites.filter((i) => !i.used_at && new Date(i.expires_at) > new Date());

  if (loading) return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading…</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-fraunces)] text-[var(--text-primary)]">
        Users
      </h1>

      {/* Invite creation */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Invite a teammate</h2>
        <div className="flex items-center gap-2">
          <Picker
            value={inviteRole}
            onChange={(v) => setInviteRole(v as OrgRole)}
            options={ROLE_OPTIONS}
            className="flex-1"
          />
          <button
            type="button"
            onClick={handleCreateInvite}
            disabled={creatingInvite}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50 shrink-0"
          >
            <Link2 className="h-3.5 w-3.5" /> Generate link
          </button>
        </div>

        {activeInvites.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {activeInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    {ROLE_OPTIONS.find((r) => r.value === inv.role)?.label ?? inv.role}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyInviteLink(inv.token)}
                  className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] shrink-0"
                >
                  {copiedToken === inv.token ? (
                    <><Check className="h-3 w-3" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy link</>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Org members */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
        {users.map((u, i) => {
          const grants = userAccess(u.id);
          const isExpanded = selectedUser === u.id;
          return (
            <div key={u.id} className={i > 0 ? 'border-t border-[var(--border-color)]' : ''}>
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
                onClick={() => setSelectedUser(isExpanded ? null : u.id)}
              >
                <div className="h-8 w-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center shrink-0">
                  {u.role === 'owner' || u.role === 'admin' ? (
                    <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                  ) : (
                    <User className="h-4 w-4 text-[var(--text-secondary)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {u.full_name || u.id}
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Picker
                    value={u.role}
                    onChange={(v) => handleRoleChange(u.id, v)}
                    options={ROLE_OPTIONS}
                    size="compact"
                  />
                </div>
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />}
              </div>

              {isExpanded && (
                <div className="border-t border-[var(--border-color)] bg-[var(--bg-elevated)]/50 px-4 py-3 space-y-2">
                  <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                    Property Access
                  </p>
                  {grants.length === 0 ? (
                    <p className="text-xs text-[var(--text-tertiary)]">No properties assigned.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {grants.map((g) => {
                        const prop = properties.find((p) => p.id === g.property_id);
                        return (
                          <span
                            key={g.property_id}
                            className="flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
                          >
                            {prop?.name ?? g.property_id}
                            <span className="text-[10px] text-[var(--text-tertiary)]">({g.role})</span>
                            <button
                              type="button"
                              onClick={() => handleRevoke(u.id, g.property_id)}
                              className="text-[var(--text-tertiary)] hover:text-rose-400"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Picker
                      value={grantPropertyId}
                      onChange={setGrantPropertyId}
                      options={properties
                        .filter((p) => !grants.find((g) => g.property_id === p.id))
                        .map((p) => ({ value: p.id, label: p.name }))}
                      placeholder="— add property access —"
                      className="flex-1"
                      searchable
                    />
                    <Picker
                      value={grantRole}
                      onChange={(v) => setGrantRole(v as 'admin' | 'client')}
                      options={[
                        { value: 'client', label: 'Client (read)' },
                        { value: 'admin', label: 'Admin (write)' },
                      ]}
                      size="compact"
                    />
                    <button
                      type="button"
                      onClick={() => handleGrant(u.id)}
                      disabled={!grantPropertyId}
                      className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50 shrink-0"
                    >
                      <Plus className="h-3 w-3" /> Grant
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
