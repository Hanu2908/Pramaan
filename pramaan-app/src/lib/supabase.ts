import { createClient } from '@supabase/supabase-js';

// We are hardcoding the URL and Anon Key for the demo build
// Usually these go in .env.local
const supabaseUrl = 'https://isqdqjubveytsvzyusyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcWRxanVidmV5dHN2enl1c3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTc4MzAsImV4cCI6MjEwMDc3MzgzMH0.NyD06h8j84FiWl00Cn0RAiIWnGEZzWt0N7k_iOPgK7k'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
