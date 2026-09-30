# Colo · junção das frentes e crítica final

Data: 30/09/2026
Junta as duas frentes da direção "Colo" (v4.4) no branch `claude/kraamzorg-delivery-review-6kzd8q` e faz a crítica visual do app inteiro, perfil por perfil, em 390 e 1280 px. Sem migration. Só apresentação e texto de interface: nenhuma regra de negócio, permissão, contrato de dados ou teste de comportamento mudou.

## O que foi feito

- **Junção**: `git merge --no-ff` das frentes comercial e gestão (`cdb8a7d`) e operação, enfermeira e família (`fe22cab`). Não houve conflito: as frentes mexeram em arquivos diferentes.
- **Crítica**: passeio por Enfermeira (Hoje, checklist, registro assinado, famílias, perfil, alertas, treinamentos), Comercial (Início, pipeline, famílias, ficha, ficha em freio, conversas, transferências, sessões, tarefas), Coordenação (Início, radar, agenda, equipe, alertas clínicos, ocorrências, pré-natal, pós-venda), Diretoria (Início, painel, capacidade, copiloto, Isadora), Financeiro, Marketing, portal da família, captação e entrada. As duas frentes falam a mesma língua: abertura em forma colo, trio de números com tile, título de seção com tile e contagem, cor pelo papel, pílula no que se toca. Momentos sensíveis ficam calmos: ficha em freio em ameixa sem tom de apoio, perda gestacional em lavado sensível, alerta clínico em branco com a faixa de alerta.

## Correções da crítica

- **Ilustrações que sumiam no bloco**: a mancha de fundo de cada ilustração tinha o mesmo tom do bloco que a recebia (o caderno de visita, em sálvia, dentro da comemoração sálvia; a manta, em areia, dentro do estado vazio areia; a xícara, a janela e a chave, em dourado claro, quase iguais ao areia). A ilustração perdia o disco e virava um desenho solto. Agora a peça recebe `sobre` (o tom do bloco) e, quando a mancha é do mesmo tom ou de um vizinho, ela vira um disco branco, como o ícone num tile. O `EstadoVazio` avisa sozinho (`sobre="areia-clara"`) e a comemoração passa `sobre="salvia-clara"`. Regra escrita no DESIGN.md 5.1.
- **Ilustração certa no lugar certo**: parceiros médicos sem indicação usava o sino (que no catálogo quer dizer "sem conversas"); passou para a chave de casa (primeira vez, nada cadastrado).
- **Ícone de coração no menu**: o pós-venda usava `MessageSquareHeart`, que o DESIGN.md 11.6 proíbe; agora é `MessageSquareQuote` (a pesquisa e o depoimento).
- **Texto pequeno para a família**: na pesquisa, o rótulo da escala de 0 a 10 e da escolha única estava em 14 px e os extremos em 12 px. `Escala0a10` e `EscolhaUnica` ganharam `tamanhoTexto="familia"` (rótulo em 17 px, extremos em 16 px), e a pesquisa usa. Nas telas da equipe nada muda.
- **Tabela de ocorrências**: no computador, o nome da família quebrava em três linhas; agora fica numa linha só.
- **Data no registro assinado**: aparecia "2026-09-30"; agora "30/09/2026" (`respostaParaLeitura`, com teste novo em `src/lib/checklist/formato.test.ts`).
- **Contagem ao lado do título**: o `TituloSecao` da operação usava a pílula em 12 px e o `SecaoBloco` do comercial em 14 px; as duas agora em 14 px.

## O que ficou de fora

- Início da coordenação e da diretoria continuam com o bloco "em construção" (decisão anterior; pedem dados novos, não só apresentação).
- A ilustração "Lua e nuvem" não está em nenhuma tela ainda: o caso dela (plantão tranquilo, nada até amanhã) não tem tela própria.
- Os campos de data e hora nativos seguem o idioma do navegador (nas capturas, "09/30/2026"), não o da página.

## Comandos para testar

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test
pnpm build
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium pnpm e2e --workers=2
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium pnpm e2e:offline --workers=2
gitleaks detect --no-banner
```

Roteiro manual com `pnpm dev:demo`: `/design-system` (ilustrações e comemoração, "Ver o movimento de novo"); entrar como Enfermeira e abrir `/hoje` e `/visita/00000000-0000-4000-8530-000000000004`; Comercial em `/inicio`, `/pipeline` e a ficha da Família Teste Bruma (freio); Coordenação em `/radar`, `/agenda` e `/ocorrencias`; Diretoria em `/painel`; o portal da família e `/c/igbio`, em 390 e 1280 px.
