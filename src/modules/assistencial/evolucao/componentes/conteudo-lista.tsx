import { ClipboardPen, MailCheck, UserCheck } from "lucide-react";
import { AbasPilula } from "@/components/ui/abas-pilula";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { obterTelaListaEvolucoes, type TelaListaEvolucoes } from "../dados";
import { ListaEvolucoesTela } from "./lista-evolucoes";

/**
 * Corpo da tela de evoluções, igual para a coordenação e para a enfermeira: o
 * filtro (abertas ou todas), a frase do que espera ação e a lista. A base dos
 * links é o que muda entre as duas.
 */
export function situacaoDaBusca(
  valor: string | undefined,
): "abertas" | "todas" {
  return valor === "todas" ? "todas" : "abertas";
}

export async function ConteudoListaEvolucoes({
  filtro,
  base,
  baseFamilia,
}: {
  filtro: "abertas" | "todas";
  base: "/evolucoes" | "/minhas-evolucoes";
  baseFamilia: "/familias" | "/minhas-familias";
}) {
  let tela: TelaListaEvolucoes | null = null;
  try {
    tela = await obterTelaListaEvolucoes(filtro);
  } catch {
    tela = null;
  }

  if (!tela) {
    return (
      <FaixaAlerta variante="erro" titulo="As evoluções não abriram agora">
        Confira a conexão e recarregue a página. Nada foi alterado.
      </FaixaAlerta>
    );
  }
  if (tela.situacao === "sem_permissao") {
    return (
      <FaixaAlerta
        variante="info"
        titulo="As evoluções não estão com o seu papel"
      >
        As evoluções são da enfermeira que atende, da coordenação e da
        diretoria.
      </FaixaAlerta>
    );
  }

  const pendentes = tela.lista.acompanhamentos.filter(
    (a) => a.situacao !== "concluida" && a.situacao !== "em_andamento",
  ).length;
  const emRevisao = tela.lista.acompanhamentos.filter(
    (a) => a.situacao === "em_andamento",
  ).length;
  const enviadas = tela.lista.acompanhamentos.filter(
    (a) => a.situacao === "concluida",
  ).length;
  const escaladas = tela.lista.acompanhamentos.filter(
    (a) => a.situacao === "escalada",
  ).length;
  const daEnfermeira = base === "/minhas-evolucoes";

  return (
    <div className="flex flex-col gap-6">
      {tela.lista.acompanhamentos.length > 0 ? (
        <div
          className={
            filtro === "todas"
              ? "tablet:grid-cols-3 grid grid-cols-2 gap-2 lg:gap-3"
              : "tablet:grid-cols-2 grid grid-cols-2 gap-2 lg:max-w-[720px] lg:gap-3"
          }
        >
          <CartaoResumo
            destaque
            className="tablet:col-span-1 col-span-2"
            tom="dourado"
            icone={<ClipboardPen />}
            valor={pendentes}
            rotulo={
              pendentes === 1
                ? "evolução para preencher"
                : "evoluções para preencher"
            }
            contexto={
              escaladas === 0
                ? pendentes === 0
                  ? "nada esperando agora"
                  : "todas dentro do prazo"
                : escaladas === 1
                  ? "1 passou do prazo e está com a coordenação"
                  : `${escaladas} passaram do prazo e estão com a coordenação`
            }
          />
          <CartaoResumo
            tom="argila"
            className={
              filtro === "todas" ? undefined : "tablet:col-span-1 col-span-2"
            }
            icone={<UserCheck />}
            valor={emRevisao}
            rotulo="em revisão ou envio"
            contexto={
              daEnfermeira
                ? "com a coordenação"
                : "a coordenação revisa e envia"
            }
          />
          {filtro === "todas" ? (
            <CartaoResumo
              tom="salvia"
              icone={<MailCheck />}
              valor={enviadas}
              rotulo={
                enviadas === 1 ? "enviada aos médicos" : "enviadas aos médicos"
              }
              contexto="com o PDF no e-mail de cada médico"
            />
          ) : null}
        </div>
      ) : null}
      {tela.lista.acompanhamentos.length === 0 ? null : pendentes +
          emRevisao ===
        0 ? (
        <p className="text-corpo text-texto max-w-[60ch]">
          Nenhuma evolução espera ação agora.
        </p>
      ) : null}
      <AbasPilula
        rotulo="Filtrar evoluções"
        ativa={filtro}
        className="self-start"
        abas={[
          { valor: "abertas", rotulo: "Em aberto", href: base },
          { valor: "todas", rotulo: "Todas", href: `${base}?situacao=todas` },
        ]}
      />
      <ListaEvolucoesTela
        lista={tela.lista}
        base={base}
        baseFamilia={baseFamilia}
        filtro={filtro}
      />
    </div>
  );
}
