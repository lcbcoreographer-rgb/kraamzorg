import type { PlataformaInstalacao } from "@/lib/pwa/plataforma";

/**
 * Textos da tela `/instalar` e do cartão de avisos do perfil (P11). Microcopy
 * de interface, no tom de `docs/design/voz.md`: frase completa, verbo e
 * objeto no botão, sem exclamação, sem travessão. Nada aqui é texto para a
 * família.
 */

export interface ConteudoPlataforma {
  titulo: string;
  /** Frase que abre o cartão, antes dos passos. */
  texto: string;
  /** Passo a passo curto; vazio quando não há o que fazer. */
  passos: string[];
  /** Observação que vale só para esta plataforma. */
  aviso?: string;
  /** O botão que copia o endereço aparece (abrir em outro navegador). */
  copiarEndereco?: boolean;
  /** O botão "Instalar agora" aparece quando o navegador oferecer. */
  botaoInstalar?: boolean;
}

const PASSOS_ANDROID = [
  "Toque nos três pontinhos, no canto de cima do Chrome.",
  "Toque em Instalar aplicativo. Se essa opção não aparecer, toque em Adicionar à tela inicial.",
  "Confirme em Instalar. O ícone do Kraamzorg aparece na tela inicial.",
  "Abra o aplicativo pelo ícone e entre com o seu e-mail.",
];

const PASSOS_IPHONE = [
  "Toque no botão de compartilhar, o quadrado com uma seta para cima, na barra de baixo do Safari.",
  "Role a lista e toque em Adicionar à Tela de Início.",
  "Toque em Adicionar, no canto de cima.",
  "Abra o aplicativo pelo ícone da tela inicial e entre com o seu e-mail.",
];

export const CONTEUDO: Record<PlataformaInstalacao, ConteudoPlataforma> = {
  instalado: {
    titulo: "O aplicativo já está instalado",
    texto:
      "Você está usando o Kraamzorg como aplicativo. Abra sempre pelo ícone da tela inicial: assim o seu dia carrega mesmo quando falta sinal.",
    passos: [],
  },
  android_chrome: {
    titulo: "No Android, pelo Chrome",
    texto: "Leva menos de um minuto e não ocupa quase espaço no celular.",
    passos: PASSOS_ANDROID,
    botaoInstalar: true,
  },
  android_outro: {
    titulo: "Para instalar, abra no Chrome",
    texto:
      "Este navegador não instala o aplicativo. Copie o endereço, abra o Chrome e cole na barra de cima. Depois siga os passos abaixo.",
    passos: PASSOS_ANDROID,
    copiarEndereco: true,
  },
  iphone_safari: {
    titulo: "No iPhone, pelo Safari",
    texto:
      "O iPhone não tem botão de instalar. O caminho é pelo menu de compartilhar.",
    passos: PASSOS_IPHONE,
    aviso:
      "Os avisos no celular só funcionam com o aplicativo instalado por este caminho.",
  },
  iphone_outro: {
    titulo: "Para instalar, abra no Safari",
    texto:
      "No iPhone, o aplicativo só se instala pelo Safari. Copie o endereço, abra o Safari e cole na barra de endereço. Depois siga os passos abaixo.",
    passos: PASSOS_IPHONE,
    copiarEndereco: true,
    aviso:
      "Os avisos no celular só funcionam com o aplicativo instalado por este caminho.",
  },
  computador_chromium: {
    titulo: "No computador, pelo Chrome ou Edge",
    texto: "O aplicativo abre em janela própria, sem a barra do navegador.",
    passos: [
      "Procure o ícone de instalar no fim da barra de endereço, do lado direito.",
      "Se o ícone não aparecer, abra o menu do navegador e escolha Instalar Kraamzorg.",
      "Confirme em Instalar.",
    ],
    botaoInstalar: true,
  },
  computador_outro: {
    titulo: "No computador, use o Chrome ou o Edge",
    texto:
      "O navegador que você está usando não instala o aplicativo. Você pode seguir usando o Kraamzorg por aqui mesmo, ou abrir este endereço no Chrome ou no Edge para instalar.",
    passos: [],
    copiarEndereco: true,
  },
};

export const TEXTOS_INSTALAR = {
  titulo: "Instale o Kraamzorg no celular",
  abertura:
    "Instalado, o aplicativo abre pelo ícone da tela inicial, mostra o seu dia mesmo sem sinal e guarda o que você registrar até a conexão voltar.",
  carregando: "Conferindo o seu aparelho.",
  instalarAgora: "Instalar agora",
  instalando: "Aguardando a sua confirmação",
  instaladoAgora: "Instalado. Abra o Kraamzorg pelo ícone da tela inicial.",
  copiarEndereco: "Copiar o endereço",
  enderecoCopiado: "Endereço copiado",
  copiarFalhou:
    "Não deu para copiar sozinho. Pressione e segure o endereço abaixo para copiar.",
  passosTitulo: "Passo a passo",
  depois:
    "Na primeira vez, entre com o seu e-mail e o código do aplicativo autenticador. Depois disso o aplicativo lembra de você neste aparelho.",
  irParaEntrar: "Ir para a entrada",
  abrirHoje: "Abrir o Hoje",
} as const;

export const TEXTOS_AVISOS = {
  titulo: "Avisos no aparelho",
  texto:
    "Receba um aviso no celular quando houver algo novo para você no aplicativo. O aviso nunca traz o nome de uma família: ele só diz que há novidade, e o detalhe você vê depois de abrir.",
  ligar: "Ligar os avisos",
  desligar: "Desligar os avisos",
  trabalhando: "Um instante",
  ligado: "Os avisos estão ligados neste aparelho.",
  desligado: "Os avisos estão desligados neste aparelho.",
  semSuporte:
    "Este navegador não recebe avisos. No iPhone, instale o aplicativo na tela inicial primeiro e abra por lá.",
  semChave:
    "Os avisos ainda não estão configurados neste ambiente. Avise a coordenação.",
  bloqueado:
    "Os avisos estão bloqueados neste navegador. Libere nas configurações do site e volte aqui.",
  falhou:
    "Não deu para ligar os avisos agora. Confira a conexão e tente de novo.",
} as const;

export const TEXTOS_ARMAZENAMENTO = {
  persistente:
    "O espaço do aplicativo neste aparelho está protegido: o navegador não apaga o que você registrou sem sinal.",
  temporario:
    "O navegador ainda pode apagar os dados do aplicativo se faltar espaço no celular. Mantenha o aplicativo instalado e suba os registros sempre que tiver sinal.",
  indisponivel: "",
} as const;
