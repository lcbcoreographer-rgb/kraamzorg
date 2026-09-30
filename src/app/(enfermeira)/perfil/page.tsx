import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { hojeEmBrasilia, somarDias } from "@/lib/agenda/datas";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { formatarData } from "@/lib/formatacao";
import { SeloEstadoProfissional } from "@/modules/operacao/equipe/componentes/selo-estado";
import {
  ROTULO_FUNCAO,
  ROTULO_SITUACAO_DOCUMENTO,
} from "@/modules/operacao/equipe/textos";
import { BotaoSairPortal } from "@/modules/operacao/portal/componentes/botao-sair-portal";
import { IndicadorPortal } from "@/modules/operacao/portal/componentes/indicador-portal";
import { diaEmFrase } from "@/modules/operacao/portal/textos";

export const metadata: Metadata = { title: "Perfil · Kraamzorg OS" };

const VARIANTE_SITUACAO = {
  vencido: "alerta",
  vencendo: "aviso",
  em_dia: "sucesso",
  sem_validade: "neutro",
} as const;

function Secao({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5"
    >
      <h2 id={id} className="font-titulo text-2 text-texto font-medium">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/**
 * Perfil da enfermeira (P38 item 1): como a coordenação vê você agora (o
 * estado é calculado, você não marca), a semana com as visitas de cada dia,
 * a validade dos documentos e os bloqueios de agenda que a coordenação
 * cadastrou. Sair fica aqui porque o portal não tem barra lateral.
 */
export default async function PaginaPerfil() {
  const sessao = await exigirSessao("/perfil");
  const { portal } = await obterRepositorios();
  const [perfil, familias] = await Promise.all([
    portal.obterPerfil(),
    portal.listarFamilias(),
  ]);
  const hoje = hojeEmBrasilia();
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i));
  const visitasDoDia = (dia: string) =>
    familias
      .flatMap((f) =>
        f.visitas
          .filter(
            (v) =>
              v.data === dia &&
              v.estado !== "cancelada" &&
              v.estado !== "reagendada",
          )
          .map((v) => ({ ...v, nome: f.nomeExibicao })),
      )
      .sort((a, b) =>
        (a.horaPrevista ?? "99:99").localeCompare(b.horaPrevista ?? "99:99"),
      );

  return (
    <>
      <CabecalhoTela titulo="Perfil" lateral={<IndicadorPortal />} />
      <div className="flex flex-col gap-5 pt-6">
        <p className="text-corpo text-texto">
          <span className="font-semibold">
            {perfil.profissional.nome || sessao.nome}
          </span>
          <br />
          <span className="text-apoio text-texto-2">
            {ROTULO_FUNCAO[perfil.profissional.funcao] ??
              perfil.profissional.funcao}
            {perfil.profissional.conselhoNumero
              ? `, ${perfil.profissional.conselho ?? ""} ${perfil.profissional.conselhoNumero}${
                  perfil.profissional.conselhoUf
                    ? `/${perfil.profissional.conselhoUf}`
                    : ""
                }`
              : ""}
          </span>
        </p>

        <Secao id="p-estado" titulo="Como você aparece agora">
          <p className="flex flex-wrap items-center gap-3">
            <SeloEstadoProfissional estado={perfil.status} />
            <span className="text-apoio text-texto-2">
              O estado muda sozinho: em visita quando você chega, de volta ao
              anterior quando sai.
            </span>
          </p>
        </Secao>

        <Secao id="p-semana" titulo="Sua semana">
          <ol className="flex flex-col gap-3">
            {dias.map((dia) => {
              const lista = visitasDoDia(dia);
              return (
                <li
                  key={dia}
                  className="border-linha flex flex-col gap-1 border-b pb-3"
                  data-dia={dia}
                >
                  <p className="text-corpo text-texto font-medium">
                    {dia === hoje
                      ? `Hoje, ${diaEmFrase(dia)}`
                      : diaEmFrase(dia)}
                  </p>
                  {lista.length === 0 ? (
                    <p className="text-apoio text-texto-2">
                      Sem visita marcada.
                    </p>
                  ) : (
                    lista.map((v) => (
                      <p key={v.visitaId} className="text-apoio text-texto">
                        <span className="font-mono">
                          {v.horaPrevista ?? "sem hora"}
                        </span>
                        {" · "}
                        {v.nome}, dia {v.diaNumero}
                      </p>
                    ))
                  )}
                </li>
              );
            })}
          </ol>
        </Secao>

        <Secao id="p-documentos" titulo="Seus documentos">
          {perfil.documentos.length === 0 ? (
            <EstadoVazio
              nivelTitulo="h3"
              titulo="Nenhum documento cadastrado"
              texto="A coordenação cadastra a carteira do conselho e o que mais tiver validade. Ela avisa você antes de vencer."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {perfil.documentos.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="text-corpo text-texto">
                    {d.tipo}
                    <span className="text-apoio text-texto-2 font-mono">
                      {d.validade
                        ? ` · validade ${formatarData(d.validade)}`
                        : " · sem validade"}
                    </span>
                  </span>
                  <Selo variante={VARIANTE_SITUACAO[d.situacao]}>
                    {ROTULO_SITUACAO_DOCUMENTO[d.situacao]}
                  </Selo>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {perfil.bloqueios.length > 0 ? (
          <Secao id="p-bloqueios" titulo="Dias em que você não recebe visitas">
            <ul className="flex flex-col gap-2">
              {perfil.bloqueios.map((b) => (
                <li key={b.id} className="text-corpo text-texto font-mono">
                  {formatarData(b.inicio)} a {formatarData(b.fim)}
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}

        <Secao id="p-ofertas" titulo="Ofertas de família">
          <p className="text-corpo text-texto-2">
            Quando a coordenação convidar você para acompanhar uma família, o
            convite aparece aqui para aceitar ou recusar.
          </p>
          <Botao asChild variante="secundario" className="self-start">
            <Link href="/ofertas">Ver as ofertas</Link>
          </Botao>
        </Secao>

        <Secao id="p-treinamentos" titulo="Treinamentos e manuais">
          <p className="text-corpo text-texto-2">
            Os manuais e protocolos da sua função, com a trilha de leitura que a
            coordenação montou.
          </p>
          <div className="flex flex-wrap gap-3">
            <Botao asChild variante="secundario" className="self-start">
              <Link href="/treinamentos">Ver os treinamentos</Link>
            </Botao>
            <Botao asChild variante="secundario" className="self-start">
              <Link href="/manuais">Ver os manuais</Link>
            </Botao>
          </div>
        </Secao>

        <Secao id="p-app" titulo="Usar como aplicativo">
          <p className="text-corpo text-texto-2">
            No celular, abra o menu do navegador e escolha Adicionar à tela
            inicial. O aplicativo abre o Hoje mesmo sem sinal e guarda o que
            você registrar até a conexão voltar.
          </p>
        </Secao>

        <BotaoSairPortal />
      </div>
    </>
  );
}
