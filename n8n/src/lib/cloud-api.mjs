// Destino do envio por modelo aprovado pela Meta (Cloud API do WhatsApp) no
// fluxo 3, entrada B (P18b, PRD 4.1 D-08 e 19.4 nós 38 a 41). Só o follow-up
// fora da janela de 24 horas usa este envio; a resposta à família e o resto
// seguem pelo destino da UAZAPI (`uazapi.mjs`) até a migração de número
// (T-01).
//
// - Com `homologacao.envioSimulado`, o envio vai para a rota de captura do
//   app (`homologacao.urlCapturaCloudApi`, `/api/teste/cloud-api`, caminho
//   `/messages`), sem credencial: o token da Meta nunca sai do cofre.
// - Sem ele, vai para `cloudApi.urlBase/versao/phoneNumberId/messages` com a
//   credencial Header Auth "WhatsApp Cloud API Kraamzorg" (cabeçalho
//   `Authorization: Bearer <token>`).
//
// O build recusa `--env prod` com `envioSimulado` ligado
// (`build.mjs`, `conferirHomologacao`).

export const CAMINHO_CLOUD_API = '/messages';

function exigirHttps(valor, nome) {
  if (typeof valor !== 'string' || !valor.startsWith('https://')) {
    throw new Error(`${nome} (https) é obrigatório para o envio por modelo da Cloud API`);
  }
  return valor.replace(/\/+$/, '');
}

export function destinoCloudApi(config) {
  const homologacao = config.homologacao ?? {};
  if (homologacao.envioSimulado === true) {
    const base = exigirHttps(homologacao.urlCapturaCloudApi, 'homologacao.urlCapturaCloudApi');
    return {
      simulado: true,
      url: `${base}${CAMINHO_CLOUD_API}`,
      autenticacao: { authentication: 'none' },
      credentials: undefined,
    };
  }
  const nuvem = config.cloudApi ?? {};
  const base = exigirHttps(nuvem.urlBase, 'cloudApi.urlBase');
  const versao = String(nuvem.versao ?? '').trim();
  const numero = String(nuvem.phoneNumberId ?? '').trim();
  if (!/^v[0-9][0-9.]*$/.test(versao)) throw new Error('cloudApi.versao (por exemplo "v23.0") é obrigatório');
  if (!/^[0-9]+$/.test(numero)) throw new Error('cloudApi.phoneNumberId (só dígitos) é obrigatório');
  const { id, name } = config.credenciais?.cloudApi ?? {};
  if (!id || !name) throw new Error('credenciais.cloudApi (id e name) é obrigatório');
  return {
    simulado: false,
    url: `${base}/${versao}/${numero}${CAMINHO_CLOUD_API}`,
    autenticacao: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
    credentials: { httpHeaderAuth: { id, name } },
  };
}

// O corpo já vem pronto do nó "Ler Janela do Follow-up" (`corpo_cloud_api`):
// nome do modelo aprovado, idioma e parâmetros em ordem, montados a partir do
// que o banco devolveu. Nenhum texto é montado aqui.
export const CORPO_CLOUD_API = '={{ $json.corpo_cloud_api }}';
