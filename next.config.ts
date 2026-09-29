import type { NextConfig } from "next";

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
