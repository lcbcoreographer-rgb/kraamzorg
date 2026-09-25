"use client";

import * as React from "react";
import {
  Bot,
  CalendarDays,
  Hand,
  House,
  Kanban,
  LayoutDashboard,
  MapPin,
  PhoneCall,
  Radar,
  Siren,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";

import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { CampoNumero } from "@/components/ui/campo-numero";
import { SimNao } from "@/components/ui/sim-nao";
import { Escala0a10 } from "@/components/ui/escala-0-a-10";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { EscolhaMultipla } from "@/components/ui/escolha-multipla";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import {
  IndicadorSincronizacao,
  type EstadoSincronizacao,
} from "@/components/ui/indicador-sincronizacao";
import { ReguaDias, type DiaRegua } from "@/components/ui/regua-dias";
import { CabecalhoFamilia } from "@/components/ui/cabecalho-familia";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoGatilho,
  DialogoRodape,
} from "@/components/ui/dialogo";
import {
  PainelLateral,
  PainelLateralConteudo,
  PainelLateralGatilho,
} from "@/components/ui/painel-lateral";
import {
  TabelaLista,
  type ColunaTabela,
  type LinhaTabela,
} from "@/components/ui/tabela-lista";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import {
  AbasInferiores,
  type ItemAbaInferior,
} from "@/components/ui/abas-inferiores";
import {
  BarraLateral,
  type GrupoBarraLateral,
} from "@/components/ui/barra-lateral";
import {
  formatarData,
  formatarDataHora,
  formatarIdadeGestacional,
  formatarMoeda,
  formatarTelefone,
} from "@/lib/formatacao";

