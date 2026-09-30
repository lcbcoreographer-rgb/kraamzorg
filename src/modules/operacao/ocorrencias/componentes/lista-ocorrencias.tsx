import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { FolhaLupa, SinoCalmo } from "@/components/ilustracoes";
import { AbasPilula } from "@/components/ui/abas-pilula";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import type {
  ListaOcorrencias,
  SituacaoOcorrencias,
} from "@/lib/dados/tipos-ocorrencia";
import { formatarDataHora } from "@/lib/formatacao";
import {
  ROTULO_PRIORIDADE,
  ROTULO_STATUS,
  ROTULO_TIPO,
  VARIANTE_PRIORIDADE,
  VARIANTE_STATUS,
} from "../rotulos";

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Frase do resumo: número em frase, sem painel de números soltos (voz.md, 5). */
export function fraseResumoOcorrencias(
  resumo: ListaOcorrencias["resumo"],
): string {
  if (resumo.abertas === 0) return "Nenhuma ocorrência aberta agora.";
  const partes = [
    `${plural(resumo.abertas, "ocorrência aberta", "ocorrências abertas")}.`,
  ];
  if (resumo.vencidas > 0) {
    partes.push(
      `${plural(resumo.vencidas, "passou", "passaram")} do prazo de resposta.`,
    );
  }
  if (resumo.privadas > 0) {
    partes.push(
      `${plural(resumo.privadas, "é privada", "são privadas")}, só da coordenação.`,
    );
  }
  return partes.join(" ");
}

export function ListaOcorrenciasTela({
  lista,
  situacao,
}: {
  lista: ListaOcorrencias;
  situacao: SituacaoOcorrencias;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-3 text-texto max-w-[60ch]">
        {fraseResumoOcorrencias(lista.resumo)}
      </p>
      <AbasPilula
        rotulo="Filtrar ocorrências"
        ativa={situacao}
        className="self-start"
        abas={[
          { valor: "abertas", rotulo: "Abertas", href: "/ocorrencias" },
          {
            valor: "fechadas",
            rotulo: "Fechadas",
            href: "/ocorrencias?situacao=fechadas",
          },
          {
            valor: "todas",
            rotulo: "Todas",
            href: "/ocorrencias?situacao=todas",
          },
        ]}
      />
      {lista.ocorrencias.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          ilustracao={
            situacao === "abertas" ? (
              <SinoCalmo tamanho={112} />
            ) : (
              <FolhaLupa tamanho={112} />
            )
          }
          titulo={
            situacao === "abertas"
              ? "Nenhuma ocorrência aberta"
              : "Nenhuma ocorrência aqui"
          }
          texto="Quando a equipe abrir uma ocorrência, ou uma pesquisa voltar com nota baixa, ela aparece aqui com o prazo de resposta."
        />
      ) : (
        // No computador a tabela mora num bloco branco (o trabalho a
        // fazer); no celular cada linha já vira o próprio cartão.
        <div className="min-[720px]:rounded-3 min-[720px]:bg-superficie min-[720px]:shadow-1 min-[720px]:px-3 min-[720px]:py-2">
          <TabelaLista
            rotulo="Ocorrências"
            colunas={[
              { chave: "titulo", rotulo: "Ocorrência", principal: true },
              { chave: "status", rotulo: "Andamento", canto: true },
              { chave: "familia", rotulo: "Família" },
              { chave: "tipo", rotulo: "Tipo" },
              { chave: "prioridade", rotulo: "Prioridade" },
              { chave: "responsavel", rotulo: "Responsável" },
              { chave: "prazo", rotulo: "Prazo de resposta" },
            ]}
            linhas={lista.ocorrencias.map((o) => ({
              id: o.id,
              valores: {
                titulo: (
                  <span className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/ocorrencias/${o.id}`}
                      className="text-texto font-semibold underline-offset-4 hover:underline"
                    >
                      {o.titulo}
                    </Link>
                    {o.privada ? (
                      <Selo variante="sensivel" icone={<LockKeyhole />}>
                        Privada
                      </Selo>
                    ) : null}
                  </span>
                ),
                status: (
                  <Selo variante={VARIANTE_STATUS[o.status]}>
                    {ROTULO_STATUS[o.status]}
                  </Selo>
                ),
                familia: o.familiaNome ?? o.profissionalNome ?? "Sem família",
                tipo: ROTULO_TIPO[o.tipo],
                prioridade: (
                  <Selo variante={VARIANTE_PRIORIDADE[o.prioridade]}>
                    {ROTULO_PRIORIDADE[o.prioridade]}
                  </Selo>
                ),
                responsavel: o.responsavelNome ?? "Sem responsável",
                prazo: o.slaVenceEm ? (
                  <span
                    className={o.vencida ? "text-alerta font-semibold" : ""}
                  >
                    {o.vencida ? "Venceu em " : "Até "}
                    <span className="font-mono">
                      {formatarDataHora(o.slaVenceEm)}
                    </span>
                  </span>
                ) : (
                  "Sem prazo"
                ),
              },
            }))}
          />
        </div>
      )}
    </div>
  );
}
