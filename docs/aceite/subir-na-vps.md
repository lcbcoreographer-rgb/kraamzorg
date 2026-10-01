# Subir o Kraamzorg OS numa VPS

Serve para testar o CRM num servidor que a equipe acessa de qualquer lugar. Vale para Ubuntu 22.04 ou 24.04 com acesso `sudo`. O caminho definitivo do PRD é Vercel mais Supabase (`docs/aceite/ligar-o-sistema.md`); a VPS é uma alternativa para a fase de teste.

Há dois modos. Comece pelo A.

| Modo            | Dados                                       | Quando usar                                                                                |
| :-------------- | :------------------------------------------ | :----------------------------------------------------------------------------------------- |
| A. Demonstração | 48 famílias fictícias em memória, sem banco | Mostrar e testar as telas. Nada é gravado e tudo volta ao começo quando o serviço reinicia |
| B. Com Supabase | Banco real, login com senha e MFA           | Depois que as migrations estiverem aplicadas e revisadas                                   |

**Cuidado com o modo A.** A tela de entrar do modo demonstração é um seletor de perfis, sem senha. Nunca deixe a porta aberta para a internet sem uma proteção na frente (túnel SSH ou senha no Caddy, abaixo).

## 1. Preparar o servidor (uma vez)

```bash
sudo apt update && sudo apt install -y git curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
node -v   # precisa ser 22 ou mais novo
sudo adduser --disabled-password --gecos "" kraamzorg
```

## 2. Baixar e montar o app

```bash
sudo -iu kraamzorg
git clone -b claude/kraamzorg-delivery-review-6kzd8q https://github.com/lcbcoreographer-rgb/kraamzorg app
cd app
pnpm install --frozen-lockfile
```

Se o repositório já estiver privado, o `git clone` pede acesso. Crie uma chave de deploy somente leitura em Settings, Deploy keys, ou use um token de acesso pessoal de leitura.

### Modo A, demonstração

As variáveis com `NEXT_PUBLIC_` entram no app na hora do build, então ficam num arquivo antes do `pnpm build`:

```bash
cat > .env.production.local <<'EOF'
NEXT_PUBLIC_APP_ENV=desenvolvimento
KZ_DADOS=demonstracao
KZ_DEMO_VOLUME=grande
EOF
pnpm build
```

### Modo B, com Supabase

Preencha o arquivo a partir de `.env.example` com os valores do cofre da Kraamzorg. Pelo menos: `NEXT_PUBLIC_APP_ENV` (`homologacao` ou `producao`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL` (o endereço público do sistema), `INTERNAL_ROUTES_SECRET` e `CRON_SECRET`. Deixe `KZ_DADOS` vazio. Depois:

```bash
chmod 600 .env.production.local
pnpm build
node --env-file=.env.production.local scripts/checar-ambiente.mjs --env homologacao
```

A chave `SUPABASE_SERVICE_ROLE_KEY` nunca vai para o navegador nem para o n8n. Ela fica só neste arquivo, com permissão `600`.

## 3. Deixar rodando como serviço

Volte ao usuário com `sudo` (`exit`) e crie o serviço:

```bash
sudo tee /etc/systemd/system/kraamzorg.service >/dev/null <<'EOF'
[Unit]
Description=Kraamzorg OS
After=network.target

[Service]
User=kraamzorg
WorkingDirectory=/home/kraamzorg/app
Environment=NODE_ENV=production
ExecStart=/home/kraamzorg/app/node_modules/.bin/next start -p 3000 -H 127.0.0.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now kraamzorg
sudo systemctl status kraamzorg --no-pager | head -5
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/entrar   # 200
```

O app escuta só em `127.0.0.1`, de propósito: quem fala com a internet é o Caddy ou o túnel.

## 4. Abrir no seu computador

### Opção 1, túnel SSH (a mais simples e segura, sem domínio nem firewall)

No **seu computador** (não na VPS):

```bash
ssh -L 3000:127.0.0.1:3000 USUARIO@IP_DA_VPS
```

Deixe essa janela aberta e abra **http://127.0.0.1:3000/entrar** no navegador. Só quem tem acesso SSH à VPS consegue ver.

### Opção 2, endereço público com HTTPS e senha (Caddy)

Precisa de um endereço, por exemplo `sistema.kraamzorgbrasil.com.br`, com um registro DNS do tipo A apontando para o IP da VPS. Na Hostinger, crie só esse registro e **não mexa nos registros MX**, senão o e-mail da empresa para de receber.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
caddy hash-password        # digita uma senha e copia o resultado
```

Edite `/etc/caddy/Caddyfile`:

```
sistema.kraamzorgbrasil.com.br {
    basic_auth {
        equipe COLE_AQUI_O_HASH
    }
    reverse_proxy 127.0.0.1:3000
}
```

No modo B, tire o bloco `basic_auth`: o app já tem login. Depois:

```bash
sudo systemctl reload caddy
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 5. Atualizar quando sair versão nova

```bash
sudo -iu kraamzorg
cd app && git pull && pnpm install --frozen-lockfile && pnpm build
exit
sudo systemctl restart kraamzorg
```

## O que a VPS não faz sozinha

- **Banco, login e arquivos:** continuam no Supabase (região São Paulo). A VPS só roda o app.
- **Isadora:** roda no n8n, que é outro serviço. Os três fluxos estão em `n8n/IMPORTAR.md`.
- **Rotinas agendadas** (lembretes, régua, recálculo das 7h): no Supabase, por `pg_cron`. Nada precisa ser agendado na VPS.
- **Webhooks de fora** (Autentique, InfinitePay, WhatsApp oficial) precisam de HTTPS num endereço público, então só funcionam com a opção 2.
- **Modo demonstração em produção da Vercel** é bloqueado de propósito; na VPS ele roda porque as variáveis dizem que o ambiente é de desenvolvimento. Por isso a proteção na frente é obrigatória.
