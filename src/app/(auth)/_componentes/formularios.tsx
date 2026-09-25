"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaMultipla } from "@/components/ui/escolha-multipla";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import {
  descreverPapeis,
  PAPEIS,
  PAPEIS_COM_MFA,
  ROTULO_PAPEL,
} from "@/lib/auth/papeis";
import {
  confirmarCadastroMfa,
  convidarPessoa,
  definirSenha,
  entrarComSenha,
  pedirRecuperacao,
  verificarMfa,
  type EstadoFormulario,
} from "../acoes";
import { SEM_SINAL_ACESSO, SEM_SINAL_ENTRAR } from "../mensagens";

/**
 * Formulários das telas de acesso. Todos seguem o protótipo entrar.html:
 * rótulo em cima, erro abaixo do campo com ícone, botão principal de bloco
 * com o gerúndio enquanto envia ("Entrando"), e a faixa de erro geral no
 * topo do formulário quando o problema não é de um campo só.
 */

const inicial: EstadoFormulario = {};

function ErroGeral({
  estado,
  semSinal,
}: {
  estado: EstadoFormulario;
  semSinal?: string | null;
}) {
  const erro = semSinal ?? estado.erro;
  if (!erro) return null;
  return <FaixaAlerta variante="imediato" titulo={erro} anunciar />;
}

/**
 * Sem conexão, o envio nem sai: a faixa explica que é preciso sinal
 * (telas.md, C7). O onSubmit só barra quando o navegador sabe que está sem
 * rede; sem JavaScript o formulário segue a Server Action normalmente.
 */
function useSemSinal(frase: string) {
  const [semSinal, setSemSinal] = useState<string | null>(null);
  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      evento.preventDefault();
      setSemSinal(frase);
      return;
    }
    setSemSinal(null);
  }
  return { semSinal, aoEnviar };
}

function CampoSenha({
  nome,
  rotulo,
  erro,
  autoComplete,
}: {
  nome: string;
  rotulo: string;
  erro?: string;
  autoComplete: "current-password" | "new-password";
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <CampoTexto
      rotulo={rotulo}
      name={nome}
      type={visivel ? "text" : "password"}
      autoComplete={autoComplete}
      erro={erro}
      required
      acessorio={
        <button
          type="button"
          aria-pressed={visivel}
          aria-label={
            visivel
              ? `Ocultar ${rotulo.toLowerCase()}`
              : `Mostrar ${rotulo.toLowerCase()}`
          }
          onClick={() => setVisivel((v) => !v)}
          className="rounded-2 text-apoio text-texto-2 hover:text-texto min-h-toque shrink-0 px-4 font-semibold"
        >
          {visivel ? "Ocultar" : "Mostrar"}
        </button>
      }
    />
  );
}

export function FormularioEntrar({ proximo }: { proximo?: string }) {
  const [estado, acao, enviando] = useActionState(entrarComSenha, inicial);
  const { semSinal, aoEnviar } = useSemSinal(SEM_SINAL_ENTRAR);
  return (
    <form
      action={acao}
      onSubmit={aoEnviar}
      className="flex flex-col gap-6"
      noValidate
    >
      <ErroGeral estado={estado} semSinal={semSinal} />
      {proximo ? <input type="hidden" name="proximo" value={proximo} /> : null}
      <CampoTexto
        rotulo="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        placeholder="nome@exemplo.com.br"
        erro={estado.errosCampo?.email}
        required
      />
      <CampoSenha
        nome="senha"
        rotulo="Senha"
        autoComplete="current-password"
        erro={estado.errosCampo?.senha}
      />
      <Botao
        type="submit"
        largaTotal
        carregando={enviando}
        rotuloCarregando="Entrando"
      >
        Entrar
      </Botao>
      <Botao
        asChild
        variante="fantasma"
        tamanho="compacto"
        className="-ml-3 self-start"
      >
        <Link href="/esqueci-senha">Esqueci a senha</Link>
      </Botao>
    </form>
  );
}

function CampoCodigo({ erro, ajuda }: { erro?: string; ajuda: string }) {
  return (
    <CampoTexto
      rotulo="Código"
      name="codigo"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      descricao={ajuda}
      erro={erro}
      className="text-1 text-center font-mono tracking-[0.4em]"
      required
      autoFocus
    />
  );
}

export function FormularioDesafio({ proximo }: { proximo?: string }) {
  const [estado, acao, enviando] = useActionState(verificarMfa, inicial);
  const { semSinal, aoEnviar } = useSemSinal(SEM_SINAL_ACESSO);
  return (
    <form
      action={acao}
      onSubmit={aoEnviar}
      className="flex flex-col gap-6"
      noValidate
    >
      <ErroGeral estado={estado} semSinal={semSinal} />
      {proximo ? <input type="hidden" name="proximo" value={proximo} /> : null}
      <CampoCodigo
        erro={estado.errosCampo?.codigo}
        ajuda="O código muda a cada 30 segundos."
      />
      <Botao
        type="submit"
        largaTotal
        carregando={enviando}
        rotuloCarregando="Conferindo"
      >
        Confirmar e entrar
      </Botao>
    </form>
  );
}

