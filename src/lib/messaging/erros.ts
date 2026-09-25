/**
 * Erro único do mensageiro. A tela troca o código por uma frase (PRD 20.3);
 * nunca lança para dentro de `enviar()` (que devolve `{ ok: false, motivo }`
 * em vez de exceção, porque "não deu para enviar" é resultado esperado,
 * não bug). Serve para os casos fora desse fluxo: canal mal configurado ou
 * ainda não implementado.
 */
export type CodigoErroMensageiro =
  /** Variável de ambiente do canal ausente (token, URL). */
  | "nao_configurado"
  /** `cloud_api`, preparado no P18, implementado de verdade no P18b. */
  | "nao_implementado";

export class ErroMensageiro extends Error {
  readonly codigo: CodigoErroMensageiro;

  constructor(codigo: CodigoErroMensageiro, detalhe: string) {
    super(detalhe);
    this.name = "ErroMensageiro";
    this.codigo = codigo;
  }
}
