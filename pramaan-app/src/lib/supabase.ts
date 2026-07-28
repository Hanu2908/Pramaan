import { createClient } from '@supabase/supabase-js';

// We are hardcoding the URL and Anon Key for the demo build
// Usually these go in .env.local
const supabaseUrl = 'https://isqdqjubveytsvzyusyq.supabase.co';
const supabaseAnonKey = 'sb_publishable_yAxJAoH9VR0gU7A-ITZCxw_QCAhY8nH'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
