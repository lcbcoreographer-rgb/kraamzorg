# Acolhimento · passe visual final da entrega

Data: 30/09/2026
Branch: `claude/kraamzorg-delivery-review-6kzd8q` (sem worktree). Sem migration nova. `PRD.md`, `CLAUDE.md` e `PROMPTS.md` não foram tocados.

Passe de apresentação e texto sobre as telas novas das duas ondas (P31 a P52), contra `docs/design/DESIGN.md` seção 11 e `docs/design/voz.md`. Só apresentação e texto: nenhuma regra de negócio, permissão, enum ou contrato de dados mudou, e nenhum token novo entrou.

## Como foi lido

- Peça dentro de sistema existente (interface-2026): obedecer tokens e componentes. Modo Operate para a equipe e a enfermeira, Read para o portal da família (Impeccable). Taste (redesign-skill) só como checklist de estado e de conteúdo.
- Diagnóstico em uma frase: a mecânica das telas novas estava boa; o que esfriava era hierarquia (tudo com o mesmo peso no portal da família), texto de sistema vazando para a tela (enum cru, frase quebrada, "Família Família") e três defeitos de componente que apareciam em várias telas.
- Capturas 390 x 844 e 1280 x 800, modo demonstração, antes e depois, em `scratchpad/onda-final/antes/` e `scratchpad/onda-final/depois/` (script `scratchpad/onda-final/cap.mjs`), fora do repositório. 46 telas, todas com `scrollWidth` igual à largura da janela.

## O que mudou, por tela

### Família

- **Portal da família** (`src/modules/familia/componentes/portal-familia.tsx`): os passos feitos viraram linhas quietas (check em `sucesso`, data em mono à direita, sem cartão); o passo de agora é o único cartão, com a borda dourada; os seguintes continuam tracejados. Antes eram sete cartões iguais e a família precisava ler a lista para achar o "agora". Com a próxima visita já marcada, a frase "as visitas aparecem aqui quando a coordenação confirmar" contradizia a data e sai. Visitas: "A caminho" virou "Marcada"; no celular, dia e estado na primeira linha e a data inteira embaixo (antes a hora quebrava no meio). Datas: no celular, rótulo em cima e data embaixo, sempre igual; no computador, na mesma linha.
- **Textos do portal em `mensagem_modelo` (rascunho)** (`supabase/dados/relacao_seed.sql`, regenerado em `relacao-seed.gerado.ts`): `portal_titulo` "Olá, {nome}." virou "Oi, {nome}.", como a referência da voz ("Oi, Marina."). `portal_contato_apoio` falava "com a mãe ou com o bebê" com a própria mãe e não dava o caminho de urgência; agora: "se algo preocupar com você ou com o bebê, liguem para o SAMU (192) ou procurem o pronto-socorro mais próximo." Os dois continuam `rascunho` e vão para a aprovação [confirmar: Leonardo; Edilaine no trecho de urgência]. O pgTAP 027 passou a esperar "Oi, Aurora." (o teste prova que o texto vem de `mensagem_modelo` com o nome, e isso não mudou).
- Captação, entrada no portal, confirmação, pagamento recebido e pesquisa: lidos nas duas larguras, sem mudança. Já seguem a voz (quem fala, o que acontece depois, nada de pressão).

### Enfermeira

