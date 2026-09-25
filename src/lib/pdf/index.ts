export { gerarEvolucaoPuerperal, gerarEvolucaoNeonatal } from "./gerar";
export {
  validarEvolucaoPuerperal,
  validarEvolucaoNeonatal,
} from "./validacoes";
export {
  calcularCurvaPeso,
  calcularDiaDeVida,
  classificarEvolucaoPeso,
} from "./curva-peso";
export {
  concordar,
  preencherTexto,
  preencherTextoOpcional,
  semTravessaoOuMeiaRisca,
} from "./textos";
export { nomeArquivoEvolucao, metadadosEvolucao } from "./metadados";
export type {
  ContatoMedico,
  DadosEvolucaoNeonatal,
  DadosEvolucaoPuerperal,
  DadosProfissional,
  ResultadoGeracao,
  ResultadoPdf,
  TextosModelo,
} from "./tipos";
export type { CurvaPeso } from "./curva-peso";
