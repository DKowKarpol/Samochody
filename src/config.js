import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://ikawguwgxriuszbqfwbq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_NTnRxAE3VFBLh9zlqVM4wQ_SIXXBWZ6";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);