import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdadenailnapeskzacyt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkYWRlbmFpbG5hcGVza3phY3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzYyNDAsImV4cCI6MjA5MzU1MjI0MH0.RCYJXt6iyoRRRU_b7Ku_OeZIFtXLZGIKloVnSSvKddY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
