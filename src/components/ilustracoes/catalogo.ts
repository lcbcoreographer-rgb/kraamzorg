import type * as React from "react";
import type { IlustracaoProps } from "./base";
import {
  Broto,
  CadernoDeVisita,
  ChaveDeCasa,
  FolhaLupa,
  JanelaManha,
  LuaENuvem,
  MantaDobrada,
  NuvemSemSinal,
  SinoCalmo,
  XicaraQuente,
} from "./pecas";

/**
 * Catálogo das ilustrações com o uso de cada uma (DESIGN.md, 2.10 e 5.1).
 * A vitrine do design system e os estados vazios leem daqui: a mesma
 * ilustração conta sempre a mesma coisa em todo o app.
 */
export type NomeIlustracao =
  | "xicara-quente"
  | "janela-manha"
  | "sino-calmo"
  | "folha-lupa"
  | "nuvem-sem-sinal"
  | "caderno-de-visita"
  | "manta-dobrada"
  | "chave-de-casa"
  | "lua-e-nuvem"
  | "broto";

export const ILUSTRACOES: Record<
  NomeIlustracao,
  {
    Componente: (props: IlustracaoProps) => React.JSX.Element;
    nome: string;
    uso: string;
  }
> = {
  "xicara-quente": {
    Componente: XicaraQuente,
    nome: "Xícara quente",
    uso: "Sem tarefas para hoje",
  },
  "janela-manha": {
    Componente: JanelaManha,
    nome: "Janela com sol da manhã",
    uso: "Sem visitas hoje",
  },
  "sino-calmo": {
    Componente: SinoCalmo,
    nome: "Sino calmo",
    uso: "Sem conversas e nenhum alerta aberto",
  },
  "folha-lupa": {
    Componente: FolhaLupa,
    nome: "Folha e lupa",
    uso: "Busca ou filtro sem resultado",
  },
  "nuvem-sem-sinal": {
    Componente: NuvemSemSinal,
    nome: "Nuvem sem sinal",
    uso: "Sem sinal, com o registro guardado no aparelho",
  },
  "caderno-de-visita": {
    Componente: CadernoDeVisita,
    nome: "Caderno de visita",
    uso: "Comemoração do checklist completo",
  },
  "manta-dobrada": {
    Componente: MantaDobrada,
    nome: "Manta dobrada",
    uso: "Dia tranquilo, nenhuma família neste estágio",
  },
  "chave-de-casa": {
    Componente: ChaveDeCasa,
    nome: "Chave de casa",
    uso: "Primeira vez, nenhuma família atribuída ainda",
  },
  "lua-e-nuvem": {
    Componente: LuaENuvem,
    nome: "Lua e nuvem",
    uso: "Plantão tranquilo, nada pendente até amanhã",
  },
  broto: {
    Componente: Broto,
    nome: "Broto no vaso",
    uso: "Parte ainda em construção",
  },
};
