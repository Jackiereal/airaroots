import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');
  if (profile.role !== 'admin') redirect('/client/dashboard');

  return (
    <div className="flex h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <AdminSidebar email={profile.email} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
