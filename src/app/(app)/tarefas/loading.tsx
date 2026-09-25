import { CabecalhoTela } from "@/components/shell/cabecalho-tela";

/**
 * Carregando (P18): mesmo cabeçalho da tela e três cartões vazios no lugar
 * das tarefas, para a página não pular quando a lista chegar.
 */
export default function CarregandoTarefas() {
  return (
    <>
      <CabecalhoTela
        titulo="Tarefas"
        subtitulo="Por prioridade e prazo, com o texto sugerido pronto para editar."
      />
      <div
        className="flex flex-col gap-3 pt-6"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Carregando as tarefas</span>
        {[0, 1, 2].map((indice) => (
          <div
            key={indice}
            aria-hidden="true"
            className="bg-superficie border-linha rounded-2 h-32 animate-pulse border motion-reduce:animate-none"
          />
        ))}
      </div>
    </>
  );
}
