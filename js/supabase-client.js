/* ===================================================================
   CONEXIÓN A SUPABASE
   ---------------------------------------------------------------
   1. Crea un proyecto gratis en https://supabase.com
   2. Ve a Project Settings > API
   3. Copia "Project URL" y pégala en SUPABASE_URL
   4. Copia "anon public" key y pégala en SUPABASE_ANON_KEY
   ---------------------------------------------------------------
   IMPORTANTE: la "anon key" es pública y segura de exponer en el
   frontend — está diseñada para esto. NUNCA uses la "service_role"
   key aquí, esa sí debe mantenerse secreta.
=================================================================== */

const SUPABASE_URL = "https://akkuzsztdcseybbxhedb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra3V6c3p0ZGNzZXliYnhoZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTUwOTksImV4cCI6MjA5ODA3MTA5OX0.J-ng3VCmHaX-TOkh3kzPtW4L9ArkcPBJ2-uVD-x7w7g";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
