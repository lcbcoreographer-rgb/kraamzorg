import { Selo } from "@/components/ui/selo";
import type { EstadoProfissional } from "@/lib/dados/tipos-equipe";
import { cn } from "@/lib/utils";
import { EXPLICACAO_ESTADO, ROTULO_ESTADO } from "../textos";

/**
 * Selo do estado da profissional (fluxo C, docs/design/fluxos.md): a forma e
 * a palavra dizem o estado, nunca só a cor. Em visita é marinho cheio; em
 * atendimento, neutro; reservada é hachura (provável, ainda não é fato);
 * backup é contorno tracejado; oferta pendente é o dourado com texto
 * marinho; folga é areia; livre é neutro claro. O estado vem sempre
 * calculado do banco, nenhuma tela oferece marcar à mão.
 */
export function SeloEstadoProfissional({
  estado,
  className,
}: {
  estado: EstadoProfissional;
  className?: string;
}) {
  const rotulo = ROTULO_ESTADO[estado];
  const dica = EXPLICACAO_ESTADO[estado];
  switch (estado) {
    case "em_visita":
      return (
        <Selo variante="marinho" title={dica} className={className}>
          {rotulo}
        </Selo>
      );
    case "em_atendimento":
      return (
        <Selo variante="neutro" title={dica} className={className}>
          {rotulo}
        </Selo>
      );
    case "reservada":
      return (
        <Selo
          variante="neutro"
          title={dica}
          className={cn(
            "bg-hachura-aviso border-aviso-borda text-aviso-texto border-[1.5px]",
            className,
          )}
        >
          {rotulo}
        </Selo>
      );
    case "backup":
      return (
        <Selo variante="contorno" title={dica} className={className}>
          {rotulo}
        </Selo>
      );
    case "oferta_pendente":
      return (
        <Selo variante="destaque" title={dica} className={className}>
          {rotulo}
        </Selo>
      );
    case "folga":
      return (
        <Selo
          variante="neutro"
          title={dica}
          className={cn("bg-areia", className)}
        >
          {rotulo}
        </Selo>
      );
    case "livre":
      return (
        <Selo
          variante="neutro"
          title={dica}
          className={cn("bg-superficie border-linha border", className)}
        >
          {rotulo}
        </Selo>
      );
  }
}
