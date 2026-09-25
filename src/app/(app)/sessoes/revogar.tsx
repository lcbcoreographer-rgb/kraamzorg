"use client";

import { useActionState, useState } from "react";
import { ShieldOff } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoGatilho,
} from "@/components/ui/dialogo";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { revogarSessoes, type EstadoRevogacao } from "./acoes";

const inicial: EstadoRevogacao = {};

/**
 * "Encerrar sessões" de uma pessoa. Confirmação em folha (DESIGN.md: folha
 * só para o que protege algo): tira a pessoa de todos os aparelhos.
 */
export function RevogarSessoes({
  usuarioId,
  nome,
}: {
  usuarioId: string;
  nome: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(
    async (anterior: EstadoRevogacao, formulario: FormData) => {
      const resultado = await revogarSessoes(anterior, formulario);
      if (resultado.sucesso) setAberto(false);
      return resultado;
    },
    inicial,
  );

  return (
    <div className="flex flex-col items-start gap-2">
      <Dialogo open={aberto} onOpenChange={setAberto}>
        <DialogoGatilho asChild>
          <Botao
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={
              <ShieldOff
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            }
          >
            Encerrar sessões
            <span className="sr-only"> de {nome}</span>
          </Botao>
        </DialogoGatilho>
        <DialogoConteudo
          titulo={`Encerrar as sessões de ${nome}?`}
          descricao="A pessoa sai do sistema em todos os aparelhos e precisa entrar de novo com senha e código. O que ela estava fazendo e ainda não salvou se perde."
          rotuloFechar="Fechar sem encerrar"
        >
          <form action={acao} className="mt-6 flex flex-col gap-3">
            <input type="hidden" name="usuarioId" value={usuarioId} />
            {estado.erro ? (
              <FaixaAlerta variante="imediato" titulo={estado.erro} />
            ) : null}
            <Botao
              type="submit"
              largaTotal
              carregando={enviando}
              rotuloCarregando="Encerrando"
            >
              Encerrar todas as sessões
            </Botao>
            <DialogoFechar asChild>
              <Botao variante="fantasma" largaTotal>
                Manter as sessões
              </Botao>
            </DialogoFechar>
          </form>
        </DialogoConteudo>
      </Dialogo>
      {estado.sucesso ? (
        <p role="status" className="text-apoio text-sucesso">
          {estado.sucesso}
        </p>
      ) : null}
      {!aberto && estado.erro ? (
        <p role="alert" className="text-apoio text-alerta">
          {estado.erro}
        </p>
      ) : null}
    </div>
  );
}
