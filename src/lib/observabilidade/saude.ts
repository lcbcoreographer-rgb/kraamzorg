/**
 * Avaliação da saúde do sistema (P14 item 7). A rota `/api/saude` lê os fatos
 * do banco (`public.saude_sistema`, só datas e números) e esta função os
 * transforma em `ok`, `atencao` ou `falha`. Pura: o teste cobre cada regra sem
 * banco. Nada aqui carrega dado de pessoa.
 *
 * - `falha` (a rota responde 503, para o monitor de disponibilidade alertar):
 *   banco inacessível, ou o recálculo diário das 7h atrasado além da
 *   tolerância de `parametro.saude_recalculo_tolerancia_horas` (ou parâmetro
 *   ausente).
 * - `atencao` (200, com o motivo): recálculo concluído com erro, job do
 *   agendador com a última execução falhada, webhook com falha depois do
 *   último acerto, automação ou sincronização com falha na janela de
 *   `parametro.saude_janela_falhas_horas`.
 * - Webhook que nunca chegou não é falha: pode ser só um ambiente sem tráfego.
 */

export type EstadoSaude = "ok" | "atencao" | "falha";

export interface Verificacao {
  nome: string;
  estado: EstadoSaude;
  detalhe: string;
}

export interface Saude {
  estado: EstadoSaude;
  verificacoes: Verificacao[];
}

interface Recalculo {
  ultimo_concluido_em?: string | null;
  status?: string | null;
  horas_desde?: number | null;
  tolerancia_horas?: number | null;
  atrasado?: boolean;
  com_erro?: boolean;
}

export interface DadosSaude {
  recalculo_diario?: Recalculo;
  cron?: { job: string; ultimo_em?: string | null; status?: string | null }[];
  webhooks?: {
    origem: string;
    ultimo_recebido_em?: string | null;
    ultimo_ok_em?: string | null;
    ultima_falha_em?: string | null;
    falha_recente?: boolean;
  }[];
  falhas?: {
    janela_horas?: number | null;
    automacoes_com_falha?: number;
    sincronizacao_com_erro?: number;
  };
}

const PIOR: Record<EstadoSaude, number> = { ok: 0, atencao: 1, falha: 2 };

export function avaliarSaude(dados: DadosSaude | null): Saude {
  if (!dados) {
    return {
      estado: "falha",
      verificacoes: [
        {
          nome: "banco",
          estado: "falha",
          detalhe: "Não consegui ler o estado do sistema no banco.",
        },
      ],
    };
  }

  const verificacoes: Verificacao[] = [
    { nome: "banco", estado: "ok", detalhe: "Banco respondeu." },
  ];

  const r = dados.recalculo_diario ?? {};
  if (r.atrasado !== false) {
    const quando = r.ultimo_concluido_em
      ? `Última rodada concluída em ${r.ultimo_concluido_em}`
      : "Nenhuma rodada concluída";
    const limite = r.tolerancia_horas
      ? `tolerância de ${r.tolerancia_horas} horas`
      : "tolerância não configurada";
    verificacoes.push({
      nome: "recalculo_diario",
      estado: "falha",
      detalhe: `O recálculo diário das 7h está atrasado. ${quando}; ${limite}.`,
    });
  } else if (r.com_erro) {
    verificacoes.push({
      nome: "recalculo_diario",
      estado: "atencao",
      detalhe:
        "A última rodada do recálculo diário terminou com erro em alguma etapa.",
    });
  } else {
    verificacoes.push({
      nome: "recalculo_diario",
      estado: "ok",
      detalhe: `Concluído há ${r.horas_desde ?? "?"} horas.`,
    });
  }

  const jobsComFalha = (dados.cron ?? []).filter((j) => j.status === "failed");
  verificacoes.push(
    jobsComFalha.length > 0
      ? {
          nome: "agendador",
          estado: "atencao",
          detalhe: `Última execução falhou em: ${jobsComFalha.map((j) => j.job).join(", ")}.`,
        }
      : {
          nome: "agendador",
          estado: "ok",
          detalhe: `${(dados.cron ?? []).length} jobs sem falha na última execução.`,
        },
  );

  for (const w of dados.webhooks ?? []) {
    verificacoes.push(
      w.falha_recente
        ? {
            nome: `webhook_${w.origem}`,
            estado: "atencao",
            detalhe: `Falha em ${w.ultima_falha_em} depois do último acerto${w.ultimo_ok_em ? ` (${w.ultimo_ok_em})` : ""}.`,
          }
        : {
            nome: `webhook_${w.origem}`,
            estado: "ok",
            detalhe: w.ultimo_ok_em
              ? `Último acerto em ${w.ultimo_ok_em}.`
              : "Nenhuma chamada recebida ainda.",
          },
    );
  }

  const f = dados.falhas ?? {};
  const janela = f.janela_horas
    ? `${f.janela_horas} horas`
    : "janela não configurada";
  const automacoes = f.automacoes_com_falha ?? 0;
  const sincronizacao = f.sincronizacao_com_erro ?? 0;
  verificacoes.push(
    automacoes > 0 || sincronizacao > 0
      ? {
          nome: "falhas_recentes",
          estado: "atencao",
          detalhe: `Nas últimas ${janela}: ${automacoes} automações falharam e ${sincronizacao} itens de sincronização deram erro.`,
        }
      : {
          nome: "falhas_recentes",
          estado: "ok",
          detalhe: `Sem falhas nas últimas ${janela}.`,
        },
  );

  const estado = verificacoes.reduce<EstadoSaude>(
    (pior, v) => (PIOR[v.estado] > PIOR[pior] ? v.estado : pior),
    "ok",
  );
  return { estado, verificacoes };
}
