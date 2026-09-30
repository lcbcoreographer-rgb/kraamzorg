import type { NextConfig } from "next";
import { CSP_API, cabecalhosFixos } from "./src/lib/seguranca/cabecalhos";

const nextConfig: NextConfig = {
  // O resumo da sessão de venda (P29) lê o prompt de um arquivo .md do
  // repositório no servidor; sem isto, o arquivo fica fora do pacote da
  // função na Vercel.
  outputFileTracingIncludes: {
    "/sessoes-venda/**": ["./src/modules/crm/prompts/**/*.md"],
  },
  async headers() {
    return [
      {
        // Cabeçalhos de segurança fixos em tudo (P14 item 4): HSTS, nosniff,
        // sem moldura, política de referrer e de permissões. Vem primeiro
        // para as regras mais específicas abaixo (por exemplo, o
        // `no-referrer` do formulário do contrato) valerem por cima. A CSP
        // das páginas, com nonce novo por requisição, é do `src/proxy.ts`.
        source: "/:path*",
        headers: cabecalhosFixos(),
      },
      {
        // Rotas de API respondem JSON: o proxy não passa por elas, então a
        // CSP que fecha tudo sai daqui.
        source: "/api/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP_API },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        // Service worker do app instalável da enfermeira (P38): nunca fica
        // em cache do navegador, para a versão nova valer na próxima abertura.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
      {
        // Formulário seguro do contrato (P30): o token de uso único está no
        // caminho. Sem Referer, o link nunca vaza para o script do
        // Turnstile nem para outro site; sem cache e sem indexação.
        source: "/formulario/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Pesquisa de satisfação da família (P42): o token de uso único está
        // no caminho. Mesmas regras do formulário do contrato.
        source: "/pesquisa/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Retorno do link de pagamento (P32): sem indexação e sem cache.
        source: "/pagamento/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Comprovante da baixa manual (P32 item 4): parametro.cobranca
      // comprovante_max_bytes (3 MB) mais a folga do multipart. A Vercel
      // corta o corpo em 4,5 MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
