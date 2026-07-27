import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getOrgPlan } from '@/src/domains/billing/org-plan';
import OnboardingWizard from './OnboardingWizard';

export default async function OnboardingPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  const organizationId = (profile as unknown as { organization_id?: string }).organization_id;
  let trialEndsAt: string | null = null;
  if (organizationId) {
    const db = createServiceRoleClient();
    const orgPlan = await getOrgPlan(db, organizationId);
    if (orgPlan?.subscription_status === 'trialing') {
      trialEndsAt = orgPlan.trial_ends_at;
    }
  }

  return <OnboardingWizard trialEndsAt={trialEndsAt} />;
}
