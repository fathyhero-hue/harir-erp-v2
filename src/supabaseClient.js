import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://evdscoxotnhwynqwlchy.supabase.co';
const supabaseAnonKey = 'sb_publishable_BOg-a3v7A_WQn9BnaoEVuA_33Bx6Jnh';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);