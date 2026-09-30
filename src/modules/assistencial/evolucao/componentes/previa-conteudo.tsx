import type { ConteudoEvolucao } from "@/lib/pdf";

/**
 * O documento como o médico vai ler: as seções montadas de
 * `relatorio_medico.conteudo`, sem edição. O texto já saiu de `mensagem_modelo`
 * e dos dados do período; aqui só se mostra.
 */
export function PreviaConteudo({ conteudo }: { conteudo: ConteudoEvolucao }) {
  return (
    <div className="flex flex-col gap-5">
      {conteudo.secoes.map((secao) => (
        <section key={secao.titulo} className="flex flex-col gap-2">
          <h3 className="text-3 text-texto font-semibold">{secao.titulo}</h3>
          {secao.blocos.map((bloco, i) => {
            if (bloco.tipo === "paragrafo") {
              return (
                <p key={i} className="text-corpo text-texto">
                  {bloco.texto}
                </p>
              );
            }
            if (bloco.tipo === "campo") {
              return (
                <p key={i} className="text-corpo text-texto">
                  <span className="text-texto-2">{bloco.rotulo}: </span>
                  {bloco.valor}
                </p>
              );
            }
            return (
              <ul
                key={i}
                className="text-corpo text-texto flex list-disc flex-col gap-1 pl-5"
              >
                {bloco.itens.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          })}
        </section>
      ))}
      <p className="text-apoio text-texto-2">
        {conteudo.assinatura.nome}, {conteudo.assinatura.especialidade},{" "}
        {conteudo.assinatura.conselho}-{conteudo.assinatura.conselhoUf}{" "}
        {conteudo.assinatura.conselhoNumero}
      </p>
    </div>
  );
}
