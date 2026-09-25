import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import {
  listarFilaTela,
  obterTelefonePlantao,
} from "@/modules/agente/transferencias/dados";
import { FilaTransferencias } from "@/modules/agente/transferencias/componentes/fila-transferencias";
import { DESTINO_DO_PAPEL } from "@/modules/agente/tipos";
import type { TransferenciaTela } from "@/modules/agente/tipos";
import { papelPrincipal } from "@/lib/navegacao";

export const metadata: Metadata = { title: "Transferências · Kraamzorg OS" };

/**
 * Fila de transferências da Isadora, por prioridade e prazo, com faixa
 * vermelha quando o aviso ao grupo falhou (P27 item 2, PRD 11.4; protótipo
 * `comercial-inicio.html`). Dono: P27.
 */
export default async function PaginaTransferencias() {
  const sessao = await exigirSessao("/transferencias");

  let fila: TransferenciaTela[] | null = null;
  try {
    fila = await listarFilaTela();
  } catch {
    fila = null;
  }
  const principal = papelPrincipal(sessao.papeis);
  const destinoDoPapel = principal ? DESTINO_DO_PAPEL[principal] : undefined;
  const telefonePlantao = fila ? await obterTelefonePlantao() : null;

  return (
    <>
      <CabecalhoTela
        titulo="Transferências"
        subtitulo="Cada pedido que a Isadora passou para a equipe, por prioridade e prazo."
      />
      <div className="pt-6">
        {fila ? (
          <FilaTransferencias
            fila={fila}
            usuarioId={sessao.usuarioId}
            destinoDoPapel={destinoDoPapel}
            telefonePlantao={telefonePlantao}
          />
        ) : (
          <FaixaAlerta
            variante="imediato"
            titulo="Não foi possível carregar a fila agora"
          >
            Confira a conexão e recarregue a página. Se continuar, avise a
            equipe técnica.
          </FaixaAlerta>
        )}
      </div>
    </>
  );
}