export function FormularioCadastroMfa({
  fatorId,
  proximo,
}: {
  fatorId: string;
  proximo?: string;
}) {
  const [estado, acao, enviando] = useActionState(
    confirmarCadastroMfa,
    inicial,
  );
  const { semSinal, aoEnviar } = useSemSinal(SEM_SINAL_ACESSO);
  return (
    <form
      action={acao}
      onSubmit={aoEnviar}
      className="flex flex-col gap-6"
      noValidate
    >
      <ErroGeral estado={estado} semSinal={semSinal} />
      <input type="hidden" name="fatorId" value={fatorId} />
      {proximo ? <input type="hidden" name="proximo" value={proximo} /> : null}
      <CampoCodigo
        erro={estado.errosCampo?.codigo}
        ajuda="Digite o código de 6 números que o aplicativo mostra agora."
      />
      <Botao
        type="submit"
        largaTotal
        carregando={enviando}
        rotuloCarregando="Conferindo"
      >
        Confirmar código
      </Botao>
    </form>
  );
}

export function FormularioRecuperacao() {
  const [estado, acao, enviando] = useActionState(pedirRecuperacao, inicial);
  const { semSinal, aoEnviar } = useSemSinal(SEM_SINAL_ACESSO);
  if (estado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <FaixaAlerta variante="sucesso" titulo="Pedido recebido" anunciar>
          {estado.sucesso}
        </FaixaAlerta>
        <VoltarParaEntrar />
      </div>
    );
  }
  return (
    <form
      action={acao}
      onSubmit={aoEnviar}
      className="flex flex-col gap-6"
      noValidate
    >
      <ErroGeral estado={estado} semSinal={semSinal} />
      <CampoTexto
        rotulo="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        placeholder="nome@exemplo.com.br"
        erro={estado.errosCampo?.email}
        required
      />
      <Botao
        type="submit"
        largaTotal
        carregando={enviando}
        rotuloCarregando="Enviando"
      >
        Enviar link para criar senha
      </Botao>
      <VoltarParaEntrar />
    </form>
  );
}

export function FormularioDefinirSenha() {
  const [estado, acao, enviando] = useActionState(definirSenha, inicial);
  const { semSinal, aoEnviar } = useSemSinal(SEM_SINAL_ACESSO);
  return (
    <form
      action={acao}
      onSubmit={aoEnviar}
      className="flex flex-col gap-6"
      noValidate
    >
      <ErroGeral estado={estado} semSinal={semSinal} />
      <CampoSenha
        nome="senha"
        rotulo="Senha nova"
        autoComplete="new-password"
        erro={estado.errosCampo?.senha}
      />
      <CampoSenha
        nome="confirmacao"
        rotulo="Repita a senha nova"
        autoComplete="new-password"
        erro={estado.errosCampo?.confirmacao}
      />
      <Botao
        type="submit"
        largaTotal
        carregando={enviando}
        rotuloCarregando="Salvando"
      >
        Salvar senha
      </Botao>
    </form>
  );
}

export function FormularioConvite() {
  const [estado, acao, enviando] = useActionState(convidarPessoa, inicial);
  const { semSinal, aoEnviar } = useSemSinal(SEM_SINAL_ACESSO);
  return (
    <form
      action={acao}
      onSubmit={aoEnviar}
      className="flex flex-col gap-6"
      noValidate
    >
      <ErroGeral estado={estado} semSinal={semSinal} />
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo="Convite enviado" anunciar>
          {estado.sucesso}
        </FaixaAlerta>
      ) : null}
      <CampoTexto
        rotulo="Nome completo"
        name="nome"
        autoComplete="off"
        erro={estado.errosCampo?.nome}
        required
      />
      <CampoTexto
        rotulo="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="off"
        placeholder="nome@exemplo.com.br"
        erro={estado.errosCampo?.email}
        required
      />
      <EscolhaMultipla
        rotulo="Papéis"
        descricao={`Uma pessoa pode ter mais de um papel. ${descreverPapeis(PAPEIS_COM_MFA)} entram sempre com o código do aplicativo.`}
        name="papeis"
        opcoes={PAPEIS.map((papel) => ({
          valor: papel,
          rotulo: ROTULO_PAPEL[papel],
        }))}
        erro={estado.errosCampo?.papeis}
      />
      <Botao
        type="submit"
        largaTotal
        carregando={enviando}
        rotuloCarregando="Enviando convite"
      >
        Enviar convite
      </Botao>
    </form>
  );
}

export function VoltarParaEntrar() {
  return (
    <Botao
      asChild
      variante="fantasma"
      tamanho="compacto"
      className="-ml-3 self-start"
    >
      <Link href="/entrar">
        <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={1.75} />
        Voltar para entrar
      </Link>
    </Botao>
  );
}
