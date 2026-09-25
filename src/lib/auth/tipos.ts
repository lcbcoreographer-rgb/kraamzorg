import type { Papel } from "./papeis";

export type NivelAutenticacao = "aal1" | "aal2";

/** Quem está logado, do jeito que a casca e as telas precisam. */
export interface SessaoUsuario {
  usuarioId: string;
  nome: string;
  email: string;
  papeis: Papel[];
  /** Perfil ativo (PRD 6.1). Perfil desativado não entra. */
  ativo: boolean;
  /** Nível da sessão agora: aal1 (senha) ou aal2 (senha e código do MFA). */
  aal: NivelAutenticacao;
  /** aal2 quando a pessoa já tem o MFA cadastrado e só falta o desafio. */
  aalPossivel: NivelAutenticacao;
}

/** O mínimo que o proxy lê em cada requisição. */
export type SessaoBorda = Pick<
  SessaoUsuario,
  "usuarioId" | "papeis" | "ativo" | "aal" | "aalPossivel"
>;

export type CodigoErroAuth =
  | "credenciais"
  | "codigo_invalido"
  | "sem_sessao"
  | "sem_perfil"
  | "senha_fraca"
  | "link_invalido"
  | "limite_tentativas"
  | "indisponivel"
  | "desconhecido";

export type ResultadoAuth = { ok: true } | { ok: false; erro: CodigoErroAuth };

/** Uma pessoa fictícia do seletor do modo demonstração. */
export interface OpcaoEntradaDemonstracao {
  usuarioId: string;
  nome: string;
  papeis: Papel[];
}

/**
 * Como a tela de entrar se apresenta. A tela não sabe qual implementação
 * está rodando: só pergunta a forma. A real é e-mail e senha; a de
 * demonstração é um seletor de pessoa fictícia, só em desenvolvimento.
 */
export type FormaDeEntrada =
  | { tipo: "senha" }
  | { tipo: "seletor"; opcoes: OpcaoEntradaDemonstracao[] };

export interface CadastroMfa {
  fatorId: string;
  /** QR code em SVG (data URI) para o aplicativo autenticador. */
  qrCodeSvg: string;
  /** O mesmo segredo em texto, para quem não consegue ler o QR. */
  segredo: string;
}

/**
 * Autenticação do servidor (Server Components e Server Actions). Duas
 * implementações: supabase (Supabase Auth, e-mail, senha e TOTP) e
 * demonstracao (seletor fictício, só em desenvolvimento).
 */
export interface ProvedorAutenticacao {
  formaDeEntrada(): FormaDeEntrada;
  obterSessao(): Promise<SessaoUsuario | null>;
  entrarComSenha(email: string, senha: string): Promise<ResultadoAuth>;
  entrarPorSeletor(usuarioId: string): Promise<ResultadoAuth>;
  sair(): Promise<void>;
  iniciarCadastroMfa(): Promise<CadastroMfa | { erro: CodigoErroAuth }>;
  confirmarCadastroMfa(fatorId: string, codigo: string): Promise<ResultadoAuth>;
  verificarMfa(codigo: string): Promise<ResultadoAuth>;
  /** Texto de apoio do desafio só no modo demonstração; null na real. */
  ajudaDesafioMfa(): string | null;
  /** Sempre responde ok para não revelar se o e-mail existe. */
  enviarRecuperacaoSenha(email: string, urlRetorno: string): Promise<ResultadoAuth>;
  /** Troca a senha de quem chegou pelo link do e-mail (convite ou recuperação). */
  definirSenha(novaSenha: string): Promise<ResultadoAuth>;
  /** Confere o link do e-mail (convite ou recuperação) e abre a sessão. */
  confirmarLinkEmail(tokenHash: string, tipo: "invite" | "recovery"): Promise<ResultadoAuth>;
}
