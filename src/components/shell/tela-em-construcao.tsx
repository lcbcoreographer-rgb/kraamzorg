import Link from "next/link";
import type { ReactNode } from "react";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { CabecalhoTela } from "./cabecalho-tela";

/**
 * Rota criada pela casca (P10) e ainda sem o conteúdo do módulo dono.
 * Mostra o título da tela e um estado vazio que diz o que vai aparecer ali
 * e qual é a próxima ação possível hoje (PRD 20.4: estado vazio ensina).
 * O módulo dono troca este componente pelo conteúdo real, na própria
 * pasta, sem mexer na casca.
 */
export function TelaEmConstrucao({
  titulo,
  tituloVazio,
  texto,
  acao,
}: {
  titulo: string;
  tituloVazio: string;
  texto: ReactNode;
  acao?: { rotulo: string; href: string };
}) {
  return (
    <>
      <CabecalhoTela titulo={titulo} />
      <div className="pt-6">
        <EstadoVazio
          nivelTitulo="h2"
          titulo={tituloVazio}
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
