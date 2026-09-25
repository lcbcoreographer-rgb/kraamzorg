// Destino das chamadas à UAZAPI nos fluxos 2 e 3 (PRD 19.1 e P25 item 5).
//
// - Envio (`/send/text`, `/send/media`): com `homologacao.envioSimulado`
//   ligado, vai para a rota de captura do app (`homologacao.urlCaptura`,
//   `/api/teste/uazapi`), sem credencial: o token da instância nunca sai
//   para o app. Desligado, vai para `uazapi.urlBase` com a credencial Header
//   Auth "UAZAPI Kraamzorg".
// - Download e transcrição de áudio (`/message/download`): mesma regra, com
//   `homologacao.transcricaoSimulada`. A rota de captura devolve o texto que
//   o teste mandar (ou falha, quando o teste pede).
//
// O build recusa `--env prod` com qualquer das duas opções ligada
// (`build.mjs`, `conferirHomologacao`).

export const TRACK_SOURCE_AGENTE = 'kraamzorg-agente';

export const CAMINHOS_UAZAPI = {
  texto: '/send/text',
  midia: '/send/media',
  download: '/message/download',
};

function simulado(config, caminho) {
  const homologacao = config.homologacao ?? {};
  if (caminho === CAMINHOS_UAZAPI.download) return homologacao.transcricaoSimulada === true;
  return homologacao.envioSimulado === true;
}

export function destinoUazapi(config, caminho) {
  if (simulado(config, caminho)) {
    const base = config.homologacao?.urlCaptura;
    if (typeof base !== 'string' || !base.startsWith('https://')) {
      throw new Error('homologacao.urlCaptura (https) é obrigatório com envioSimulado ou transcricaoSimulada ligado');
    }
    return {
      simulado: true,
      url: `${base.replace(/\/$/, '')}${caminho}`,
      autenticacao: { authentication: 'none' },
      credentials: undefined,
    };
  }
  const { id, name } = config.credenciais.uazapi;
  return {
    simulado: false,
    url: `${config.uazapi.urlBase.replace(/\/$/, '')}${caminho}`,
    autenticacao: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
    credentials: { httpHeaderAuth: { id, name } },
  };
}

// Corpo do `/send/text`, sempre com `track_source` (PRD 19.1: é como o fluxo
// 3 reconhece o próprio eco). `expressaoDelay` é opcional (digitação
// simulada, PRD 11.11 item 8).
export function corpoEnvioTexto(expressaoNumero, expressaoTexto, expressaoDelay = null) {
  const partes = [`number: ${expressaoNumero}`, `text: ${expressaoTexto}`];
  if (expressaoDelay) partes.push(`delay: ${expressaoDelay}`);
  partes.push(`track_source: ${JSON.stringify(TRACK_SOURCE_AGENTE)}`);
  return `={{ { ${partes.join(', ')} } }}`;
}

// Corpo do `/send/media` da apresentação (PRD 19.4 nó 34).
export function corpoEnvioDocumento(expressaoNumero, expressaoArquivo, expressaoNome) {
  return `={{ { number: ${expressaoNumero}, type: "document", file: ${expressaoArquivo}, docName: ${expressaoNome}, track_source: ${JSON.stringify(TRACK_SOURCE_AGENTE)} } }}`;
}
