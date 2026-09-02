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
  SUPABASE_URL: "PEGA_AQUI_LA_URL_DE_TU_PROYECTO",
  SUPABASE_ANON_KEY: "PEGA_AQUI_TU_ANON_KEY"
};
