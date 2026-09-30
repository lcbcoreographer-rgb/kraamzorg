import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Hourglass,
  Plus,
  UserCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { ChaveDeCasa } from "@/components/ilustracoes";
import { AbasPilula } from "@/components/ui/abas-pilula";
import { Botao } from "@/components/ui/botao";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { ItemBloco, ListaBlocos } from "@/components/ui/lista-blocos";
import { exigirSessao } from "@/lib/auth/sessao";
import { cn } from "@/lib/utils";
import { TituloSecao } from "@/modules/operacao/comum/titulo-secao";
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
        "rounded-pilula text-apoio min-h-toque ease-estado inline-flex items-center border-[1.5px] px-4 font-semibold no-underline transition-colors duration-140",
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

      <div className="flex flex-col gap-8 pt-6">
        <div className="tablet:grid-cols-3 grid grid-cols-2 gap-2 lg:gap-3">
          <CartaoResumo
            destaque
            className="tablet:col-span-1 col-span-2"
            tom="argila"
            icone={<UsersRound />}
            valor={visao.resumo.emVisita + visao.resumo.emAtendimento}
            rotulo="com famílias agora"
            contexto={
              visao.resumo.emVisita === 0
                ? "ninguém em visita neste momento"
                : visao.resumo.emVisita === 1
                  ? "1 em visita neste momento"
                  : `${visao.resumo.emVisita} em visita neste momento`
            }
          />
          <CartaoResumo
            tom="areia"
            icone={<UserCheck />}
            valor={visao.resumo.livre}
            rotulo={visao.resumo.livre === 1 ? "livre" : "livres"}
            contexto={
              visao.resumo.folga === 0
                ? "ninguém de folga hoje"
                : `${visao.resumo.folga} de folga hoje`
            }
          />
          <CartaoResumo
            tom="dourado"
            icone={<Hourglass />}
            valor={visao.resumo.ofertaPendente}
            rotulo={
              visao.resumo.ofertaPendente === 1
                ? "oferta sem resposta"
                : "ofertas sem resposta"
            }
            contexto={
              visao.resumo.ofertaMaisAntigaHoras === null
                ? "nenhuma esperando"
                : visao.resumo.ofertaMaisAntigaHoras >= 48
                  ? `a mais antiga há ${Math.floor(visao.resumo.ofertaMaisAntigaHoras / 24)} dias`
                  : `a mais antiga há ${visao.resumo.ofertaMaisAntigaHoras} h`
            }
          />
        </div>

        <nav
          aria-label="Filtros da equipe"
          className="flex flex-wrap items-center gap-2"
        >
          {regioes.length > 0 ? (
            <AbasPilula
              rotulo="Praça"
              ativa={regiaoId ?? ""}
              abas={[
                {
                  valor: "",
                  rotulo: "Todas as praças",
                  href: querString({ praca: null }),
                },
                ...regioes.map((r) => ({
                  valor: r.id,
                  rotulo: r.nome,
                  href: querString({ praca: r.id }),
                })),
              ]}
            />
          ) : null}
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

        <div className="rounded-3 bg-areia-clara px-5 py-4">
          <LegendaSemana />
        </div>

        {fazemVisita.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<ChaveDeCasa tamanho={112} />}
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
            className="tablet:grid-cols-2 -mt-2 grid grid-cols-1 items-start gap-3 lg:gap-4"
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
            className="flex flex-col gap-3"
          >
            <TituloSecao
              id="outras-funcoes"
              icone={<UserRound />}
              tom="argila"
              titulo="Coordenação"
              texto="Quem coordena aparece no cadastro, mas não entra nas visitas nem na escala."
            />
            <ListaBlocos className="lg:max-w-[560px]">
              {outras.map((p) => (
                <ItemBloco
                  key={p.id}
                  href={`/equipe/${p.id}`}
                  icone={<UserRound />}
                  tom="argila"
                  titulo={p.nome}
                  apoio="Abrir o cadastro"
                />
              ))}
            </ListaBlocos>
          </section>
        ) : null}
      </div>
    </>
  );
}
