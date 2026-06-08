import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

let supabaseUrl = '';
let supabaseAnonKey = '';

try {
  const envContent = readFileSync('.env', 'utf-8');
  const lines = envContent.split(/\r?\n/);
  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key === 'VITE_SUPABASE_URL') {
        supabaseUrl = val;
      }
      if (key === 'VITE_SUPABASE_ANON_KEY' || key === 'VITE_SUPABASE_PUBLISHABLE_KEY') {
        supabaseAnonKey = val;
      }
    }
  }
} catch (e) {
  console.error('Falha ao ler arquivo .env:', e.message);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erro: Credenciais não encontradas no arquivo .env.');
  process.exit(1);
}

console.log('Testando conexão com Supabase...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey.substring(0, 15) + '...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  let success = true;

  try {
    const { data, error } = await supabase.from('albums').select('id, title').limit(5);
    if (error) throw error;
    console.log('✅ Tabela albums acessível:', data);
  } catch (err) {
    console.error('❌ Erro na tabela albums:', err.message || err);
    success = false;
  }

  try {
    const { data, error } = await supabase.from('photos').select('id, name').limit(5);
    if (error) throw error;
    console.log('✅ Tabela photos acessível:', data);
  } catch (err) {
    console.error('❌ Erro na tabela photos:', err.message || err);
    success = false;
  }

  try {
    const { data, error } = await supabase.from('admin_logs').select('id, action').limit(5);
    if (error) throw error;
    console.log('✅ Tabela admin_logs acessível:', data);
  } catch (err) {
    console.error('❌ Erro na tabela admin_logs:', err.message || err);
    success = false;
  }

  try {
    const { data, error } = await supabase.storage.from('photos').list('', { limit: 5 });
    if (error) throw error;
    console.log('✅ Storage photos acessível:', data);
  } catch (err) {
    console.error('❌ Erro no Storage photos:', err.message || err);
    success = false;
  }

  if (success) {
    console.log('🎉 Tudo ok! Conexão funcionando 100%');
    process.exit(0);
  } else {
    console.log('⚠️ Conexão apresentou problemas em algumas consultas.');
    process.exit(1);
  }
}

runTest();
