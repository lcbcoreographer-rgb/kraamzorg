# Guia para ligar o sistema

Este guia junta, na ordem certa, o que a Kraamzorg e a Drop fazem para ligar o Kraamzorg OS de verdade. Ele não repete cada detalhe técnico. Quando precisar do passo fino, o guia aponta o arquivo que o tem.

| Assunto                                    | Arquivo de detalhe               |
| :----------------------------------------- | :------------------------------- |
| Banco, Auth, segredos, envio de migrations | `supabase/LIGAR.md`              |
| Fluxos da Isadora no n8n                   | `n8n/IMPORTAR.md`                |
| Ambientes e variáveis                      | `docs/runbooks/ambientes.md`     |
| Vercel, domínio, webhooks, voltar atrás    | `docs/runbooks/deploy-vercel.md` |
| Backup e restauração                       | `docs/runbooks/restauracao.md`   |
| Incidente de segurança                     | `docs/runbooks/incidente.md`     |

## Regras que valem em todos os passos

1. **Segredo só no cofre da Kraamzorg.** Senha, chave e token nascem no cofre e são digitados na hora, no lugar certo. Nunca em código, chat, e-mail, chamado ou captura de tela.
2. **Homologação primeiro.** Produção só depois do aceite em homologação.
3. **Dado real só em produção.** Homologação usa só o seed fictício.
4. **Cada ambiente tem os seus segredos.** Copiar um valor de homologação para produção é incidente.
5. **Nenhuma migration vai para o ar sem revisão humana do SQL.** Quem revisa não é quem escreveu.
6. **Tudo em nome da Kraamzorg.** Contas, projetos, domínio e repositório. A Drop opera com acesso que a Kraamzorg pode revogar.

## Ordem geral

1. Contas e cofre.
2. Supabase (banco e Auth).
3. Vercel (o app) e domínio.
4. E-mail (Resend).
5. Contrato (Autentique) e pagamento (InfinitePay).
6. n8n e WhatsApp.
7. Conferência final do ambiente.
8. Só então, produção.

## 1. Contas e cofre

Antes de qualquer serviço, crie o cofre de senhas da Kraamzorg e defina quem administra cada conta.

| Conta             | Dono                        | Plano previsto                     | Observação                                              |
| :---------------- | :-------------------------- | :--------------------------------- | :------------------------------------------------------ |
| Supabase          | Kraamzorg                   | Pro, dois projetos (hml e prod)    | Autenticação em dois passos na conta de quem administra |
| Vercel            | Kraamzorg                   | Pro                                | Uso comercial exige plano pago                          |
| Cloudflare        | Kraamzorg                   | Free                               | DNS e Turnstile                                         |
| Resend            | Kraamzorg                   | Free ou pago conforme o volume     | Domínio verificado                                      |
| Autentique        | Kraamzorg                   | Gratuito até 20 documentos por mês | Sandbox em homologação                                  |
| InfinitePay       | Kraamzorg                   | Conta da Kraamzorg                 | Credenciais pendentes (T-06)                            |
| OpenAI            | Kraamzorg                   | Por uso                            | Estimativa do contrato: R$ 100 a R$ 500 por mês         |
| WhatsApp          | Kraamzorg                   | API oficial (Meta)                 | Decisão do número pendente (T-01)                       |
| Google            | Kraamzorg                   | Agenda da reunião inicial          | Credencial da Edilaine pendente (T-11)                  |
| n8n e UAZAPI      | Drop, durante a sustentação | Estrutura da Drop                  | Migram para a Kraamzorg na saída (cláusula 2.6.2)       |
| Provedor de NFS-e | Kraamzorg                   | Por nota, até R$ 180 por mês       | Emissão manual pela contadora até homologar             |

## 2. Supabase

Detalhe: `supabase/LIGAR.md`. Em resumo, para cada projeto (`kraamzorg-hml` e `kraamzorg-prod`):

1. Criar o projeto na região `sa-east-1` (São Paulo), plano Pro. A senha do banco vai direto para o cofre.
2. Configurar o painel igual ao `config.toml`: só os schemas `public` e `api` expostos, cadastro aberto desligado, senha mínima de 12 caracteres, MFA por aplicativo ligado, sessão de 8 horas, SSL obrigatório e backups diários.
3. Ligar o repositório ao projeto com `supabase link`.
4. Criar no Vault, antes do primeiro envio, os dois segredos `auditoria_hmac` e `automacao_interno_token`, com valor do cofre e sem deixar histórico.
5. Ler o SQL de cada migration (segunda pessoa) e só então rodar `supabase db push`.
6. Definir a senha do papel `n8n_agente` à mão, pelo `psql`, a partir do cofre.
7. Rodar as conferências do fim do `LIGAR.md`: toda tabela com RLS, nenhuma função executável por anônimo, os agendamentos no lugar e os segredos pelo nome.

