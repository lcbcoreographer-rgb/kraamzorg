import { Botao } from "@/components/ui/botao";
import { acaoSairDoPortal } from "../acoes";

/** Sair do portal (P49): um toque, sem confirmação, porque entrar de novo é só pedir o link. */
export function BotaoSair() {
  return (
    <form action={acaoSairDoPortal}>
      <Botao type="submit" variante="fantasma" tamanho="compacto">
        Sair do portal
      </Botao>
    </form>
  );
}
