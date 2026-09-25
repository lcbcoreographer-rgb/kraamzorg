// Nó 3 "Extrair Dados" do fluxo 3 (PRD 19.4). Função pura: recebe o corpo do
// webhook da UAZAPI e devolve os campos que o fluxo usa. O build embute este
// arquivo (com a máscara de documentos) no nó Code; os testes importam a
// mesma função.
//
// Regras:
// - `jid` (chatid) só serve para enviar; a chave de tudo é o `conversa_id`
//   que `agente.registrar_mensagem` devolve (CLAUDE.md, Apêndice A).
// - CPF e cartão saem mascarados já aqui, com a mesma regra de
//   `privado.mascarar_documentos` (PRD 11.11 item 6), antes do Redis, de
//   `mensagem` e da memória.
// - Grupo, broadcast e newsletter são marcados para o nó 4 ignorar.
// - Eco: mensagem nossa (`fromMe`) enviada pela API (`wasSentByApi`) ou com
//   o `track_source` do agente ou do app é ignorada no nó 6.
// - Toda foto, vídeo ou documento leva `midia = true` até o nó 24, com ou
//   sem legenda (PRD 19.4 nó 11, v4.2).
// - O token que a UAZAPI manda no corpo nunca é lido (PRD 11.10).

import { mascararDocumentos } from './mascarar-documentos.js';

// `track_source` dos envios da própria Kraamzorg: o do agente (PRD 19.1) e o
// do adaptador de mensageria do app (P18).
export const TRACK_SOURCES_PROPRIOS = ['kraamzorg-agente', 'kraamzorg-app'];

const TIPOS_MIDIA = ['imagem', 'video', 'documento'];

function textoOuVazio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function primeiroTexto(...valores) {
  for (const valor of valores) {
    const texto = textoOuVazio(valor);
    if (texto) return texto;
  }
  return '';
}

// Tipo da mensagem a partir de `mediaType` e `messageType` da UAZAPI.
export function tipoDaMensagem(mensagem = {}) {
  const candidatos = [mensagem.mediaType, mensagem.messageType, mensagem.type]
    .map((valor) => textoOuVazio(valor).toLowerCase())
    .filter(Boolean);
  for (const valor of candidatos) {
    if (valor.includes('reaction')) return 'reacao';
    if (valor.includes('sticker')) return 'figurinha';
    if (valor.includes('audio') || valor === 'ptt') return 'audio';
    if (valor.includes('image')) return 'imagem';
    if (valor.includes('video')) return 'video';
    if (valor.includes('document')) return 'documento';
    if (valor.includes('conversation') || valor.includes('extendedtext') || valor === 'text' || valor === 'chat') {
      return 'texto';
    }
  }
  return 'outro';
}

// Rota do nó 11 "Tipo de Mensagem": texto (e o que tiver texto), mídia,
// áudio; figurinha, reação e o resto sem texto param.
export function rotaDoTipo(tipo, texto) {
  if (tipo === 'audio') return 'audio';
  if (TIPOS_MIDIA.includes(tipo)) return 'midia';
  if (tipo === 'texto') return 'texto';
  if (tipo === 'outro' && texto) return 'texto';
  return 'ignorar';
}

function digitosDoJid(jid) {
  const casamento = /^(\d{10,15})@s\.whatsapp\.net$/.exec(textoOuVazio(jid));
  return casamento ? casamento[1] : '';
}

// Telefone em E.164 ("+" e dígitos). Em mensagem nossa (`fromMe`), quem
// envia é o número da Kraamzorg: o telefone da família vem do chat.
export function telefoneE164({ senderPn, telefoneChat, jid, fromMe }) {
  const opcoes = fromMe ? [telefoneChat, jid] : [senderPn, telefoneChat, jid];
  for (const opcao of opcoes) {
    const bruto = textoOuVazio(opcao);
    if (!bruto || bruto.endsWith('@lid') || bruto.endsWith('@g.us')) continue;
    const digitos = bruto.includes('@') ? digitosDoJid(bruto) : bruto.replace(/\D/g, '');
    if (digitos.length >= 10 && digitos.length <= 15) return `+${digitos}`;
  }
  return '';
}

export function ehJidDeGrupo(jid) {
  const valor = textoOuVazio(jid);
  return /@g\.us$/.test(valor) || /@broadcast$/.test(valor) || /@newsletter$/.test(valor);
}

export function extrairDadosMensagem(corpo = {}) {
  const mensagem = corpo && typeof corpo.message === 'object' && corpo.message ? corpo.message : {};
  const chat = corpo && typeof corpo.chat === 'object' && corpo.chat ? corpo.chat : {};

  const jid = primeiroTexto(mensagem.chatid, chat.wa_chatid);
  const lidBruto = primeiroTexto(mensagem.chatlid, chat.wa_chatlid, mensagem.sender_lid);
  const lid = lidBruto.endsWith('@lid') ? lidBruto : '';
  const fromMe = mensagem.fromMe === true;
  const tipo = tipoDaMensagem(mensagem);
  const conteudo = mensagem.content;
  const textoBruto = primeiroTexto(
    mensagem.text,
    typeof conteudo === 'string' ? conteudo : '',
    conteudo && typeof conteudo === 'object' ? conteudo.text : '',
    conteudo && typeof conteudo === 'object' ? conteudo.caption : '',
    mensagem.caption,
  );
  const texto = mascararDocumentos(textoBruto);
  const midia = TIPOS_MIDIA.includes(tipo);
  const trackSource = textoOuVazio(mensagem.track_source);
  const wasSentByApi = mensagem.wasSentByApi === true;

  return {
    _kz_estado: true,
    jid,
    lid,
    telefone: telefoneE164({ senderPn: mensagem.sender_pn, telefoneChat: chat.phone, jid, fromMe }),
    texto,
    tipo,
    tipo_mensagem: rotaDoTipo(tipo, texto),
    midia,
    com_legenda: midia && texto.length > 0,
    from_me: fromMe,
    was_sent_by_api: wasSentByApi,
    track_source: trackSource,
    eh_grupo: mensagem.isGroup === true || ehJidDeGrupo(jid) || jid === '',
    eh_eco: fromMe && (wasSentByApi || TRACK_SOURCES_PROPRIOS.includes(trackSource)),
    message_id: primeiroTexto(mensagem.messageid, mensagem.id),
    nome_whatsapp: primeiroTexto(mensagem.senderName),
    nome_contato_salvo: primeiroTexto(chat.wa_contactName),
    carimbo: Number(mensagem.messageTimestamp) || 0,
  };
}