- **Checklist** (`/visita/[id]`): o título da etapa recebia o foco programático e mostrava o halo de foco em volta, como se fosse um campo selecionado; regra nova em `globals.css` tira anel e halo só de `[tabindex="-1"]` (alvo de foco que não é controle; o leitor de tela continua anunciando). A barra inferior tinha o ícone em cima do texto em "Voltar" e "Registrar outro sinal de alerta" e a seta de "Próxima etapa" encolhida (ver Componentes).
- **Família da enfermeira** (`/minhas-familias/[id]`): "(mae, contato principal)" mostrava o enum cru; agora "(mãe, contato principal)", com os rótulos que o CRM já usa, e o mesmo para a especialidade do médico. Peso ao nascer em formato brasileiro ("3.480 g"). As visitas ficam em grade, com o estado sempre à direita, sem quebrar a linha nos dias de nome longo.
- **Ofertas** (`/ofertas`, `cartao-oferta.tsx`): "Não posso aceitar" era um `details` dentro de uma caixa com borda que parecia um cartão vazio; virou um botão secundário que abre o formulário de recusa. Data provável com a marca "estimativa". Subtítulo: "A coordenação convidou você para acompanhar estas famílias. Responda até o prazo de cada uma; se não puder, conte o motivo." Campo livre: "Se quiser, conte mais para a coordenação".
- **Evoluções da enfermeira** (`/minhas-evolucoes`): na tela dela, o prazo fala com ela ("Você tem até 01/10/2026 para preencher e mandar para a revisão."; "O seu prazo é hoje"). Na tela da coordenação a frase continua em terceira pessoa (`frasePrazo` ganhou o parâmetro `leitor`, padrão "equipe").
- Hoje, Famílias, Alertas e Perfil: conferidos; a correção dos botões vale para "Registrar acionamento" nos alertas.

### Coordenação, comercial, financeiro e diretoria

- **Pré-natal, entrevista** (`/prenatal/[familiaId]`, `formulario-instrumento.tsx`): no celular, o cartão da família (nome, IG, DPP, cidade) aparecia depois da última pergunta; agora sobe para antes do formulário (ordem humana, DESIGN 11.5). No computador continua na terceira coluna. O mesmo na entrevista concluída.
- **Radar, alocação** (`/radar/[familiaId]`): "Ninguém designada ainda." virou "Nenhuma enfermeira designada ainda."; na lista de candidatas, "oferta pendente" aparecia duas vezes quando o estado do dia já era esse.
- **Agenda, mudar todas as visitas** (`painel-cascata.tsx`): com a data igual, cada linha dizia "30/09/2026 para 30/09/2026"; agora mostra só a data. Quando a data muda, "de" e "para" continuam.
- **Evolução e ocorrência**: "Família Família Teste Estrela" no cabeçalho da evolução e no painel da ocorrência (o nome da família já começa com "Família").
- **Capacidade** (`capacidade/textos.ts`): "Londrina têm 2 semanas" contava semanas para concordar o verbo; agora conta regiões ("Londrina tem", "nessa região" ou "nessas regiões").
- **Painel executivo**: a frase de abertura começava em minúscula ("setembro de 2026:") e repetia o congelamento, que já está no cartão das metas; ficou só no cartão, com "na versão v1.0.0-rc.1" no lugar de "com a tag". Colunas (`graficos/colunas.tsx`): o gráfico ampliava até 1,5 vez o tamanho natural e o texto dos eixos crescia junto no computador; o teto agora é 1,2.
- **Copiloto**: "Nenhuma pergunta neste mês ainda., de um limite de R$ 50." virou "Nenhuma pergunta neste mês ainda. O limite do mês é de R$ 50."
- **Parceiros e indicações**: "0 indicações recebidas, 0 viraram contrato." virou "Nenhuma indicação recebida ainda."; com indicações e sem contrato, "nenhuma virou contrato".
- Contrato, cobranças, notas, financeiro, equipe, escala, alertas clínicos, ocorrências, manuais e portal da família (lado da equipe): lidos nas duas larguras, sem mudança.

### Componentes

- **`Botao`** (`src/components/ui/botao.tsx`): ícone passado junto do texto (sem `iconeEsquerda`) ia para uma linha própria, porque o `<svg>` é bloco no preflight e ficava dentro de um `<span>` comum. O `<span>` do rótulo virou `contents` e os ícones não encolhem (`[&_svg]:shrink-0`). Corrige de uma vez o checklist, os alertas e qualquer outro botão montado assim. Efeito colateral encontrado pelo e2e: em "Enviar para a revisão da coordenação" (editor de evolução) o ícone só cabia porque encolhia até sumir, e as classes de quebra de linha estavam no ícone e não no botão (`editor-evolucao.tsx`, `lista-pos-venda.tsx`); foram para o botão, e o rótulo longo quebra em duas linhas no celular.
- **Foco programático** (`globals.css`): ver Checklist.

