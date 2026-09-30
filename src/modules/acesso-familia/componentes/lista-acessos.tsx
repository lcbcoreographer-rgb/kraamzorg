"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import { Selo } from "@/components/ui/selo";
import type { FamiliaAcessoPortal } from "@/lib/dados/tipos-relacao";
import { formatarDataHora } from "@/lib/formatacao";
import { ROTULO_PAPEL_PESSOA } from "@/modules/crm/pipeline/estagios";
import { acaoLiberarAcesso, acaoSuspenderAcesso } from "../acoes";

/**
 * Quem da família entra no portal (P49). Uma ação por pessoa: liberar cria
 * a tarefa do convite (que respeita o freio), suspender fecha na hora.
 * Família em estado sensível não recebe convite; a tela diz por quê.
 */
export function ListaAcessos({
  familias,
}: {
  familias: FamiliaAcessoPortal[];
}) {
  const [aviso, definirAviso] = React.useState<{
    erro?: string;
    sucesso?: string;
  }>({});
  const [ocupada, iniciar] = React.useTransition();

  function agir(
    acao: (id: string) => Promise<{ erro?: string; sucesso?: string }>,
    pessoaId: string,
  ) {
    iniciar(async () => {
      definirAviso(await acao(pessoaId));
    });
  }

  if (familias.length === 0) {
    return (
      <p className="text-corpo text-texto-2 max-w-[60ch]">
        Nenhuma família com contrato assinado ainda. Quando o contrato for
        assinado, a família aparece aqui para você liberar o portal.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p
        role="status"
        aria-live="polite"
        className="text-corpo text-texto min-h-6"
        data-teste="aviso-acesso"
      >
        {aviso.erro ?? aviso.sucesso ?? ""}
      </p>
      <ul className="flex flex-col gap-4">
        {familias.map((f) => {
          const sensivel =
            f.estadoSensivel === "bloqueio_total" ||
            f.estadoSensivel === "encerrado_sensivel";
          return (
            <li
              key={f.familiaId}
              className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5"
              data-familia={f.nomeExibicao}
            >
              <h3 className="font-titulo text-2 text-texto font-medium">
                {f.nomeExibicao}
              </h3>
              {sensivel ? (
                <p className="text-corpo text-texto-2 max-w-[56ch]">
                  Esta família está em um momento sensível. Nenhum convite sai;
                  quem entrar no portal vê só o contato de uma pessoa da equipe.
                </p>
              ) : null}
              <ul className="flex flex-col gap-3">
                {f.pessoas.map((p) => (
                  <li
                    key={p.pessoaId}
                    className="border-linha flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3"
                  >
                    <span className="text-corpo text-texto min-w-[9rem]">
                      {p.primeiroNome}
                      <span className="text-texto-2">
                        {" "}
                        (
                        {ROTULO_PAPEL_PESSOA[
                          p.papel as keyof typeof ROTULO_PAPEL_PESSOA
                        ] ?? p.papel}
                        )
                      </span>
                    </span>
                    <Selo
                      variante={
                        p.situacao === "liberado"
                          ? "sucesso"
                          : p.situacao === "suspenso"
                            ? "aviso"
                            : "neutro"
                      }
                    >
                      {p.situacao === "liberado"
                        ? "Acesso liberado"
                        : p.situacao === "suspenso"
                          ? "Acesso suspenso"
                          : "Sem acesso"}
                    </Selo>
                    {p.situacao === "liberado" ? (
                      <span className="text-apoio text-texto-2">
                        {p.entrou && p.ultimoAcessoEm
                          ? `Último acesso em ${formatarDataHora(p.ultimoAcessoEm)}`
                          : "Ainda não entrou"}
                      </span>
                    ) : null}
                    {!p.temEmail ? (
                      <span className="text-apoio text-texto-2">
                        Sem e-mail no cadastro
                      </span>
                    ) : null}
                    <span className="ml-auto flex gap-2">
                      {p.situacao === "liberado" ? (
                        <Botao
                          type="button"
                          variante="secundario"
                          tamanho="compacto"
                          disabled={ocupada}
                          aria-label={`Suspender o acesso de ${p.primeiroNome}`}
                          onClick={() => agir(acaoSuspenderAcesso, p.pessoaId)}
                        >
                          Suspender
                        </Botao>
                      ) : (
                        <Botao
                          type="button"
                          variante="primario"
                          tamanho="compacto"
                          disabled={ocupada || !p.temEmail || sensivel}
                          aria-label={`Liberar o portal para ${p.primeiroNome}`}
                          onClick={() => agir(acaoLiberarAcesso, p.pessoaId)}
                        >
                          {p.situacao === "suspenso"
                            ? "Liberar de novo"
                            : "Liberar o portal"}
                        </Botao>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
