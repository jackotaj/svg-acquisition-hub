/**
 * Curb Direct Supabase client — connects to the Curb platform DB.
 * Used for all shared data (appointments, sellers, leads, users).
 * SVG tenant ID is hardcoded since this app is single-tenant for SVG Motors.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SVG_TENANT_ID = '00000000-0000-0000-0000-000000001001';

let _curbAdmin: SupabaseClient | null = null;

export function getCurbSupabase(): SupabaseClient {
  if (!_curbAdmin) {
    const url = process.env.CURB_SUPABASE_URL;
    const key = process.env.CURB_SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error('CURB_SUPABASE_URL and CURB_SUPABASE_SERVICE_KEY must be set');
    }
    _curbAdmin = createClient(url, key);
  }
  return _curbAdmin;
}
