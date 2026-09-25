import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { descreverPapeis } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { UsuarioSistema } from "@/lib/dados/tipos";
import { formatarDataHora } from "@/lib/formatacao";
import { RevogarSessoes } from "./revogar";

export const metadata: Metadata = { title: "Sessões e acessos · Kraamzorg OS" };

/**
 * Sessões e acessos da diretoria (P07 item 7; PRD 21.2: controle de sessão
 * e revogação remota). Lista quem tem acesso, com papéis e último acesso,
 * e encerra todas as sessões de uma pessoa. O convite de pessoa nova fica
 * em /convidar.
 */
export default async function PaginaSessoes() {
  await exigirSessao("/sessoes");
  let usuarios: UsuarioSistema[] = [];
  let falhou = false;
  try {
    usuarios = await (await obterRepositorios()).usuarios.listarUsuarios();
  } catch {
    falhou = true;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Sessões e acessos"
        lateral={
          <Botao asChild variante="secundario" tamanho="compacto">
            <Link href="/convidar">
              <UserPlus
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Convidar pessoa
            </Link>
          </Botao>
        }
      />
      <p className="text-apoio text-texto-2 max-w-leitura mt-3">
        Quem tem acesso ao sistema, com os papéis e o último acesso. Encerrar as
        sessões tira a pessoa de todos os aparelhos na hora.
      </p>

      <div className="pt-6">
        {falhou ? (
          <FaixaAlerta
            variante="imediato"
            titulo="Não foi possível carregar a lista agora"
          >
            Confira a conexão e recarregue a página. Se continuar, avise a
            equipe técnica.
          </FaixaAlerta>
        ) : usuarios.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h2"
            titulo="Ninguém tem acesso ainda"
            texto="Cada pessoa entra por convite da diretoria, com o papel certo. Comece convidando quem vai usar o sistema."
            acao={
              <Botao asChild variante="secundario" tamanho="compacto">
                <Link href="/convidar">Convidar pessoa</Link>
              </Botao>
            }
          />
        ) : (
          <TabelaLista
            rotulo="Pessoas com acesso ao sistema"
            colunas={[
              { chave: "pessoa", rotulo: "Pessoa", principal: true },
              { chave: "situacao", rotulo: "Situação", canto: true },
              { chave: "papeis", rotulo: "Papéis" },
              { chave: "acesso", rotulo: "Último acesso", numerica: true },
              { chave: "acao", rotulo: "Sessões" },
            ]}
            linhas={usuarios.map((u) => ({
              id: u.id,
              valores: {
                pessoa: (
                  <span className="flex flex-col">
                    <span className="text-texto font-semibold">{u.nome}</span>
                    <span className="text-apoio text-texto-2 font-normal [overflow-wrap:anywhere]">
                      {u.email}
                    </span>
                  </span>
                ),
                situacao: u.ativo ? (
                  <Selo variante="sucesso">Ativo</Selo>
                ) : (
                  <Selo variante="neutro">Desativado</Selo>
                ),
                papeis: u.papeis.length
                  ? descreverPapeis(u.papeis)
                  : "Sem papel",
                acesso: u.ultimoAcessoEm ? (
                  <span className="font-mono">
                    {formatarDataHora(u.ultimoAcessoEm)}
                  </span>
                ) : (
                  "Nunca entrou"
                ),
                acao: <RevogarSessoes usuarioId={u.id} nome={u.nome} />,
              },
            }))}
          />
        )}
      </div>
    </>
  );
}
