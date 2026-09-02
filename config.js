// ============================================================================
// Configuración de conexión a Supabase
// ============================================================================
// Pega aquí la URL de tu proyecto y la clave pública ("anon key"). Las
// encuentras en tu proyecto de Supabase → Settings → API. La "anon key" es
// pública a propósito (viaja dentro del código de esta página) — la
// seguridad real la dan las políticas del archivo supabase-schema.sql, no
// el secreto de esta clave. Nunca pegues aquí la "service_role key": esa sí
// es secreta y jamás debe estar en una página que corre en el navegador.
//
// Ver SETUP.md para el paso a paso completo.
// ============================================================================

window.ETED_CONFIG = {
  SUPABASE_URL: "https://jkpgodeffvatvoxqgvtd.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprcGdvZGVmZnZhdHZveHFndnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNTg1NTYsImV4cCI6MjEwMzkzNDU1Nn0.bsd97O09sVyJbgCxDN-DefzBaPr7LXpg_lb2ngfktkU"
};
