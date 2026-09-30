import { Colunas } from "@/components/graficos/colunas";
import { BarrasHorizontais } from "@/components/graficos/barras-horizontais";
import { VerComoTabela } from "@/components/graficos/ver-como-tabela";
import { Calculator, MapPin } from "lucide-react";
import { Broto } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { TileIcone } from "@/components/ui/tile-icone";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import type {
  CapacidadeVisao,
  NivelCapacidade,
} from "@/lib/dados/tipos-gestao";
import { formatarDecimal, formatarPct, dataCurta } from "@/lib/gestao/formato";
import {
  ROTULO_COBERTURA,
  ROTULO_NIVEL,
  colunasDaRegiao,
  faixaDaSemana,
  faixasDaDistribuicao,
  notaDaDistribuicao,
  textoDoAlerta,
  tituloDoAlerta,
} from "../textos";

const VARIANTE_SELO: Record<NivelCapacidade, "neutro" | "aviso" | "alerta"> = {
  folga: "neutro",
  atencao: "aviso",
  sobrevenda: "alerta",
};

/**
 * Capacidade das próximas semanas (P45, PRD 10.2): por região, a ocupação, a
 * chance de passar do limite de famílias por semana e a cobertura de backup.
 * O agente da Isadora nunca vê estes números: continua recebendo só
 * "disponível" ou "confirmar com a equipe".
 */
