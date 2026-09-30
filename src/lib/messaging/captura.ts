/**
 * Captura de homologação da Cloud API (P18b): sem credencial da Meta, o
 * adaptador `cloud_api` guarda aqui o que enviaria de verdade, para o teste
 * e o roteiro de homologação conferirem o modelo escolhido e os parâmetros
 * sem número real. Fica em `globalThis` (sobrevive à recarga de módulo do
 * `next dev` e é a mesma loja entre as rotas), como a captura da UAZAPI.
 *
 * Só existe fora de produção: `capturaPermitida()` exige o ambiente
 * `desenvolvimento` ou `homologacao` e recusa qualquer deploy de produção
 * (`VERCEL_ENV=production`). Em produção, sem credencial, o adaptador
 * devolve falha e nada é capturado em silêncio.
 */

export interface CapturaCloudApi {
  id: string;
  /** Corpo que iria para `POST /{phone-number-id}/messages`. */
  corpo: Record<string, unknown>;
  capturadoEm: string;
}

const CHAVE_GLOBAL = "__kraamzorgCapturaCloudApi";

function loja(): CapturaCloudApi[] {
  const global = globalThis as unknown as Record<
    string,
    CapturaCloudApi[] | undefined
  >;
  global[CHAVE_GLOBAL] ??= [];
  return global[CHAVE_GLOBAL];
}

export function capturaPermitida(): boolean {
  const ambiente = process.env.NEXT_PUBLIC_APP_ENV;
  if (ambiente !== "homologacao" && ambiente !== "desenvolvimento") {
    return false;
  }
  return process.env.VERCEL_ENV !== "production";
}

export function registrarCaptura(corpo: Record<string, unknown>): string {
  const lista = loja();
  const id = `captura-${lista.length + 1}`;
  lista.push({ id, corpo, capturadoEm: new Date().toISOString() });
  return id;
}

export function listarCapturas(): CapturaCloudApi[] {
  return [...loja()];
}

export function limparCapturas(): void {
  loja().length = 0;
}
