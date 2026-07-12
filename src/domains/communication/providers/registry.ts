import type { SupabaseClient } from '@supabase/supabase-js';
import type { Channel } from '../types';
import type { ProviderAdapter } from './types';
import { waLinkAdapter } from './wa-link.adapter';
import { emailAdapter } from './email.adapter';

// Resolves which adapter an org uses for a channel. This is the BYOP seam:
// today it returns the free defaults (wa.me link for whatsapp, stubbed
// email), but it takes the org id + client so a later slice can look up
// org_notification_providers and return a credential-backed adapter without
// touching the Notification Service.
export async function getAdapter(
  _supabase: SupabaseClient,
  _organizationId: string,
  channel: Channel
): Promise<ProviderAdapter | null> {
  switch (channel) {
    case 'whatsapp':
      return waLinkAdapter;
    case 'email':
      return emailAdapter;
    // sms / push have no adapter yet.
    default:
      return null;
  }
}
