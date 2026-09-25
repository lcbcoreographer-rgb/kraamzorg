import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `twMerge` só sabe reconhecer os nomes padrão do Tailwind (cores como
 * "red", tamanhos de fonte como "sm"). Sem isto, um token nosso que ele não
 * reconhece (ex: `text-corpo`, um tamanho) cai no mesmo grupo ambíguo de
 * outro que também não reconhece (ex: `text-texto-inverso`, uma cor), e o
 * `cn()` apaga um dos dois na hora de resolver o conflito, silenciosamente,
 * sem erro de tipo nem de lint. Foi assim que o botão "perigo" perdeu o
 * texto creme (ficou com o texto escuro do corpo da página, contraste
 * 2,6:1: achado do axe no P10). Esta lista ensina os nomes de
 * src/app/globals.css para o `twMerge` separar cor de tamanho outra vez.
 */
const CORES_DO_TEMA = [
  "marinho",
  "dourado",
  "areia",
  "creme",
  "branco",
  "sucesso",
  "aviso",
  "alerta",
  "sensivel",
  "marinho-72",
  "marinho-62",
  "marinho-50",
  "marinho-14",
  "marinho-08",
  "marinho-claro",
  "creme-62",
  "aviso-texto",
  "alerta-lavado",
  "aviso-lavado",
  "sucesso-lavado",
  "sensivel-lavado",
  "dourado-lavado",
  "alerta-borda",
  "aviso-borda",
  "sensivel-borda",
  "sucesso-borda",
  "alerta-hover",
  "lateral-hover",
  "fundo",
  "superficie",
  "superficie-2",
  "texto",
  "texto-2",
  "texto-3",
  "texto-inverso",
  "texto-inverso-2",
  "linha",
  "borda-campo",
  "acao",
  "acao-texto",
  "acao-hover",
  "destaque",
  "foco",
  "foco-halo",
] as const;

const TAMANHOS_DE_TEXTO = [
  "display",
  "display-lg",
  "1",
  "2",
  "3",
  "corpo",
  "apoio",
  "mini",
  "micro",
  "dado",
  "dado-lg",
  "marca",
] as const;

const mesclarClasses = extendTailwindMerge({
  extend: {
    theme: {
      color: [...CORES_DO_TEMA],
      radius: ["1", "2", "3", "pilula"],
      shadow: ["1", "2", "anel-hoje"],
      spacing: ["toque", "toque-campo", "margem-tela"],
      container: ["conteudo", "leitura", "lateral"],
      ease: ["saida", "estado"],
      font: ["titulo"],
    },
    classGroups: {
      "font-size": [{ text: [...TAMANHOS_DE_TEXTO] }],
    },
  },
});

/**
 * Combina classes do Tailwind sem conflito, no padrão shadcn/ui.
 * Usado pelos componentes de `src/components/ui`.
 */
export function cn(...inputs: ClassValue[]) {
  return mesclarClasses(clsx(inputs));
}
