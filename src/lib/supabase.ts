import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zrzfymsbcywxwdjhgcyj.supabase.co";
const supabaseAnonKey =
  "sb_publishable_CFBXlS-VjSWTTdzRhcEnhg_TCp9aHrD";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});
