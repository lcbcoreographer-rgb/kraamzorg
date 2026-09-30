import { pessoaDaSessaoDemonstracao } from "@/lib/auth/familia";
import { ehFotoProfissional, obterArmazenamento } from "@/lib/armazenamento";
import { obterPortalFamilia } from "@/lib/dados/publico-relacao";

/**
 * Foto da enfermeira no portal da família (P49). Só existe para quem tem
 * acesso ao portal e só quando a enfermeira autorizou a foto: o caminho vem
 * de api.portal_familia (que já corta sem autorização), nunca da requisição.
 * O arquivo fica no storage privado; a resposta é uma URL assinada curta.
 */
export async function GET() {
  try {
    const portal = await (
      await obterPortalFamilia(await pessoaDaSessaoDemonstracao())
    ).obter();
    const caminho =
      portal?.situacao === "ok" ? portal.enfermeira?.fotoPath : null;
    if (!caminho || !ehFotoProfissional(caminho)) {
      return new Response(null, { status: 404 });
    }
    const arquivo = await obterArmazenamento().abrir(caminho, 60);
    if (!arquivo) return new Response(null, { status: 404 });
    if (arquivo.tipo === "url") {
      return new Response(null, {
        status: 302,
        headers: { location: arquivo.url, "cache-control": "no-store" },
      });
    }
    return new Response(arquivo.bytes as BodyInit, {
      headers: {
        "content-type": arquivo.contentType,
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
