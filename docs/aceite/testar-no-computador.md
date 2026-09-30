# Testar o CRM no computador, sem banco

O modo demonstração abre o Kraamzorg OS inteiro com dados fictícios em memória: 48 famílias de teste espalhadas pelo pipeline, venda, contrato, cobrança, pré-natal, visitas, checklist, alertas, financeiro e portal da família. Nada é gravado em banco e nada sai para a família. Ao parar o servidor, tudo volta ao começo.

## O que precisa ter instalado

- Git
- Node 22 ou mais novo
- pnpm (vem com o Node: rode `corepack enable` uma vez)

## Passo a passo

```bash
git clone -b claude/kraamzorg-delivery-review-6kzd8q https://github.com/lcbcoreographer-rgb/kraamzorg
cd kraamzorg
corepack enable
pnpm install
pnpm dev:demo
```

Quando aparecer "Ready", abra **http://127.0.0.1:3000/entrar** no navegador.

Use `127.0.0.1` e não `localhost`: se o navegador guardou cookies de outros projetos em `localhost`, a página pode dar "HTTP ERROR 431". Pelo `127.0.0.1` esses cookies não vão junto.

## Entrar

A tela de entrar mostra os seis perfis de teste. Toque no perfil para entrar como ele:

| Perfil      | O que ver primeiro                                                                                                     |
| :---------- | :--------------------------------------------------------------------------------------------------------------------- |
| Comercial   | Pipeline, Famílias, Conversas, Transferências, Sessões de venda, Tarefas                                               |
| Coordenação | Radar de nascimentos, Agenda, Equipe, Pré-natal, Alertas clínicos, Sessões de venda (registrar se a reunião aconteceu) |
| Enfermeira  | Hoje, Minhas famílias, a visita com o checklist (funciona sem internet)                                                |
| Financeiro  | Cobranças, Notas, Financeiro                                                                                           |
| Diretoria   | Painel, Capacidade, Configurações, Isadora                                                                             |
| Marketing   | Marketing, Parceiros                                                                                                   |

Quando uma tela pedir o código do aplicativo autenticador (MFA), use **123456**.

## Roteiro rápido do CRM

1. Comercial: no Pipeline, busque "Aurora" e use "Mover para" para andar um estágio. O menu só oferece os caminhos permitidos.
2. Busque "Cedro" e marque como perdido: sem motivo, a tela não deixa.
3. Cadastre um lead com o telefone +5511900000301 e depois abra "Duplicatas" para comparar e mesclar.
4. Abra a ficha da "Flor" e toque em Freio: o cabeçalho fica ameixa na hora, com a opção de desfazer.
5. Na ficha, "Ver dados completos" pede o código 123456 e mostra CPF e endereço com o aviso de leitura registrada.
6. Troque para Coordenação e abra Sessões de venda para registrar se a reunião com a Edilaine aconteceu.

## Para parar

`Ctrl + C` no terminal. Para abrir de novo, só `pnpm dev:demo`.

## Sem o volume extra

`pnpm dev:demo` liga 36 famílias fictícias a mais (`KZ_DEMO_VOLUME=grande`) para o pipeline ficar com cara de operação. Para ver só as famílias que os testes automáticos usam, rode:

```bash
NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao pnpm dev
```
