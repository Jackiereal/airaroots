import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { requireOrgRole } from '@/src/shared/utils/route-auth';
import AdminSidebar from '@/components/admin/AdminSidebar';

// /admin/* (currently just /admin/users) manages org membership and roles —
// requires org-staff status (manager+), not just "has some property_access
// grant" like the general dashboard/properties tree. A client-role user
// with one property grant should not reach org member management.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');
  const { error } = await requireOrgRole('manager');
  if (error) redirect('/client/dashboard');

  return (
    <div className="flex flex-col md:flex-row h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <AdminSidebar email={profile.email} />
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
