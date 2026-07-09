import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function PropertiesLayout({ children }: { children: React.ReactNode }) {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');
  if (profile.role !== 'admin') redirect('/client/dashboard');

  return (
    <div className="flex flex-col md:flex-row h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <AdminSidebar email={profile.email} />
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
