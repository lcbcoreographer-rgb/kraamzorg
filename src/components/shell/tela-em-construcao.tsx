import Link from "next/link";
import type { ReactNode } from "react";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { CabecalhoTela } from "./cabecalho-tela";

/** Título fixo do estado "ainda em construção" (DESIGN.md, 11.7). */
export const TITULO_EM_CONSTRUCAO = "Esta parte ainda está em construção.";

/**
 * Rota criada pela casca (P10) e ainda sem o conteúdo do módulo dono.
 * Estado vazio do tipo "ainda em construção" (DESIGN.md, 11.7): o título é
 * sempre o mesmo, e o texto diz o que a pessoa vai ter ali ("Aqui você vai
 * ver ..."), no máximo três coisas, sem nomear componente da tela. O
 * módulo dono troca este componente pelo conteúdo real, na própria pasta,
 * sem mexer na casca.
 */
export function TelaEmConstrucao({
  titulo,
  texto,
  acao,
  abertura,
  subtitulo,
}: {
  titulo: string;
  texto: ReactNode;
  acao?: { rotulo: string; href: string };
  /** Tela de abertura do dia (o título é o dia, DESIGN.md 11.4). */
  abertura?: boolean;
  subtitulo?: ReactNode;
}) {
  return (
    <>
      <CabecalhoTela
        titulo={titulo}
        abertura={abertura}
        subtitulo={subtitulo}
      />
      <div className="pt-6">
        <EstadoVazio
          nivelTitulo="h2"
          titulo={TITULO_EM_CONSTRUCAO}
          texto={texto}
          acao={
            acao ? (
              <Botao asChild variante="secundario" tamanho="compacto">
                <Link href={acao.href}>{acao.rotulo}</Link>
              </Botao>
            ) : undefined
          }
        />
      </div>
    </>
  );
}
