// Varredura de segredo para os JSON gerados e para `n8n/referencia/`
// (PRD 19.5: "nenhum segredo, token, JWT, telefone ou service_role nos
// JSON"; P23 item 3: "varredura de segredos em n8n/dist e n8n/referencia").
//
// Cada verificador devolve a lista de trechos encontrados (vazia quando não
// acha nada), para a mensagem de falha do teste apontar exatamente o que
// bateu, sem expor o texto inteiro do arquivo.

const PADRAO_JWT = /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g;
const PADRAO_OPENAI_KEY = /\bsk-[A-Za-z0-9_-]{20,}\b/g;
// Telefone brasileiro em E.164: "+55" + DDD (2) + número (8 ou 9), sem mais
// dígitos colados. Não pega jid de grupo do WhatsApp (não tem "+" e termina
// em "@g.us"/"@s.whatsapp.net"/"@lid").
const PADRAO_TELEFONE_E164 = /(?<!\d)\+55\d{10,11}(?!\d)/g;
const PADRAO_SERVICE_ROLE = /service_role/g;
const PADRAO_SUPABASE_API_CRED = /supabaseApi/g;

function encontrarTodos(texto, regex) {
  return [...texto.matchAll(regex)].map((match) => match[0]);
}

export function acharSegredos(texto) {
  return {
    jwt: encontrarTodos(texto, PADRAO_JWT),
    chaveOpenAi: encontrarTodos(texto, PADRAO_OPENAI_KEY),
    telefone: encontrarTodos(texto, PADRAO_TELEFONE_E164),
    serviceRole: encontrarTodos(texto, PADRAO_SERVICE_ROLE),
    credencialSupabaseApi: encontrarTodos(texto, PADRAO_SUPABASE_API_CRED),
  };
}

export function temAlgumSegredo(texto) {
  const achados = acharSegredos(texto);
  return Object.values(achados).some((lista) => lista.length > 0);
}

export function resumoDosAchados(achados) {
  return Object.entries(achados)
    .filter(([, lista]) => lista.length > 0)
    .map(([tipo, lista]) => `${tipo}: ${lista.join(', ')}`)
    .join(' | ');
}
