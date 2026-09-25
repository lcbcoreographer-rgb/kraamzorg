import { Cartao } from "@/components/ui/cartao";
import { obterRepositorioModulo } from "../dados";
import { FormularioFaixa } from "./formulario-faixa";

function descreverSemanas(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Já nasceu";
  if (min === null) return `Até ${max} semanas`;
  if (max === null) return `${min} semanas ou mais`;
  return `${min} a ${max} semanas`;
}

/** Faixas da régua (P13, "Fazer" item 7; PRD 10.3): objetivo, gatilho e mensagem. */
export async function SecaoRegua() {
  const repositorio = await obterRepositorioModulo();
  const [faixas, mensagens] = await Promise.all([
    repositorio.listarFaixasRegua(),
    repositorio.listarMensagensDetalhe(),
  ]);
  const opcoesMensagem = mensagens
    .filter((m) => m.destinatario === "familia")
    .map((m) => ({ valor: m.chave, rotulo: m.chave }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-apoio text-texto-2 max-w-leitura">
        Uma tarefa por família a cada mudança de faixa, nunca repetida na mesma
        semana. O texto sugerido vem da mensagem escolhida aqui; o comercial
        pode editar antes de enviar (PRD 10.3).
      </p>
      {faixas.map((faixa) => (
        <Cartao key={faixa.id} variante="plano">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-3 text-texto font-semibold">
                Faixa {faixa.ordem}:{" "}
                {descreverSemanas(faixa.semanaMin, faixa.semanaMax)}
              </h3>
              <p className="text-corpo text-texto mt-1">{faixa.objetivo}</p>
              <p className="text-apoio text-texto-2 mt-1">
                Gatilho comercial: {faixa.gatilhoComercial}
              </p>
              <p className="text-apoio text-texto-2 mt-1">
                Mensagem:{" "}
                <span className="font-mono">{faixa.mensagemChave}</span>
              </p>
            </div>
            <FormularioFaixa faixa={faixa} opcoesMensagem={opcoesMensagem} />
          </div>
        </Cartao>
      ))}
    </div>
  );
}
