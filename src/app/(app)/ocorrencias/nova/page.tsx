import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { FormOcorrencia } from "@/modules/operacao/ocorrencias/componentes/form-ocorrencia";

export const metadata: Metadata = { title: "Nova ocorrência · Kraamzorg OS" };

/** Abrir uma ocorrência (P42). Coordenação e diretoria. */
export default async function PaginaNovaOcorrencia({
  searchParams,
}: {
  searchParams: Promise<{ familia?: string }>;
}) {
  const { familia } = await searchParams;
  const usuario = await exigirSessao("/ocorrencias");
  const podeAbrir =
    usuario.papeis.includes("coordenacao") ||
    usuario.papeis.includes("diretoria");

  const voltar = (
    <Link
      href="/ocorrencias"
      className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Ocorrências
    </Link>
  );

  if (!podeAbrir) {
    return (
      <>
        {voltar}
        <FaixaAlerta
          variante="info"
          titulo="Abrir ocorrência é da coordenação e da diretoria"
        >
          Se você viu algo que precisa de atenção, avise a coordenação.
        </FaixaAlerta>
      </>
    );
  }

  let dados: {
    familias: { valor: string; rotulo: string }[];
    profissionais: { valor: string; rotulo: string }[];
    responsaveis: { valor: string; rotulo: string }[];
  } | null = null;
  try {
    const repos = await obterRepositorios();
    const [familias, equipe, responsaveis] = await Promise.all([
      repos.familias.listarFamilias({ limite: 300 }),
      repos.equipe.obterEquipe(),
      repos.ocorrencias.responsaveis(),
    ]);
    dados = {
      familias: familias.map((f) => ({ valor: f.id, rotulo: f.nome })),
      profissionais: equipe.profissionais.map((p) => ({
        valor: p.id,
        rotulo: p.nome,
      })),
      responsaveis: responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome })),
    };
  } catch {
    dados = null;
  }
  const familiaInicial = z.uuid().safeParse(familia).success
    ? familia
    : undefined;

  return (
    <>
      {voltar}
      <div className="flex flex-col gap-6 pt-2">
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          Abrir uma ocorrência
        </h1>
        {dados ? (
          <FormOcorrencia
            familias={dados.familias}
            profissionais={dados.profissionais}
            responsaveis={dados.responsaveis}
            familiaInicial={familiaInicial}
          />
        ) : (
          <FaixaAlerta variante="erro" titulo="O formulário não abriu agora">
            Confira a conexão e recarregue a página. Nada foi alterado.
          </FaixaAlerta>
        )}
      </div>
    </>
  );
}
