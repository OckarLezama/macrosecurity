// Conexión a la base de datos compartida (Supabase).
// Mientras estos valores estén vacíos, la plataforma funciona en modo local (datos en este navegador).
// La "anon key" es pública por diseño: la seguridad la dan el inicio de sesión y las reglas por cliente.
window.MS_SUPABASE = {
  url: '',        // ej. https://abcdxyz.supabase.co
  anonKey: '',    // Project Settings → API → anon public
  cliente: 'puebla'
};
