# Kraamzorg OS · Protótipo navegável

Protótipo interativo e estático do Kraamzorg OS — demonstração visual da direção de design "Caderneta de visita" com dados fictícios e claramente identificados conforme LGPD.

## Como abrir

Abra `index.html` em um navegador moderno. O protótipo é responsivo e funciona em celular (390px) e desktop (1280px).

```bash
# Diretamente no navegador
open index.html

# Ou serve-o em um servidor HTTP
python3 -m http.server 8000
# Depois visite http://localhost:8000
```

## O que você encontra

- **Enfermeira em campo**: fluxo de visita domiciliar pós-parto, checklist de vitais e procedimentos, assinatura digital
- **Comercial**: pipeline de vendas, gestão de contatos, comunicação com leads
- **Coordenação clínica**: dashboard operacional, radar de famílias, gestão de equipe, alertas clínicos
- **Kit de componentes**: vitrine de padrões visuais, tokens, ícones e tipografia

## Direção de design

Implementa a direção visual "Caderneta de visita" conforme `docs/design/DESIGN.md`:
- Fundo creme, tinta marinho, acento dourado
- Régua de dias D1 a D12 para progresso do acompanhamento
- Componentes baseados em `assets/tokens.css` e `assets/base.css`
- Ícones em traço (1,75–24 px) via Lucide em `assets/icones.js`
- Tipografia Jost para títulos, Inter para interface, IBM Plex Mono para dados

## Provisório

Logo em `assets/logo-provisorio.png` e fontes Jost, Inter, IBM Plex Mono são substitutas. Quando os arquivos oficiais chegarem (SVG e Codec Pro, TT Drugs do brand guidelines), atualizar `assets/tokens.css` e as referências `@font-face`.

## Estrutura

```
prototipo/
  index.html ................. Página de entrada com galeria
  README.md .................. Este arquivo
  _kit.html .................. Vitrine de componentes
  
  enfermeira.html ............ Tela principal da enfermeira
  enfermeira-*.html .......... Fluxo de atendimento (14 telas)
  
  comercial.html ............. Tela principal do comercial
  comercial-*.html ........... Fluxo comercial (7 telas)
  
  coordenacao.html ........... Tela principal da coordenação
  coordenacao-*.html ......... Fluxo operacional (8 telas)
  
  entrar.html ................ Acesso unificado (não é de um papel específico)
  
  assets/
    tokens.css ............... Cores, tipografia, espaço, raio
    base.css ................. Componentes
    icones.js ................ Símbolos SVG inline
    icones.svg ............... Definições dos ícones Lucide
    logo-provisorio.png ...... Logomarca temporária
    simbolo-provisorio.png ... Marca sem texto
    enfermeira.css ........... Estilos específicos da enfermeira
    enfermeira.js ............ Comportamento da enfermeira
    enfermeira-dados.js ...... Dados fictícios da enfermeira
    fonts/ ................... Jost, Inter, IBM Plex Mono
  
  capturas/
    *.png .................... Screenshots de referência (390 e 1280px)
```

## Dados fictícios

Todos os dados são completamente inventados para não expor informação pessoal ou clínica real:
- Famílias: "Família Teste Aurora", "Família Teste Brisa"
- Profissionais: nomes inventados (Beatriz Oliveira, Clara Mendes)
- Contatos: `+55 11 90000-00xx`
- Datas: formato `24/09/2026`
- Medidas: `38s2d`, `R$ 4.200`

## Navegação

Cada tela tem abas inferiores (enfermeira) ou menu lateral (comercial, coordenação) para navegar entre seções do próprio papel. Não há integração com backend: a navegação é estática em `href` de âncoras.