## Decisões

- Dourado "Titular" na oferta continua: o DESIGN 11.3 permite dourado em oferta pendente, e o e2e da designação lê esse selo.
- "Obrigado." no retorno do pagamento continua: a página não sabe se o pagamento foi concluído, e o título curto não promete nada.
- A descrição da ocorrência de pesquisa ("nota 4 de 0 a 10") vem da migration 0024, ainda não aplicada; mudar seria mexer em migration, fora do escopo. Pendência abaixo.

## Pendências novas

- [confirmar: Leonardo; Edilaine] aprovar `portal_titulo` e `portal_contato_apoio` (rascunho).
- Alerta clínico na lista de alertas mostra "Registrado: 38,3" sem unidade: a lista não carrega a definição do instrumento, que é onde a unidade está. Pede o campo da unidade no retorno de `api.alertas` ou a leitura do instrumento na lista.
- Migration 0024 (antes do `db push`): "com nota 4 de 0 a 10" pode virar "com nota 4, numa escala de 0 a 10".
- Aviso de parceiros (`parceiros_aviso_vedacao`) traz "Texto a validar com o jurídico" dentro do texto que a equipe lê; sai quando o jurídico aprovar.
- Demonstração: a enfermeira de teste do portal (Sul 2) aparece nas evoluções como "com Enfermeira Teste Lima"; alinhar os fixtures.
- Campo nativo de data e hora ainda mostra mm/dd/yyyy e AM/PM no Chromium de teste; conferir num aparelho real.

## Comandos para testar

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test
PGPORT=54420 PGDATA=/tmp/kz-pg-visual supabase/sem-docker/scripts/iniciar.sh
PGPORT=54420 PGDATA=/tmp/kz-pg-visual supabase/sem-docker/scripts/testar.sh
PGPORT=54420 PGDATA=/tmp/kz-pg-visual supabase/sem-docker/scripts/parar.sh
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=4800 pnpm e2e
```

Roteiro manual, modo demonstração (`NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao`): entrar no portal da família com `aurora.teste@exemplo.invalid` (só o passo de agora em cartão, "Oi, Aurora.", SAMU no contato); entrar como Enfermeira e abrir `/visita/00000000-0000-4000-8530-000000000004` em 390 px (título sem halo, ícones na linha dos botões); abrir `/ofertas` e tocar em "Não posso aceitar"; entrar como Coordenação e abrir uma entrevista de `/prenatal` no celular (família antes das perguntas).

## Resultado dos comandos

- `pnpm lint`: 0 erros.
- `pnpm format:check`: todos os arquivos no padrão.
- `pnpm typecheck`: sem erro.
- `pnpm test`: 210 arquivos, 3.057 testes passando, 80 pulados (já eram pulados).
- `supabase/sem-docker/scripts/testar.sh` (porta 54420, `PGDATA=/tmp/kz-pg-visual`): 36 arquivos, 4.706 testes, `Result: PASS`. Servidor parado no fim.
- `pnpm e2e` (`PW_PORT=4800`): 244 passaram, 2 pulados, 0 falhas, no build final.
- Suítes das telas tocadas: `e2e:relacao` 46, `e2e:gestao` 26, `e2e:equipe-portal` 30, `e2e:evolucao-ocorrencia-nf` 38 (na primeira rodada, 1 falha de rolagem lateral de 10 px no editor de evolução, corrigida como descrito em Componentes), `e2e:offline` 5. Todas passando.
- `gitleaks detect --no-banner`: nenhum vazamento.
- `checar_slop.py` (anti-ai-slop) nos textos novos: peso 0.
- Nenhum seletor de teste precisou mudar; o pgTAP 027 passou a esperar "Oi, Aurora.".
- Nenhum servidor nem Postgres ficou rodando.
