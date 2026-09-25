// Corpo das chamadas HTTP à API de chat da OpenAI (classificador de
// mensagem, reescrita e follow-up do fluxo 3). `temperature` só entra quando
// o config do ambiente mandar (PRD 19.1, armadilha 11 da referência); a
// saída é sempre JSON (`response_format: json_object`), como pedem os
// cabeçalhos dos prompts.

export const URL_OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions';

export function corpoChatJson(modeloConfig, expressaoPrompt) {
  if (!modeloConfig || typeof modeloConfig.modelo !== 'string') {
    throw new Error('modelo do config sem nome (modelos.<uso>.modelo)');
  }
  const partes = [`model: ${JSON.stringify(modeloConfig.modelo)}`];
  if (modeloConfig.aceitaTemperatura === true) {
    partes.push(`temperature: ${Number(modeloConfig.temperatura ?? 0)}`);
  }
  partes.push('response_format: { type: "json_object" }');
  partes.push(`messages: [ { role: "system", content: ${expressaoPrompt} } ]`);
  return `={{ { ${partes.join(', ')} } }}`;
}