function Secao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-linha flex flex-col gap-5 border-b py-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-titulo text-2 text-texto font-medium">
          {titulo}
        </h2>
        {descricao ? (
          <p className="text-apoio text-texto-2 max-w-[64ch]">{descricao}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Amostra({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"flex flex-wrap items-center gap-3 " + (className ?? "")}>
      {children}
    </div>
  );
}

const CORES_PRIMITIVAS = [
  { nome: "marinho", classe: "bg-marinho" },
  { nome: "dourado", classe: "bg-dourado" },
  { nome: "areia", classe: "bg-areia" },
  { nome: "creme", classe: "bg-creme" },
  { nome: "branco", classe: "bg-branco" },
  { nome: "sucesso", classe: "bg-sucesso" },
  { nome: "aviso", classe: "bg-aviso" },
  { nome: "alerta", classe: "bg-alerta" },
  { nome: "sensivel", classe: "bg-sensivel" },
] as const;

const CORES_DERIVADAS = [
  "marinho-72",
  "marinho-62",
  "marinho-50",
  "marinho-14",
  "marinho-08",
  "marinho-claro",
  "aviso-texto",
  "alerta-lavado",
  "aviso-lavado",
  "sucesso-lavado",
  "sensivel-lavado",
  "dourado-lavado",
] as const;

const ESTADOS_SINCRONIZACAO: { estado: EstadoSincronizacao; texto: string }[] =
  [
    { estado: "local", texto: "Salvo no aparelho" },
    { estado: "enviando", texto: "Enviando 3 respostas" },
    { estado: "sincronizado", texto: "Sincronizado 11:42" },
    { estado: "erro", texto: "Não enviou. Tentamos de novo em 30 s." },
  ];

const DIAS_REGUA: DiaRegua[] = [
  { numero: 1, rotuloData: "18/09", estado: "feito" },
  { numero: 2, rotuloData: "19/09", estado: "feito" },
  { numero: 3, rotuloData: "20/09", estado: "feito" },
  { numero: 4, rotuloData: "21/09", estado: "hoje" },
  { numero: 5, rotuloData: "22/09", estado: "pendente" },
  { numero: 6, rotuloData: "23/09", estado: "futuro" },
  { numero: 7, rotuloData: "24/09", estado: "futuro" },
  { numero: 8, rotuloData: "25/09", estado: "futuro" },
  { numero: 9, rotuloData: "26/09", estado: "alerta" },
  { numero: 10, rotuloData: "27/09", estado: "sensivel" },
  { numero: 11, rotuloData: "28/09", estado: "futuro" },
  { numero: 12, rotuloData: "29/09", estado: "futuro" },
];

const COLUNAS_TABELA: ColunaTabela[] = [
  { chave: "familia", rotulo: "Família", principal: true },
  { chave: "estado", rotulo: "Estado", canto: true },
  { chave: "ig", rotulo: "IG" },
  { chave: "bairro", rotulo: "Bairro" },
  { chave: "valor", rotulo: "Valor", numerica: true },
];

const LINHAS_TABELA: LinhaTabela[] = [
  {
    id: "aurora",
    valores: {
      familia: "Família Teste Aurora",
      estado: <Selo variante="sucesso">Em atendimento</Selo>,
      ig: formatarIdadeGestacional(38, 2),
      bairro: "Moema, São Paulo",
      valor: formatarMoeda(420000),
    },
  },
  {
    id: "brisa",
    valores: {
      familia: "Família Teste Brisa",
      estado: <Selo variante="sensivel">Freio ativo</Selo>,
      ig: formatarIdadeGestacional(40, 0),
      bairro: "Pinheiros, São Paulo",
      valor: formatarMoeda(560000),
    },
  },
  {
    id: "cedro",
    valores: {
      familia: "Família Teste Cedro",
      estado: <Selo variante="aviso">Pendente</Selo>,
      ig: formatarIdadeGestacional(36, 5),
      bairro: "Tatuapé, São Paulo",
      valor: formatarMoeda(143333),
    },
  },
];

const ITENS_ABAS: ItemAbaInferior[] = [
  { rotulo: "Hoje", href: "#", icone: <House />, ativo: true },
  { rotulo: "Famílias", href: "#", icone: <Users /> },
  { rotulo: "Alertas", href: "#", icone: <Siren />, contador: 2 },
  { rotulo: "Perfil", href: "#", icone: <UserRound /> },
];

const GRUPOS_LATERAL: GrupoBarraLateral[] = [
  {
    titulo: "Comercial",
    itens: [
      { rotulo: "Início", href: "#", icone: <House />, ativo: true },
      { rotulo: "Pipeline", href: "#", icone: <Kanban /> },
      { rotulo: "Famílias", href: "#", icone: <Users /> },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { rotulo: "Radar", href: "#", icone: <Radar /> },
      { rotulo: "Agenda", href: "#", icone: <CalendarDays /> },
      { rotulo: "Equipe", href: "#", icone: <UserCheck /> },
      {
        rotulo: "Alertas",
        href: "#",
        icone: <Siren />,
        contador: 2,
        contadorAlerta: true,
      },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      {
        rotulo: "Design system",
        href: "#",
        icone: <LayoutDashboard />,
        ativo: false,
      },
    ],
  },
];

export function VitrineDesignSystem() {
  const [respostaFebre, definirRespostaFebre] = React.useState<
    "sim" | "nao" | undefined
  >(undefined);
  const [respostaSangramento, definirRespostaSangramento] = React.useState<
    "sim" | "nao" | undefined
  >("sim");
  const [dor, definirDor] = React.useState<number | undefined>(4);
  const [tipoVisita, definirTipoVisita] = React.useState<string | undefined>(
    "presencial",
  );
  const [orientacoes, definirOrientacoes] = React.useState<string[]>([
    "amamentacao",
  ]);
  const [freioAtivo, definirFreioAtivo] = React.useState(false);
  const [tentativas, definirTentativas] = React.useState(0);

  return (
    <main className="max-w-conteudo mx-auto flex flex-col gap-0 px-4 pb-24 lg:px-8">
      <header className="flex flex-col gap-3 pt-8 pb-4 lg:pt-12">
        <p className="text-mini text-texto-2 font-mono">
          /design-system · fora do ar em produção
        </p>
        <h1 className="font-titulo text-display text-texto lg:text-display-lg">
          Caderneta de visita
        </h1>
        <p className="text-corpo text-texto-2 max-w-[64ch]">
          Componentes de src/components/ui com dados fictícios (famílias
          &ldquo;Família Teste&rdquo;, equipe com nome inventado, DESIGN.md
          seção 9). Tokens só de src/app/globals.css.
        </p>
      </header>

      <Secao
        id="s-cores"
        titulo="Cores"
        descricao="Primitivas da marca e derivadas (misturas fixas, nenhum matiz novo)."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CORES_PRIMITIVAS.map((cor) => (
            <div key={cor.nome} className="flex items-center gap-3">
              <span
                className={`rounded-2 border-linha size-12 shrink-0 border ${cor.classe}`}
              />
              <span className="text-apoio text-texto font-mono">
                {cor.nome}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CORES_DERIVADAS.map((nome) => (
            <div key={nome} className="flex items-center gap-3">
              <span
                className="rounded-2 border-linha size-12 shrink-0 border"
                style={{ background: `var(--color-${nome})` }}
              />
              <span className="text-mini text-texto-2 font-mono">{nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        id="s-tipografia"
        titulo="Tipografia"
        descricao="Jost nos títulos, Inter na interface, IBM Plex Mono em dado."
      >
        <div className="flex flex-col gap-3">
          <p className="font-titulo text-display text-texto">
            Hoje, quinta 24/09
          </p>
          <p className="font-titulo text-1 text-texto">Família Teste Aurora</p>
          <p className="font-titulo text-2 text-texto">Título de seção</p>
          <p className="text-3 text-texto font-semibold">
            Febre nas últimas 24 horas?
          </p>
          <p className="text-corpo text-texto">
            Texto de corpo em Inter, o que a maior parte da tela usa.
          </p>
          <p className="text-apoio text-texto-2">
            Rótulo e texto de apoio, 14 px.
          </p>
          <p className="text-dado text-texto font-mono">
            {formatarData("2026-09-24")} · {formatarIdadeGestacional(38, 2)} ·{" "}
            {formatarMoeda(420000)}
          </p>
        </div>
      </Secao>

      <Secao
        id="s-botao"
        titulo="Botão"
        descricao="Um primário por tela. Perigo só dentro de faixa clínica."
      >
        <Amostra>
          <Botao variante="primario">Assinar registro do D4</Botao>
          <Botao variante="secundario">Ver linha do tempo</Botao>
          <Botao variante="perigo">Ligar para a supervisão</Botao>
          <Botao variante="fantasma">Cancelar</Botao>
        </Amostra>
        <Amostra>
          <Botao tamanho="compacto" variante="secundario">
            Compacto
          </Botao>
          <Botao carregando rotuloCarregando="Assinando">
            Assinar
          </Botao>
          <Botao disabled variante="primario">
            Indisponível
          </Botao>
          <Botao
            iconeEsquerda={<PhoneCall className="size-4" aria-hidden="true" />}
            variante="secundario"
          >
            Ligar
          </Botao>
        </Amostra>
      </Secao>

      <Secao
        id="s-campos"
        titulo="Campos"
        descricao="Rótulo sempre visível; a ajuda mostra referência, nunca preenche."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <CampoTexto
            rotulo="Nome da família"
            placeholder="Ex: Família Teste Aurora"
            descricao="Como aparece na ficha e nas mensagens."
          />
          <CampoTexto
            rotulo="Telefone"
            defaultValue={formatarTelefone("+5511990000001")}
            descricao="Formato de exibição; grava em E.164."
          />
          <CampoTexto
            rotulo="Campo com erro"
            erro="8 bpm parece um dígito a menos. Confira e digite de novo."
            defaultValue="8"
          />
          <CampoTexto
            rotulo="Campo copiado"
            estado="copiado"
            defaultValue="36,8 °C"
            descricao="Copiado do D3. Confirme campo a campo."
          />
          <CampoTexto
            rotulo="Observações da visita"
            multilinha
            linhas={4}
            placeholder="Anotação livre sobre a visita de hoje"
            containerClassName="sm:col-span-2"
          />
          <CampoNumero
            rotulo="Temperatura"
            unidade="°C"
            min={34}
            max={42}
            step={0.1}
            defaultValue="36,8"
            descricao="Ontem: 36,6 °C."
          />
          <CampoNumero
            rotulo="Frequência cardíaca"
            unidade="bpm"
            min={40}
            max={220}
            defaultValue="78"
            estado="alerta-clinico"
            descricao="Acima da faixa esperada para a puérpera."
          />
        </div>
      </Secao>

      <Secao
        id="s-sim-nao"
        titulo="Sim ou não (um toque)"
        descricao="Sem valor padrão. Só a resposta que dispara regra pinta a pergunta de alerta."
      >
        <div className="flex max-w-xl flex-col">
          <SimNao
            pergunta="Febre nas últimas 24 horas?"
            name="febre"
            rotuloSim="Sim"
            rotuloNao="Não"
            valor={respostaFebre}
            onMudar={definirRespostaFebre}
          />
          <SimNao
            pergunta="Sangramento fora do esperado?"
            name="sangramento"
            rotuloSim="Sim"
            rotuloNao="Não"
            valor={respostaSangramento}
            onMudar={definirRespostaSangramento}
            estado={respostaSangramento === "sim" ? "alerta-clinico" : "normal"}
          />
        </div>
        {respostaSangramento === "sim" ? (
          <FaixaAlerta
            variante="imediato"
            codigo="PU-01"
            titulo="Sangramento fora do esperado na puérpera"
            acoes={
              <>
                <Botao asChild variante="perigo">
                  <a href="tel:+551140028922">Ligar para a supervisão</a>
                </Botao>
                <Botao variante="secundario">Registrar acionamento</Botao>
              </>
            }
          >
            Acione a supervisão médica agora e oriente a família a procurar
            atendimento de emergência.
          </FaixaAlerta>
        ) : null}
      </Secao>

      <Secao
        id="s-escala"
        titulo="Escala 0 a 10"
        descricao="Sem gradiente verde para vermelho: a escala não sugere resposta."
      >
        <div className="max-w-2xl">
          <Escala0a10
            rotulo="Dor agora"
            name="dor"
            valor={dor}
            onMudar={definirDor}
            extremoMin="0 · sem dor"
            extremoMax="10 · pior dor possível"
          />
        </div>
      </Secao>

      <Secao
        id="s-escolhas"
        titulo="Escolha única e múltipla"
        descricao="Pílulas tocáveis, 44 px no mínimo."
      >
        <div className="flex max-w-2xl flex-col gap-6">
          <EscolhaUnica
            rotulo="Tipo de visita"
            name="tipo-visita"
            valor={tipoVisita}
            onMudar={definirTipoVisita}
            opcoes={[
              { valor: "presencial", rotulo: "Presencial" },
              { valor: "video", rotulo: "Por vídeo" },
              { valor: "telefone", rotulo: "Por telefone" },
            ]}
          />
          <EscolhaMultipla
            rotulo="O que foi feito hoje"
            name="orientacoes"
            valores={orientacoes}
            onMudar={definirOrientacoes}
            opcoes={[
              { valor: "amamentacao", rotulo: "Amamentação" },
              { valor: "curativo", rotulo: "Curativo" },
              { valor: "sono", rotulo: "Orientação de sono" },
              { valor: "vinculo", rotulo: "Vínculo e humor" },
            ]}
          />
        </div>
      </Secao>

      <Secao
        id="s-cartao"
        titulo="Cartão"
        descricao="Branco, raio 20, sombra-1. Nunca cartão dentro de cartão."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Cartao>
            <p className="text-3 text-texto font-semibold">Cartão padrão</p>
            <p className="text-apoio text-texto-2 mt-1">
              Sombra-1, para conteúdo solto na tela.
            </p>
          </Cartao>
          <Cartao variante="plano">
            <p className="text-3 text-texto font-semibold">Cartão plano</p>
            <p className="text-apoio text-texto-2 mt-1">
              Borda fina, sem sombra.
            </p>
          </Cartao>
          <Cartao variante="areia">
            <p className="text-3 text-texto font-semibold">Cartão areia</p>
            <p className="text-apoio text-texto-2 mt-1">
              Superfície secundária.
            </p>
          </Cartao>
          <Cartao tocavel href="#s-cartao" className="sm:col-span-3">
            <p className="text-3 text-texto font-semibold">
              Cartão tocável (é um link)
            </p>
            <p className="text-apoio text-texto-2 mt-1">
              O cartão inteiro é o alvo de toque.
            </p>
          </Cartao>
        </div>
      </Secao>

      <Secao
        id="s-selo"
        titulo="Selo de estado"
        descricao="Sempre com texto. Destaque (dourado) só para oferta pendente ou quente."
      >
        <Amostra>
          <Selo variante="neutro">Rascunho</Selo>
          <Selo variante="sucesso">Sincronizado</Selo>
          <Selo variante="aviso">Prazo perto</Selo>
          <Selo variante="alerta">Alerta clínico</Selo>
          <Selo variante="sensivel">Estado sensível</Selo>
          <Selo variante="marinho">Em atendimento</Selo>
          <Selo variante="destaque">Oferta pendente</Selo>
          <Selo variante="contorno">Sem contato</Selo>
        </Amostra>
      </Secao>

      <Secao
        id="s-faixa"
        titulo="Faixa de alerta"
        descricao="Achado com o valor, conduta em frase completa, ações."
      >
        <div className="flex flex-col gap-4">
          <FaixaAlerta
            variante="imediato"
            codigo="PU-01"
            titulo="Febre de 38,2 °C na puérpera"
            acoes={
              <>
                <Botao asChild variante="perigo">
                  <a href="tel:+551140028922">Ligar para a supervisão</a>
                </Botao>
                <Botao variante="secundario">Registrar acionamento</Botao>
              </>
            }
          >
            Acione a supervisão médica agora e oriente a família a procurar
            atendimento de emergência.
          </FaixaAlerta>
          <FaixaAlerta
            variante="prioritario"
            titulo="Prazo de resposta perto do fim"
          >
            Restam 22 minutos para assumir esta transferência.
          </FaixaAlerta>
          <FaixaAlerta variante="sensivel" titulo="Freio em bloqueio total">
            Só contato humano e nominal. Nenhuma mensagem automática sai para
            esta família.
          </FaixaAlerta>
          <FaixaAlerta variante="info" titulo="Sem sinal agora">
            O registro está salvo no aparelho e sobe sozinho quando a conexão
            voltar.
          </FaixaAlerta>
          <FaixaAlerta variante="sucesso" titulo="Assinado às 11:42">
            Sobe quando houver sinal.
          </FaixaAlerta>
        </div>
      </Secao>

      <Secao
        id="s-sincronizacao"
        titulo="Indicador de sincronização"
        descricao="Três estados, mais o de falha com nova tentativa."
      >
        <Amostra>
          {ESTADOS_SINCRONIZACAO.map(({ estado, texto }) => (
            <IndicadorSincronizacao
              key={estado}
              estado={estado}
              texto={
                estado === "erro" && tentativas > 0
                  ? `${texto} (tentativa ${tentativas})`
                  : texto
              }
              aoTentarNovamente={
                estado === "erro"
                  ? () => definirTentativas((n) => n + 1)
                  : undefined
              }
              rotuloTentarNovamente="Tentar agora"
            />
          ))}
        </Amostra>
      </Secao>

      <Secao
        id="s-regua"
        titulo="Régua de dias"
        descricao="A forma assinatura da direção: D1 a D12, hoje com borda dourada."
      >
        <ReguaDias rotulo="Acompanhamento, D1 a D12" dias={DIAS_REGUA} />
        <div className="max-w-sm">
          <p className="text-apoio text-texto-2 mb-2">
            Versão fina (linha de lista, cartão):
          </p>
          <ReguaDias
            rotulo="Acompanhamento, versão fina"
            dias={DIAS_REGUA}
            fina
          />
        </div>
      </Secao>

      <Secao
        id="s-cabecalho-familia"
        titulo="Cabeçalho da família"
        descricao="Muda para ameixa inteira quando o freio está puxado."
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-3 border-linha overflow-hidden border">
            <CabecalhoFamilia
              nome="Família Teste Aurora"
              meta={
                <>
                  <Selo variante="marinho">Em atendimento</Selo>
                  <span className="font-semibold">D4 de 6</span>
                  <span>Moema, São Paulo</span>
                </>
              }
              datas={[
                {
                  rotulo: "DPP",
                  valor: formatarData("2026-09-25"),
                  tipo: "estimativa",
                },
                {
                  rotulo: "Nascimento",
                  valor: formatarData("2026-09-18"),
                  tipo: "fato",
                },
                {
                  rotulo: "Alta",
                  valor: formatarData("2026-09-20"),
                  tipo: "fato",
                },
                {
                  rotulo: "Início",
                  valor: formatarData("2026-09-21"),
                  tipo: "fato",
                },
              ]}
              freioAtivo={freioAtivo}
              textoFreioAtivo={`Freio em bloqueio total desde ${formatarDataHora("2026-09-24T12:14:00Z")}. Só contato humano e nominal.`}
              rotuloFreioAtivo="Freio ativo"
              acaoFreio={
                <Botao
                  variante="secundario"
                  tamanho="compacto"
                  iconeEsquerda={
                    <Hand className="size-[18px]" aria-hidden="true" />
                  }
                  onClick={() => definirFreioAtivo(true)}
                  aria-label="Acionar freio: pausa todas as mensagens automáticas para esta família"
                >
                  Freio
                </Botao>
              }
            />
          </div>
          {freioAtivo ? (
            <Botao
              variante="fantasma"
              className="self-start"
              onClick={() => definirFreioAtivo(false)}
            >
              Desfazer (só para este exemplo; reverter de verdade exige
              coordenação)
            </Botao>
          ) : null}
        </div>
      </Secao>

      <Secao
        id="s-dialogo"
        titulo="Diálogo"
        descricao="Folha inferior no celular, diálogo centralizado de 520 px no computador."
      >
        <Dialogo>
          <DialogoGatilho asChild>
            <Botao variante="secundario">Assinar registro do D4</Botao>
          </DialogoGatilho>
          <DialogoConteudo
            titulo="Assinar registro do D4"
            rotuloFechar="Fechar"
            descricao="Confirma que os dados desta visita estão completos."
          >
            <p className="text-corpo text-texto-2">
              Depois de assinado, o registro do D4 não pode ser apagado. Uma
              correção vira adendo.
            </p>
            <DialogoRodape>
              <DialogoFechar asChild>
                <Botao variante="secundario">Cancelar</Botao>
              </DialogoFechar>
              <DialogoFechar asChild>
                <Botao variante="primario">Assinar</Botao>
              </DialogoFechar>
            </DialogoRodape>
          </DialogoConteudo>
        </Dialogo>
      </Secao>

      <Secao
        id="s-painel-lateral"
        titulo="Painel lateral"
        descricao="Contexto sem sair da lista. Tela toda no celular, faixa fixa no computador."
      >
        <PainelLateral>
          <PainelLateralGatilho asChild>
            <Botao variante="secundario">Ver contexto da família</Botao>
          </PainelLateralGatilho>
          <PainelLateralConteudo
            titulo="Família Teste Aurora"
            rotuloFechar="Fechar"
          >
            <dl className="text-apoio flex flex-col gap-3">
              <div>
                <dt className="text-texto-2">Bairro</dt>
                <dd className="text-texto">Moema, São Paulo</dd>
              </div>
              <div>
                <dt className="text-texto-2">Telefone</dt>
                <dd className="text-texto font-mono">
                  {formatarTelefone("+5511990000001")}
                </dd>
              </div>
              <div>
                <dt className="text-texto-2">Pacote</dt>
                <dd className="text-texto">Essencial</dd>
              </div>
            </dl>
          </PainelLateralConteudo>
        </PainelLateral>
      </Secao>

      <Secao
        id="s-tabela"
        titulo="Tabela que vira lista"
        descricao="Tabela no computador, lista abaixo de 720 px."
      >
        <TabelaLista
          rotulo="Famílias em atendimento"
          colunas={COLUNAS_TABELA}
          linhas={LINHAS_TABELA}
        />
      </Secao>

      <Secao
        id="s-estado-vazio"
        titulo="Estado vazio"
        descricao="Diz o que é, por que está vazio e a próxima ação."
      >
        <EstadoVazio
          titulo="Nenhuma visita marcada para hoje"
          texto="Quando a coordenação oferecer uma família, a oferta aparece aqui para você aceitar ou recusar."
          acao={<Botao variante="secundario">Ver famílias atribuídas</Botao>}
        />
      </Secao>

      <Secao
        id="s-abas-inferiores"
        titulo="Abas inferiores"
        descricao="Celular e tablet. Estática nesta sessão: os itens vêm por propriedade (a navegação por papel é do P07 em diante)."
      >
        <div className="rounded-3 border-linha relative h-24 max-w-sm overflow-hidden border">
          <AbasInferiores
            rotulo="Exemplo de navegação"
            itens={ITENS_ABAS}
            className="!absolute inset-x-0 bottom-0"
          />
        </div>
      </Secao>

      <Secao
        id="s-barra-lateral"
        titulo="Barra lateral"
        descricao="Computador, 248 px, agrupada. Estática nesta sessão, mesma ressalva das abas inferiores."
      >
        <div className="rounded-3 border-linha relative h-[420px] max-w-xs overflow-hidden border">
          <BarraLateral
            nomeMarca="Kraamzorg OS"
            simboloSrc="/brand/simbolo-provisorio.png"
            grupos={GRUPOS_LATERAL}
            rodape={
              <div className="flex items-center gap-2">
                <Bot
                  className="text-texto-inverso-2 size-4"
                  aria-hidden="true"
                />
                <div>
                  <div className="font-semibold">Beatriz Falcão</div>
                  <div className="text-texto-inverso-2">
                    Coordenação clínica · perfil fictício
                  </div>
                </div>
              </div>
            }
            className="!absolute inset-y-0 left-0 !h-full !w-full"
          />
        </div>
        <p className="text-apoio text-texto-2 flex items-center gap-2">
          <MapPin className="size-4" aria-hidden="true" /> Visível só a partir
          de 1024 px (por isso pode não aparecer nesta captura de celular).
        </p>
      </Secao>
    </main>
  );
}
