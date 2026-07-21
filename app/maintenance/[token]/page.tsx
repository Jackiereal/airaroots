import { notFound } from 'next/navigation';
import { MaintenanceVendorClient } from './MaintenanceVendorClient';

async function getRequest(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/maintenance/token/${token}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function MaintenanceTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getRequest(token);
  if (!data) notFound();

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-6 flex items-center gap-2">
          <span className="font-bold text-lg font-[family-name:var(--font-rajdhani)] text-[var(--accent)]">
            Hostezy
          </span>
          <span className="text-[var(--text-tertiary)] text-sm">· Maintenance</span>
        </div>
        <MaintenanceVendorClient token={token} initialData={data} />
      </div>
    </div>
  );
}