export function VisaoCapacidade({ visao }: { visao: CapacidadeVisao }) {
  const sobrevendas = visao.alertas.filter((a) => a.nivel === "sobrevenda");
  return (
    <div className="flex flex-col gap-8">
      {sobrevendas.length > 0 ? (
        <FaixaAlerta
          variante="prioritario"
          titulo={
            sobrevendas.length === 1
              ? "Uma semana com chance de sobrevenda"
              : `${sobrevendas.length} semanas com chance de sobrevenda`
          }
          meta="A diretoria também recebe este aviso no início do dia, uma vez por região e semana."
        >
          <ul className="flex flex-col gap-1.5">
            {sobrevendas.slice(0, 6).map((a) => (
              <li key={`${a.regiaoId}-${a.semana}`}>
                <span className="font-semibold">{tituloDoAlerta(a)}.</span>{" "}
                {textoDoAlerta(a)}
              </li>
            ))}
          </ul>
        </FaixaAlerta>
      ) : null}

      {visao.regioes.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          ilustracao={<Broto tamanho={104} />}
          titulo="Nenhuma região com limite cadastrado"
          texto="A capacidade aparece aqui assim que uma região tiver o limite de famílias por semana em Configurações."
        />
      ) : (
        // Uma região por bloco, lado a lado no computador; o limite e a
        // equipe em pílulas lavanda (agenda), a semana em colunas.
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {visao.regioes.map((r) => (
            <section
              key={r.regiaoId}
              aria-labelledby={`cap-${r.regiaoId}`}
              className="bg-superficie rounded-3 shadow-1 flex min-w-0 flex-col gap-4 p-5 lg:p-6"
            >
              <div className="flex flex-col gap-3">
                <h2
                  id={`cap-${r.regiaoId}`}
                  className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
                >
                  <TileIcone tom="lavanda" forma="quadrado">
                    <MapPin />
                  </TileIcone>
                  {r.regiao}
                </h2>
                <p className="text-apoio text-texto flex flex-wrap gap-2">
                  <span className="rounded-pilula bg-lavanda-clara px-3 py-1 font-medium">
                    Limite de {r.limiteFamilias}{" "}
                    {r.limiteFamilias === 1 ? "família" : "famílias"} por
                    semana.
                  </span>
                  {r.semanas[0] ? (
                    <span className="rounded-pilula bg-lavanda-clara px-3 py-1 font-medium">
                      {`${r.semanas[0].profissionaisAtivas} ${r.semanas[0].profissionaisAtivas === 1 ? "profissional ativa" : "profissionais ativas"} na região.`}
                    </span>
                  ) : null}
                </p>
              </div>
              <Colunas
                descricao={`Ocupação de ${r.regiao} nas próximas ${visao.semanas} semanas, em porcentagem do limite`}
                dados={colunasDaRegiao(r)}
                referencia={{
                  valor: visao.limites.alertaPct,
                  rotulo: `Alerta ${formatarPct(visao.limites.alertaPct)}`,
                }}
                eixo="porcentagem"
                legenda={[
                  { estado: "neutro", rotulo: "Tranquila" },
                  {
                    estado: "atencao",
                    rotulo: "Atenção: ocupação alta ou sem reserva de backup",
                  },
                  {
                    estado: "alerta",
                    rotulo: `Sobrevenda provável: chance de passar o limite a partir de ${formatarPct(visao.limites.sobrevendaProbPct)}`,
                  },
                ]}
              />
              <VerComoTabela
                rotulo={`Capacidade de ${r.regiao} por semana`}
                colunas={[
                  { chave: "semana", rotulo: "Semana", principal: true },
                  { chave: "situacao", rotulo: "Situação", canto: true },
                  { chave: "ocupacao", rotulo: "Ocupação", numerica: true },
                  {
                    chave: "esperadas",
                    rotulo: "Famílias esperadas",
                    numerica: true,
                  },
                  {
                    chave: "pior",
                    rotulo: "Pior caso razoável",
                    numerica: true,
                  },
                  {
                    chave: "chance",
                    rotulo: "Chance de passar o limite",
                    numerica: true,
                  },
                  { chave: "equipe", rotulo: "Equipe atende", numerica: true },
                  { chave: "backup", rotulo: "Backup" },
                ]}
                linhas={r.semanas.map((s) => ({
                  id: `${r.regiaoId}-${s.semana}`,
                  valores: {
                    semana: `${faixaDaSemana(s.semana)}`,
                    situacao: (
                      <Selo variante={VARIANTE_SELO[s.nivel]}>
                        {ROTULO_NIVEL[s.nivel]}
                      </Selo>
                    ),
                    ocupacao: formatarPct(s.ocupacaoPct),
                    esperadas: formatarDecimal(s.familiasEsperadas),
                    pior: String(s.familiasP90),
                    chance: formatarPct(s.probExcessoPct),
                    equipe: `${s.capacidadeEquipe} ${s.capacidadeEquipe === 1 ? "família" : "famílias"}`,
                    backup: ROTULO_COBERTURA[s.cobertura],
                  },
                }))}
              />
            </section>
          ))}
        </div>
      )}

      <section
        aria-labelledby="cap-como"
        className="bg-areia-clara rounded-3 flex flex-col gap-3 p-5 lg:p-6"
      >
        <h2
          id="cap-como"
          className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
        >
          <TileIcone tom="areia" forma="quadrado">
            <Calculator />
          </TileIcone>
          Como a previsão é feita
        </h2>
        <p className="text-corpo text-texto max-w-[68ch]">
          {notaDaDistribuicao(visao.distribuicao)}
        </p>
        <p className="text-corpo text-texto max-w-[68ch]">
          Cada família tem uma chance de estar em atendimento em cada semana,
          que vem da data provável do parto, da distribuição do nascimento e do
          número de dias do pacote. Com essas chances, o sistema calcula a
          probabilidade de passar do limite de famílias por semana da região.
          Contrato com início já registrado conta como fato, e a data provável
          nunca dispara nada sozinha.
        </p>
        {visao.distribuicao.faixas.length > 0 ? (
          <details className="group">
            <summary className="text-apoio text-texto min-h-toque inline-flex cursor-pointer list-none items-center font-semibold underline decoration-1 underline-offset-4 [&::-webkit-details-marker]:hidden">
              Ver a distribuição usada
            </summary>
            <div className="mt-3 max-w-[560px]">
              <BarrasHorizontais
                descricao="Parte dos nascimentos em cada faixa de idade gestacional"
                dados={faixasDaDistribuicao(visao.distribuicao)}
              />
              <p className="text-mini text-texto-2 mt-3">
                Versão {visao.distribuicao.versao ?? "sem versão"}. Semanas e
                dias de gestação no nascimento; a data provável do parto é
                40s0d.
              </p>
            </div>
          </details>
        ) : null}
        <p className="text-mini text-texto-2">
          A ferramenta do agente continua devolvendo só &ldquo;disponível&rdquo;
          ou &ldquo;confirmar com a equipe&rdquo;, nunca estes números. Semanas
          a partir de{" "}
          {dataCurta(visao.regioes[0]?.semanas[0]?.semana ?? "0000-00-00")}.
        </p>
      </section>
    </div>
  );
}
