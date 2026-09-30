import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { exigeMfa } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { ListaTalentos } from "@/lib/dados/tipos-relacao";
import { formatarData } from "@/lib/formatacao";
import { ROTULO_ESTADO_CANDIDATA } from "@/modules/relacao/rotulos";
import { FormularioCandidata } from "@/modules/talentos/componentes/form-candidata";

export const metadata: Metadata = { title: "Banco de talentos · Kraamzorg OS" };

/**
 * Banco de talentos (P51 item 3): as candidatas a enfermeira e técnica, a
 * etapa de cada uma e a média dos 10 critérios. A página pública de
 * candidatura existe e nasce desligada; aqui a equipe também cadastra à mão.
 */
export default async function PaginaTalentos() {
  const usuario = await exigirSessao("/talentos");
  const semMfa = exigeMfa(usuario.papeis) && usuario.aal !== "aal2";

  let lista: ListaTalentos | null = null;
  let falhou = false;
  if (!semMfa) {
    try {
      lista = await (await obterRepositorios()).relacao.talentos.listar();
    } catch (erro) {
      falhou = !(
        erro instanceof ErroRepositorio && erro.codigo === "sem_permissao"
      );
    }
  }

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          Banco de talentos
        </h1>
        <p className="text-corpo text-texto-2 max-w-[60ch]">
          As candidatas em seleção, a etapa de cada uma e a nota da entrevista.
        </p>
      </div>

      {semMfa ? (
        <div className="rounded-3 bg-superficie shadow-1 flex max-w-[560px] flex-col gap-3 p-5">
          <p className="text-corpo text-texto flex items-start gap-3">
            <LockKeyhole
              className="text-texto-2 mt-1 size-4 shrink-0"
              aria-hidden="true"
              strokeWidth={1.75}
            />
            Esta tela guarda dados de candidatas, por isso pede o código do
            aplicativo (MFA) antes de abrir.
          </p>
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            className="self-start"
          >
            <Link
              href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent("/talentos")}`}
            >
              Confirmar com o código
            </Link>
          </Botao>
        </div>
      ) : falhou || !lista ? (
        <FaixaAlerta
          variante={falhou ? "erro" : "info"}
          titulo={
            falhou
              ? "O banco de talentos não abriu agora"
              : "O banco de talentos é da coordenação e da diretoria"
          }
        >
          {falhou
            ? "Confira a conexão e recarregue a página. Nada foi alterado."
            : "Peça o acesso à coordenação."}
        </FaixaAlerta>
      ) : (
        <>
          <FaixaAlerta
            variante="info"
            titulo={
              lista.paginaPublicaAtiva
                ? "Página de candidatura aberta"
                : "Página de candidatura desligada"
            }
          >
            {lista.paginaPublicaAtiva
              ? "Quem se candidatar pelo site entra aqui como Nova."
              : "Por enquanto ninguém se candidata pelo site. Para abrir, a diretoria liga o parâmetro da página de candidatura em Configurações."}
          </FaixaAlerta>
          {lista.candidatas.length === 0 ? (
            <EstadoVazio
              nivelTitulo="h2"
              titulo="Nenhuma candidata ainda"
              texto="Cadastre a primeira abaixo. A entrevista e as notas ficam na ficha de cada uma."
            />
          ) : (
            <TabelaLista
              rotulo="Candidatas"
              colunas={[
                { chave: "nome", rotulo: "Candidata", principal: true },
                { chave: "estado", rotulo: "Etapa", canto: true },
                { chave: "cidade", rotulo: "Cidade" },
                { chave: "chegou", rotulo: "Chegou em" },
                { chave: "avaliacoes", rotulo: "Entrevistas", numerica: true },
                { chave: "media", rotulo: "Média", numerica: true },
              ]}
              linhas={lista.candidatas.map((c) => ({
                id: c.id,
                valores: {
                  nome: (
                    <Link
                      href={`/talentos/${c.id}`}
                      className="text-texto underline underline-offset-4"
                    >
                      {c.nome}
                    </Link>
                  ),
                  estado: (
                    <Selo
                      variante={
                        c.estado === "aprovada"
                          ? "sucesso"
                          : c.estado === "nova"
                            ? "destaque"
                            : c.estado === "nao_seguiu" ||
                                c.estado === "desistiu"
                              ? "contorno"
                              : "neutro"
                      }
                    >
                      {ROTULO_ESTADO_CANDIDATA[c.estado]}
                    </Selo>
                  ),
                  cidade: c.cidade ?? "",
                  chegou: formatarData(c.criadoEm),
                  avaliacoes: String(c.avaliacoes),
                  media:
                    c.mediaGeral === null
                      ? "sem nota"
                      : c.mediaGeral.toFixed(1).replace(".", ","),
                },
              }))}
            />
          )}
          <FormularioCandidata />
        </>
      )}
    </div>
  );
}
