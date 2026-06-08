import { createClient } from '@supabase/supabase-js';

// Carrega as credenciais a partir das variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Realiza login administrativo no Supabase Auth.
 */
export async function signIn(email, password) {
  if (!supabase) {
    throw new Error('Supabase não configurado. Por favor, adicione as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ao seu arquivo .env');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Realiza logout da sessão administrativa.
 */
export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Retorna a sessão ativa atual no navegador.
 */
export async function getSession() {
  if (!supabase) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

/**
 * Realiza testes de consulta às tabelas do banco e ao storage do Supabase.
 */
export async function testSupabaseConnection() {
  console.log('--- TESTANDO CONEXÃO COM SUPABASE ---');
  if (!supabase) {
    console.error('Erro: Cliente Supabase não inicializado. Verifique as variáveis de ambiente.');
    return false;
  }
  
  let success = true;

  // 1. Testar tabela albums
  try {
    const { data, error } = await supabase.from('albums').select('id, title').limit(5);
    if (error) throw error;
    console.log('✅ Sucesso: Tabela "albums" acessível. Registros:', data);
  } catch (err) {
    console.error('❌ Erro ao ler tabela "albums":', err.message || err);
    success = false;
  }

  // 2. Testar tabela photos
  try {
    const { data, error } = await supabase.from('photos').select('id, name').limit(5);
    if (error) throw error;
    console.log('✅ Sucesso: Tabela "photos" acessível. Registros:', data);
  } catch (err) {
    console.error('❌ Erro ao ler tabela "photos":', err.message || err);
    success = false;
  }

  // 3. Testar tabela admin_logs
  try {
    const { data, error } = await supabase.from('admin_logs').select('id, action').limit(5);
    if (error) {
      if (error.code === '42501') {
        console.log('🛡️ Segurança OK: Tabela "admin_logs" protegida contra acessos públicos anônimos (Código esperado 42501).');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Sucesso: Tabela "admin_logs" acessível. Registros:', data);
    }
  } catch (err) {
    console.error('❌ Erro ao ler tabela "admin_logs":', err.message || err);
    success = false;
  }


  // 4. Testar Storage
  try {
    const { data, error } = await supabase.storage.from('photos').list('', { limit: 5 });
    if (error) throw error;
    console.log('✅ Sucesso: Storage "photos" acessível. Arquivos:', data);
  } catch (err) {
    console.error('❌ Erro ao ler bucket "photos":', err.message || err);
    success = false;
  }

  console.log('--- FIM DO TESTE ---');
  return success;
}

if (typeof window !== 'undefined') {
  window.testSupabaseConnection = testSupabaseConnection;
}