Aviso importante: `supabase db reset --linked` apaga o banco remoto inteiro. Nunca rode. E `supabase test db` nunca roda contra produção.

## 3. Vercel e domínio

Detalhe: `docs/runbooks/deploy-vercel.md` e `docs/runbooks/ambientes.md`.

1. Criar o projeto ligado ao repositório. O ramo `hml` publica homologação. A `main` publica produção, só por promoção depois do aceite.
2. Cadastrar as variáveis de cada ambiente. O runbook `ambientes.md` lista os nomes. Os valores vêm do cofre.
3. Configurar o domínio no Cloudflare em modo "somente DNS" e conferir o certificado.
4. Ajustar `APP_BASE_URL` de cada ambiente, sem barra no fim.
5. Conferir o ambiente com `scripts/checar-ambiente.mjs`, que lista o que está errado sem imprimir nenhum valor.
6. Configurar o monitor de disponibilidade e o Sentry.

`SUPABASE_SERVICE_ROLE_KEY` fica só no servidor. Nunca com prefixo `NEXT_PUBLIC_`, nunca no n8n. A variável `KZ_DADOS` não existe em homologação nem em produção.

## 4. E-mail (Resend)

1. Cadastrar o domínio da Kraamzorg e criar os registros SPF, DKIM e DMARC no Cloudflare.
2. Esperar a verificação do domínio.
3. Guardar `RESEND_API_KEY` no cofre e na Vercel. Definir `RESEND_FROM_EMAIL` com um endereço do domínio verificado.
4. No painel do Supabase, apontar o SMTP para o Resend, para que convite e recuperação de senha saiam com o remetente da Kraamzorg.
5. Testar: convidar uma pessoa de teste e conferir que o e-mail chega, sem cair em spam e sem nome de paciente no assunto.

## 5. Contrato (Autentique) e pagamento (InfinitePay)

**Autentique.**

1. Criar o token de API na conta da Kraamzorg.
2. Em homologação, `AUTENTIQUE_SANDBOX` fica ligado. Em produção, `AUTENTIQUE_SANDBOX=false` explícito.
3. Gerar o segredo do webhook (`AUTENTIQUE_WEBHOOK_SECRET`, 24 caracteres ou mais) e cadastrar o endereço `https://<app>/api/webhooks/autentique/<segredo>`.
4. Testar: gerar um contrato de uma família fictícia, assinar e ver a etapa avançar sozinha.

**InfinitePay.**

1. Resolver antes (T-06): confirmar com a InfinitePay que a conta gera links limitados a três parcelas. Padrão: plano de cobrança com no máximo três parcelas.
2. Guardar `INFINITEPAY_HANDLE` e `INFINITEPAY_API_KEY`.
3. Cadastrar o webhook `https://<app>/api/webhooks/infinitepay`. O sistema confere cada pagamento direto com a InfinitePay, então o aviso sozinho não confirma nada.
4. Testar: gerar o link, conferir que mostra no máximo três parcelas, pagar um valor de teste e ver a cobrança mudar de estado.

## 6. n8n e WhatsApp

Detalhe: `n8n/IMPORTAR.md`.

**Antes.** O banco de homologação já tem as funções do schema `agente`, o papel `n8n_agente` com senha e os parâmetros do agente. Sem isso os fluxos importam, mas não rodam.

**Credenciais no n8n** (criadas pela interface, com os nomes exatos): `Postgres Kraamzorg Agente`, `Redis Drop`, `OpenAI Kraamzorg`, `UAZAPI Kraamzorg`, `Google Calendar Kraamzorg` e, para o envio oficial, `WhatsApp Cloud API Kraamzorg`.

**Config do ambiente.** Copie `n8n/config.example.json` para fora do repositório e preencha. Os arquivos de config e a pasta `n8n/dist/` nunca entram no git.

**Ordem de importação.**

1. Gerar os fluxos: `node n8n/build.mjs --env hml --config <caminho> --saida <pasta>`.
2. Importar o fluxo 2 (pausar e avisar a equipe) e o fluxo 4 (agenda) e anotar os ids.
3. Refazer o build com os ids, importar o fluxo 3 (a Isadora) e o fluxo 1 (base de conhecimento).
4. Apagar os JSON gerados da máquina. Eles trazem os caminhos secretos dos webhooks.
5. Deixar `agente_modo` em `teste`, com só os números da equipe na lista.
6. Ativar o fluxo 3 e o fluxo 4 e apontar o webhook da instância de teste da UAZAPI.
7. Rodar os testes de aceite da seção 8 do `IMPORTAR.md`, incluindo as duas conversas simultâneas e os 28 casos do roteiro.

