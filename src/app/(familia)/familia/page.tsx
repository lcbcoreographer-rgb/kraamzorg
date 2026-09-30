import { redirect } from "next/navigation";
import { pessoaDaSessaoDemonstracao } from "@/lib/auth/familia";
import { obterPortalFamilia } from "@/lib/dados/publico-relacao";
import type { PortalFamilia } from "@/lib/dados/tipos-relacao";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";
import { PortalFamiliaTela } from "@/modules/familia/componentes/portal-familia";

/**
 * Portal da família (P49): próximos passos e datas, enfermeira designada
 * (nome e foto só com autorização), guia de início, contato da equipe e a
 * pesquisa. Só a família da conta logada; sem acesso, volta para pedir o
 * link. Em bloqueio_total ou encerrado_sensivel mostra só o contato de uma
 * pessoa da equipe. A conta da família não abre nenhuma tela da equipe.
 */
export default async function PaginaPortalDaFamilia() {
  let portal: PortalFamilia | null = null;
  try {
    const repositorio = await obterPortalFamilia(
      await pessoaDaSessaoDemonstracao(),
    );
    portal = await repositorio.obter();
  } catch {
    portal = null;
  }
  if (!portal) redirect("/familia/entrar?aviso=link");
  return <PortalFamiliaTela portal={portal} hoje={hojeBrasilia()} />;
}
