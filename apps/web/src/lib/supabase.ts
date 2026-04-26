import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] as string;
const supabasePublishableKey = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Parse email confirmation / password recovery tokens from the URL hash on load.
    detectSessionInUrl: true,
  },
});

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