**WhatsApp em produção.** A Isadora só liga em produção com a API oficial da Meta funcionando e aprovada por escrito pelo Leonardo (T-01). Até lá, `agente_modo` fica em `desligado` e a equipe atende à mão, com duas pessoas acompanhando o WhatsApp todos os dias. Mensagens fora da janela de 24 horas dependem de modelos aprovados pela Meta (T-12).

**Google Agenda.** A credencial tem acesso de edição só à agenda da reunião inicial. Testar sempre com calendário de teste antes.

## 7. Conferência final do ambiente

Marque cada linha, primeiro em homologação, depois em produção.

- [ ] Todas as contas da lista da seção 1 estão em nome da Kraamzorg.
- [ ] Nenhum segredo repetido entre homologação e produção.
- [ ] `scripts/checar-ambiente.mjs` sem problema.
- [ ] As conferências de banco do fim do `supabase/LIGAR.md` deram o resultado esperado.
- [ ] Um usuário de cada papel entra, e cada um só vê o que a matriz de permissões permite.
- [ ] Enfermeira, financeiro, coordenação e diretoria só entram com o código do autenticador.
- [ ] Revogar as sessões de um usuário de teste derruba os aparelhos dele em até uma hora.
- [ ] Contrato assina, pagamento confirma, e-mail chega.
- [ ] Webhooks respondem e o monitor avisa quando um deles cai.
- [ ] Um restore de backup foi testado num projeto temporário (`docs/runbooks/restauracao.md`).

## 8. Produção

1. Nada de `--include-seed`. Produção recebe só a carga de configuração revisada (regiões, pacotes, parâmetros, textos aprovados), sem nenhuma família ou pessoa fictícia. O `LIGAR.md` explica o que ainda precisa ser separado do seed antes do primeiro envio.
2. Textos de mensagem entram aprovados pela Kraamzorg, e os clínicos pela Edilaine.
3. `agente_modo` começa em `desligado`.
4. Promoção de `hml` para `main` num passo controlado, com o aceite assinado.
5. Depois do envio, repita a seção 7 em produção.

## 9. Transferência para a Kraamzorg (D-12)

O código é entregue por inteiro à Kraamzorg. Confira e registre com data e responsável.

| Item                                                                          | Situação | Responsável | Data |
| :---------------------------------------------------------------------------- | :------- | :---------- | :--- |
| Repositório no GitHub da Kraamzorg                                            |          |             |      |
| Projeto Supabase de hml e de prod na organização da Kraamzorg                 |          |             |      |
| Projeto Vercel na equipe da Kraamzorg                                         |          |             |      |
| Domínio e Cloudflare em nome da Kraamzorg                                     |          |             |      |
| Contas de Resend, Autentique, InfinitePay, OpenAI                             |          |             |      |
| Cofre de senhas com as chaves de cada ambiente                                |          |             |      |
| Fluxos do n8n exportados (JSON gerados pelo `build.mjs`) e guardados no cofre |          |             |      |
| Acesso da Drop registrado e com data para revogar                             |          |             |      |

### Migrar a instância do n8n (cláusula 2.6.2)

Os fluxos nascem do script `n8n/build.mjs`, então a migração é refazer o build para a instância nova.

1. Suba uma instância do n8n da mesma versão em infraestrutura da Kraamzorg, com Redis e Node.js 24 ou mais novo.
2. Crie de novo as credenciais, com os mesmos nomes, usando valores novos do cofre da Kraamzorg. Não copie credencial da instância antiga.
3. Copie o config do ambiente para o cofre, troque os ids e os endereços e rode o build.
4. Importe na ordem do `IMPORTAR.md`: fluxo 2, fluxo 4, fluxo 3, fluxo 1.
5. Aponte o webhook da UAZAPI ou da API oficial para a instância nova.
6. Rode os testes de aceite e só então desligue a instância antiga.
7. Apague os JSON e os configs gerados da máquina de quem fez a migração.

## 10. Se algo der errado

- Suspeita de exposição de dado ou de credencial: `docs/runbooks/incidente.md`. Contenha primeiro, guarde a evidência, gire as credenciais e avise a Kraamzorg em até 24 horas.
- Deploy ruim: `docs/runbooks/deploy-vercel.md`, seção "Voltar atrás".
- Perda de dados: `docs/runbooks/restauracao.md`.
- Na dúvida sobre um passo deste guia, pare e pergunte. Um passo pulado em produção custa mais do que um dia de espera.
