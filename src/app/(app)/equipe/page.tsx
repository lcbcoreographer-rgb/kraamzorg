import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { cn } from "@/lib/utils";
import { CartaoProfissional } from "@/modules/operacao/equipe/componentes/cartao-profissional";
import { LegendaSemana } from "@/modules/operacao/equipe/componentes/semana-equipe";
import {
  carregarEquipe,
  type EquipeTela,
} from "@/modules/operacao/equipe/dados";
import { fraseSinteseEquipe } from "@/modules/operacao/equipe/textos";

export const metadata: Metadata = { title: "Equipe · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? null;

function ChipFiltro({
  href,
  ativo,
  children,
}: {
  href: string;
  ativo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "true" : undefined}
      className={cn(
        "rounded-pilula text-apoio min-h-toque inline-flex items-center border-[1.5px] px-4 font-medium no-underline",
        ativo
          ? "border-acao bg-acao text-acao-texto"
          : "border-borda-campo bg-superficie text-texto hover:bg-marinho-08",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Equipe (P37, fluxo C): como está cada enfermeira hoje e a semana dela em
 * turnos, com o estado sempre calculado das designações, das visitas e dos
 * bloqueios de agenda (nenhuma tela oferece marcar o estado à mão). Só
 * coordenação e diretoria. A frase de cima resume o dia.
 */
export default async function PaginaEquipe({
  searchParams,
}: {
  searchParams: Promise<Pesquisa>;
}) {
  await exigirSessao("/equipe");
  const pesquisa = await searchParams;
  const regiaoId = um(pesquisa.praca);
  const inativas = um(pesquisa.inativas) === "1";

  let tela: EquipeTela | null = null;
  try {
    tela = await carregarEquipe({ regiaoId, incluirInativas: inativas });
  } catch {
    tela = null;
  }

  const acaoNova = (
    <Botao
      asChild
      tamanho="compacto"
      iconeEsquerda={<Plus aria-hidden="true" />}
    >
      <Link href="/equipe/nova">Nova profissional</Link>
    </Botao>
  );

  if (!tela) {
    return (
      <>
        <CabecalhoTela titulo="Equipe" lateral={acaoNova} />
        <div className="pt-6">
          <FaixaAlerta variante="erro" titulo="A equipe não abriu agora">
            Nada foi alterado. Confira a conexão e recarregue a página; se
            continuar, avise a equipe técnica.
          </FaixaAlerta>
        </div>
      </>
    );
  }

  const { visao, regioes, linhasPorProfissional } = tela;
  const nomesRegioes = new Map(regioes.map((r) => [r.id, r.nome]));
  const querString = (extra: Record<string, string | null>) => {
    const partes = new URLSearchParams();
    const praca = "praca" in extra ? extra.praca : regiaoId;
    const ina = "inativas" in extra ? extra.inativas : inativas ? "1" : null;
    if (praca) partes.set("praca", praca);
    if (ina) partes.set("inativas", ina);
    const s = partes.toString();
    return s ? `/equipe?${s}` : "/equipe";
  };

  const fazemVisita = visao.profissionais.filter((p) => p.atendeVisitas);
  const outras = visao.profissionais.filter((p) => !p.atendeVisitas);

  return (
    <>
      <CabecalhoTela
        titulo="Equipe"
        subtitulo={fraseSinteseEquipe(visao.resumo)}
        lateral={acaoNova}
      />

      <div className="flex flex-col gap-6 pt-6">
        <nav
          aria-label="Filtros da equipe"
          className="flex flex-wrap items-center gap-2"
        >
          <ChipFiltro href={querString({ praca: null })} ativo={!regiaoId}>
            Todas as praças
          </ChipFiltro>
          {regioes.map((r) => (
            <ChipFiltro
              key={r.id}
              href={querString({ praca: r.id })}
              ativo={regiaoId === r.id}
            >
              {r.nome}
            </ChipFiltro>
          ))}
          <ChipFiltro
            href={querString({ inativas: inativas ? null : "1" })}
            ativo={inativas}
          >
            Mostrar inativas
          </ChipFiltro>
          <Botao
            asChild
            variante="fantasma"
            tamanho="compacto"
            iconeEsquerda={<CalendarDays aria-hidden="true" />}
          >
            <Link href="/equipe/escala">Escala da semana</Link>
          </Botao>
        </nav>

        <LegendaSemana />

        {fazemVisita.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h2"
            titulo={
              regiaoId
                ? "Nenhuma enfermeira ativa nesta praça"
                : "Nenhuma enfermeira cadastrada"
            }
            texto={
              regiaoId
                ? "Cadastre uma enfermeira nesta praça em Nova profissional. Quando ela estiver ativa, o estado dela aparece aqui."
                : "Cadastre a primeira em Nova profissional. O estado de cada uma aparece aqui, calculado das ofertas, das visitas e das folgas."
            }
            acao={
              <Botao asChild variante="secundario" tamanho="compacto">
                <Link href="/equipe/nova">Nova profissional</Link>
              </Botao>
            }
          />
        ) : (
          <ul
            className="tablet:grid-cols-2 grid grid-cols-1 items-start gap-4"
            aria-label="Enfermeiras"
          >
            {fazemVisita.map((p) => (
              <li key={p.id} className="min-w-0">
                <CartaoProfissional
                  profissional={p}
                  linhaEscala={linhasPorProfissional.get(p.id) ?? null}
                  hoje={visao.hoje}
                  nomesRegioes={nomesRegioes}
                />
              </li>
            ))}
          </ul>
        )}

        {outras.length > 0 ? (
          <section
            aria-labelledby="outras-funcoes"
            className="flex flex-col gap-2"
          >
            <h2
              id="outras-funcoes"
              className="font-titulo text-2 text-texto font-medium"
            >
              Coordenação
            </h2>
            <p className="text-apoio text-texto-2">
              Quem coordena aparece no cadastro, mas não entra nas visitas nem
              na escala.
            </p>
            <ul className="flex flex-col gap-1">
              {outras.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/equipe/${p.id}`}
                    className="text-corpo text-texto min-h-toque inline-flex items-center underline underline-offset-4"
                  >
                    {p.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
