/**
 * Endereço e chave pública do Supabase (.env.example). A chave anônima
 * respeita RLS e pode ir ao navegador; a service_role nunca passa por aqui
 * (cliente-servico.ts, só servidor).
 */
export interface ConfiguracaoSupabase {
  url: string;
  chaveAnonima: string;
}

export function configuracaoSupabase(): ConfiguracaoSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveAnonima = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chaveAnonima) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Preencha a partir do cofre (.env.example) ou, nesta máquina sem Supabase, " +
        "rode com KZ_DADOS=demonstracao em desenvolvimento.",
    );
  }
  return { url, chaveAnonima };
}
