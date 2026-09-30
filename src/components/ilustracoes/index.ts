/**
 * Ilustrações da casa (PRD 20.2 [v4.4]; DESIGN.md, 5.1). Só em estado
 * vazio e na comemoração do checklist completo; nunca em alerta clínico,
 * perda, freio ou intercorrência.
 */
export { Ilustracao, Traco, Forma } from "./base";
export type { IlustracaoProps, TomIlustracao } from "./base";
export {
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
export { ILUSTRACOES, type NomeIlustracao } from "./catalogo";
