import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { obterRepositorioModulo } from "../dados";
import { AlternarPacoteAtivo } from "./alternar-pacote-ativo";
import { FormularioNovaVersao } from "./formulario-nova-versao";

/** Pacotes e versões (P13, "Fazer" item 2): preço novo sempre cria versão com vigência. */
export async function SecaoPacotes() {
  const repositorio = await obterRepositorioModulo();
  const pacotes = await repositorio.listarPacotesComVersoes();

  if (pacotes.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum pacote visível"
        texto="Pacotes e preços aparecem aqui só para a diretoria (PRD 13)."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pacotes.map((pacote) => {
        const vigente =
          pacote.versoes.find((v) => v.vigenciaFim === null) ?? null;
        const anteriores = pacote.versoes.filter((v) => v.vigenciaFim !== null);
        return (
          <Cartao key={pacote.id} variante="plano">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {/* "gemelar" fica na linha de apoio, não dentro do título:
                    no h3 ele colava no nome ("Gemelar Essencialgemelar") e
                    virava o nome acessível do cartão. */}
                <h3 className="text-3 text-texto font-semibold">
                  {pacote.nome}
                </h3>
                <p className="text-apoio text-texto-2">
                  {pacote.dias} dias
                  {pacote.gemelar ? " · gemelar" : ""} ·{" "}
                  {pacote.linha ?? "sem linha definida"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {pacote.ativo ? (
                  <Selo variante="sucesso">Ativo</Selo>
                ) : (
                  <Selo variante="neutro">Desativado</Selo>
                )}
                <AlternarPacoteAtivo
                  pacoteId={pacote.id}
                  ativo={pacote.ativo}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {vigente ? (
                <p className="text-corpo text-texto">
                  <span className="font-mono font-semibold">
                    {formatarMoeda(vigente.valorCentavos)}
                  </span>{" "}
                  <span className="text-texto-2">
                    vigente desde {formatarData(vigente.vigenciaInicio)}, em até{" "}
                    {vigente.parcelasMaxSemJuros}x sem juros
                  </span>
                </p>
              ) : (
                <p className="text-apoio text-texto-2">
                  Nenhuma versão de preço vigente.
                </p>
              )}
              <FormularioNovaVersao
                pacoteId={pacote.id}
                nomePacote={pacote.nome}
                versaoAtual={vigente}
              />
            </div>

            {anteriores.length > 0 ? (
              <details className="mt-3">
                <summary className="text-apoio text-texto-2 cursor-pointer">
                  {anteriores.length} versão(ões) anterior(es)
                </summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {anteriores
                    .sort((a, b) =>
                      b.vigenciaInicio.localeCompare(a.vigenciaInicio),
                    )
                    .map((v) => (
                      <li
                        key={v.id}
                        className="text-apoio text-texto-2 font-mono"
                      >
                        {formatarMoeda(v.valorCentavos)} de{" "}
                        {formatarData(v.vigenciaInicio)} a{" "}
                        {formatarData(v.vigenciaFim!)}
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </Cartao>
        );
      })}
    </div>
  );
}
