import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://svqwesxzdmbbevxjzveo.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_-NhY37Y5Znl_eOM_Ov_nTw_KvPXUXUf";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
