// Gerado por scripts/gerar-tipos-local.mjs (pnpm db:types:local).
// Não edite à mão: rode o script de novo depois de cada migration.
// Mesmo formato do `supabase gen types typescript` (pnpm db:types).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Permite instanciar o createClient com as opções certas do PostgREST.
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  api: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      acionar_freio: {
        Args: {
          estado: Database["public"]["Enums"]["estado_sensivel"];
          familia_id: string;
          motivo?: string;
        };
        Returns: Json;
      };
      base_conhecimento_aprovar: {
        Args: { id: string };
        Returns: Json;
      };
      base_conhecimento_listar: {
        Args: never;
        Returns: Json;
      };
      base_conhecimento_salvar: {
        Args: {
          fonte?: string;
          id: string;
          texto: string;
          tipo: string;
          titulo: string;
        };
        Returns: Json;
      };
      buscar_duplicatas_pipeline: {
        Args: never;
        Returns: Json;
      };
      dados_contrato: {
        Args: { completo?: boolean; pessoa_id: string };
        Returns: Json;
      };
      desfazer_freio: {
        Args: { familia_id: string };
        Returns: Json;
      };
      eliminar_titular: {
        Args: { familia_id: string; motivo: string };
        Returns: Json;
      };
      familias_do_dia: {
        Args: { dia?: string };
        Returns: {
          bairro: string;
          cidade: string;
          contato_nome: string;
          contato_telefone: string;
          data: string;
          data_alta: string;
          data_inicio_efetivo: string;
          data_nascimento: string;
          dia_numero: number;
          dpp: string;
          endereco_atendimento: Json;
          estado_sensivel: Database["public"]["Enums"]["estado_sensivel"];
          familia_id: string;
          gemelar: boolean;
          hora_prevista: string;
          nome_exibicao: string;
          profissional_id: string;
          uf: string;
          visita_estado: Database["public"]["Enums"]["estado_visita"];
          visita_id: string;
        }[];
      };
      ficha_assistencial: {
        Args: { familia_id: string };
        Returns: Json;
      };
      justificar_freio: {
        Args: { familia_id: string; motivo: string };
        Returns: Json;
      };
      lead_origem: {
        Args: { familias?: string[] };
        Returns: {
          codigo_origem: string;
          familia_id: string;
          indicacao_familia_id: string;
          indicacao_medico_id: string;
          origem: Database["public"]["Enums"]["origem_lead"];
          utm: Json;
        }[];
      };
      log_auditoria: {
        Args: {
          ate?: string;
          desde?: string;
          entidade?: string;
          entidade_id?: string;
          limite?: number;
        };
        Returns: Database["public"]["Tables"]["log_auditoria"]["Row"][];
      };
      marketing_funil: {
        Args: { ate?: string; desde?: string };
        Returns: { estagio: string; oportunidades: number; pipeline: number }[];
      };
      marketing_leads_por_origem: {
        Args: { ate?: string; desde?: string };
        Returns: {
          ganhos: number;
          leads: number;
          origem: Database["public"]["Enums"]["origem_lead"];
          qualificados: number;
        }[];
      };
      mesclar_familias: {
        Args: {
          familia_fica_id: string;
          familia_perde_id: string;
          oportunidade_fica_id?: string;
        };
        Returns: Json;
      };
      metricas_agente: {
        Args: { ate: string; desde: string };
        Returns: Json;
      };
      parametros_da_tela: {
        Args: { chaves?: string[] };
        Returns: { atualizado_em: string; chave: string; valor: Json }[];
      };
      pausar_conversa: {
        Args: { conversa_id: string; motivo?: string };
        Returns: Json;
      };
      pode_enviar_mensagem: {
        Args: {
          canal?: Database["public"]["Enums"]["modo_mensageria"];
          categoria: Database["public"]["Enums"]["categoria_automacao"];
          familia_id: string;
        };
        Returns: Json;
      };
      reenviar_notificacao_handoff: {
        Args: { handoff_id: string };
        Returns: Json;
      };
      registrar_envio_tarefa: {
        Args: { tarefa_id: string; texto: string };
        Returns: Json;
      };
      resolver_transferencia: {
        Args: { desfecho: string; handoff_id: string };
        Returns: Json;
      };
      retomar_agente: {
        Args: { conversa_id: string };
        Returns: Json;
      };
      retomar_pausa_conversa: {
        Args: { conversa_id: string };
        Returns: Json;
      };
      reverter_freio: {
        Args: {
          estado: Database["public"]["Enums"]["estado_sensivel"];
          familia_id: string;
          justificativa: string;
        };
        Returns: Json;
      };
      revogar_sessoes: {
        Args: { usuario_id: string };
        Returns: Json;
      };
      sessao_venda_gravacao: {
        Args: { sessao_id: string };
        Returns: Json;
      };
      status_cobranca: {
        Args: { familia_id: string };
        Returns: {
          cobranca_id: string;
          contrato_id: string;
          nota_status: Database["public"]["Enums"]["status_nota"];
          pago_em: string;
          parcela: number;
          status: Database["public"]["Enums"]["status_cobranca"];
          vencimento: string;
        }[];
      };
      status_equipe: {
        Args: { regiao_id?: string; semana?: string };
        Returns: {
          dia: string;
          nome: string;
          profissional_id: string;
          status: Database["public"]["Enums"]["status_profissional"];
        }[];
      };
      transicionar: {
        Args: {
          entidade_id: string;
          maquina: string;
          motivo?: string;
          para: string;
        };
        Returns: Json;
      };
      transicoes_permitidas: {
        Args: { de?: string; maquina: string };
        Returns: {
          automatica: boolean;
          destino: string;
          origem: string;
          papel_minimo: Database["public"]["Enums"]["papel_usuario"];
          pode: boolean;
        }[];
      };
      ultima_ingestao_base: {
        Args: never;
        Returns: Json;
      };
      vincular_nova_gestacao: {
        Args: { familia_anterior_id: string; familia_id: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      acompanhamento: {
        Row: {
          atualizado_em: string;
          contrato_id: string;
          criado_em: string;
          criado_por: string | null;
          dias_contratados: number;
          encerramento: string | null;
          estado: Database["public"]["Enums"]["estado_acompanhamento"];
          familia_id: string;
          horas_por_visita: number;
          id: string;
          inicio_efetivo: string | null;
          periodo: Database["public"]["Enums"]["periodo_visita"] | null;
        };
        Insert: {
          atualizado_em?: string;
          contrato_id: string;
          criado_em?: string;
          criado_por?: string | null;
          dias_contratados: number;
          encerramento?: string | null;
          estado?: Database["public"]["Enums"]["estado_acompanhamento"];
          familia_id: string;
          horas_por_visita: number;
          id?: string;
          inicio_efetivo?: string | null;
          periodo?: Database["public"]["Enums"]["periodo_visita"] | null;
        };
        Update: {
          atualizado_em?: string;
          contrato_id?: string;
          criado_em?: string;
          criado_por?: string | null;
          dias_contratados?: number;
          encerramento?: string | null;
          estado?: Database["public"]["Enums"]["estado_acompanhamento"];
          familia_id?: string;
          horas_por_visita?: number;
          id?: string;
          inicio_efetivo?: string | null;
          periodo?: Database["public"]["Enums"]["periodo_visita"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "acompanhamento_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contrato";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acompanhamento_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acompanhamento_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
        ];
      };
      alerta_clinico: {
        Row: {
          acionado_em: string | null;
          atualizado_em: string;
          bebe_id: string | null;
          campo: string | null;
          conduta: string;
          conduta_adotada: string | null;
          criado_em: string;
          criado_por: string | null;
          familia_id: string;
          fechado_em: string | null;
          fechado_por: string | null;
          id: string;
          instrumento_versao: string;
          orientacao_medica: string | null;
          reconhecido_em: string | null;
          reconhecido_por: string | null;
          regra_id: string;
          severidade: Database["public"]["Enums"]["severidade"];
          sinal_identificado: string | null;
          valor_observado: string | null;
          versao: number;
          visita_id: string | null;
        };
        Insert: {
          acionado_em?: string | null;
          atualizado_em?: string;
          bebe_id?: string | null;
          campo?: string | null;
          conduta: string;
          conduta_adotada?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          familia_id: string;
          fechado_em?: string | null;
          fechado_por?: string | null;
          id?: string;
          instrumento_versao: string;
          orientacao_medica?: string | null;
          reconhecido_em?: string | null;
          reconhecido_por?: string | null;
          regra_id: string;
          severidade: Database["public"]["Enums"]["severidade"];
          sinal_identificado?: string | null;
          valor_observado?: string | null;
          versao?: number;
          visita_id?: string | null;
        };
        Update: {
          acionado_em?: string | null;
          atualizado_em?: string;
          bebe_id?: string | null;
          campo?: string | null;
          conduta?: string;
          conduta_adotada?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          familia_id?: string;
          fechado_em?: string | null;
          fechado_por?: string | null;
          id?: string;
          instrumento_versao?: string;
          orientacao_medica?: string | null;
          reconhecido_em?: string | null;
          reconhecido_por?: string | null;
          regra_id?: string;
          severidade?: Database["public"]["Enums"]["severidade"];
          sinal_identificado?: string | null;
          valor_observado?: string | null;
          versao?: number;
          visita_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alerta_clinico_bebe_id_fkey";
            columns: ["bebe_id"];
            isOneToOne: false;
            referencedRelation: "bebe";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerta_clinico_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerta_clinico_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerta_clinico_fechado_por_fkey";
            columns: ["fechado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerta_clinico_reconhecido_por_fkey";
            columns: ["reconhecido_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerta_clinico_regra_id_instrumento_versao_fkey";
            columns: ["regra_id", "instrumento_versao"];
            isOneToOne: false;
            referencedRelation: "regra_alerta";
            referencedColumns: ["id", "instrumento_versao"];
          },
          {
            foreignKeyName: "alerta_clinico_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visita";
            referencedColumns: ["id"];
          },
        ];
      };
      anexo_audio: {
        Row: {
          arquivo_path: string;
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          duracao_seg: number | null;
          id: string;
          retencao_ate: string | null;
          status: Database["public"]["Enums"]["status_audio"];
          transcricao: string | null;
          versao: number;
          visita_id: string;
        };
        Insert: {
          arquivo_path: string;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          duracao_seg?: number | null;
          id?: string;
          retencao_ate?: string | null;
          status?: Database["public"]["Enums"]["status_audio"];
          transcricao?: string | null;
          versao?: number;
          visita_id: string;
        };
        Update: {
          arquivo_path?: string;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          duracao_seg?: number | null;
          id?: string;
          retencao_ate?: string | null;
          status?: Database["public"]["Enums"]["status_audio"];
          transcricao?: string | null;
          versao?: number;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "anexo_audio_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anexo_audio_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visita";
            referencedColumns: ["id"];
          },
        ];
      };
      automacao: {
        Row: {
          acoes: Json;
          ativa: boolean;
          categoria: Database["public"]["Enums"]["categoria_automacao"];
          condicoes: Json;
          descricao: string | null;
          executor: Database["public"]["Enums"]["executor_automacao"];
          gatilho: Json;
          id: string;
          nome: string;
        };
        Insert: {
          acoes: Json;
          ativa?: boolean;
          categoria: Database["public"]["Enums"]["categoria_automacao"];
          condicoes?: Json;
          descricao?: string | null;
          executor: Database["public"]["Enums"]["executor_automacao"];
          gatilho: Json;
          id: string;
          nome: string;
        };
        Update: {
          acoes?: Json;
          ativa?: boolean;
          categoria?: Database["public"]["Enums"]["categoria_automacao"];
          condicoes?: Json;
          descricao?: string | null;
          executor?: Database["public"]["Enums"]["executor_automacao"];
          gatilho?: Json;
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      automacao_execucao: {
        Row: {
          agendada_para: string | null;
          atualizado_em: string;
          automacao_id: string;
          criado_em: string;
          criado_por: string | null;
          erro: string | null;
          executada_em: string | null;
          familia_id: string | null;
          id: string;
          motivo_aborto: string | null;
          payload: Json | null;
          status: Database["public"]["Enums"]["status_execucao"];
        };
        Insert: {
          agendada_para?: string | null;
          atualizado_em?: string;
          automacao_id: string;
          criado_em?: string;
          criado_por?: string | null;
          erro?: string | null;
          executada_em?: string | null;
          familia_id?: string | null;
          id?: string;
          motivo_aborto?: string | null;
          payload?: Json | null;
          status?: Database["public"]["Enums"]["status_execucao"];
        };
        Update: {
          agendada_para?: string | null;
          atualizado_em?: string;
          automacao_id?: string;
          criado_em?: string;
          criado_por?: string | null;
          erro?: string | null;
          executada_em?: string | null;
          familia_id?: string | null;
          id?: string;
          motivo_aborto?: string | null;
          payload?: Json | null;
          status?: Database["public"]["Enums"]["status_execucao"];
        };
        Relationships: [
          {
            foreignKeyName: "automacao_execucao_automacao_id_fkey";
            columns: ["automacao_id"];
            isOneToOne: false;
            referencedRelation: "automacao";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automacao_execucao_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automacao_execucao_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
        ];
      };
      bebe: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          data_nascimento: string | null;
          familia_id: string;
          id: string;
          nome: string | null;
          ordem: number;
          peso_alta_g: number | null;
          peso_nascimento_g: number | null;
          sexo: string | null;
          tipo_parto: string | null;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          data_nascimento?: string | null;
          familia_id: string;
          id?: string;
          nome?: string | null;
          ordem?: number;
          peso_alta_g?: number | null;
          peso_nascimento_g?: number | null;
          sexo?: string | null;
          tipo_parto?: string | null;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          data_nascimento?: string | null;
          familia_id?: string;
          id?: string;
          nome?: string | null;
          ordem?: number;
          peso_alta_g?: number | null;
          peso_nascimento_g?: number | null;
          sexo?: string | null;
          tipo_parto?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bebe_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bebe_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
        ];
      };
      bloqueio_agenda: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          fim: string;
          id: string;
          inicio: string;
          motivo: string;
          profissional_id: string;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          fim: string;
          id?: string;
          inicio: string;
          motivo: string;
          profissional_id: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          fim?: string;
          id?: string;
          inicio?: string;
          motivo?: string;
          profissional_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bloqueio_agenda_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bloqueio_agenda_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissional";
            referencedColumns: ["id"];
          },
        ];
      };
      cidade: {
        Row: {
          aliases: string[];
          atendida: boolean;
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          id: string;
          nome: string;
          observacao: string | null;
          regiao_id: string | null;
          requer_confirmacao: boolean;
          taxa_deslocamento_centavos: number;
          uf: string;
        };
        Insert: {
          aliases?: string[];
          atendida?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome: string;
          observacao?: string | null;
          regiao_id?: string | null;
          requer_confirmacao?: boolean;
          taxa_deslocamento_centavos?: number;
          uf: string;
        };
        Update: {
          aliases?: string[];
          atendida?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string;
          observacao?: string | null;
          regiao_id?: string | null;
          requer_confirmacao?: boolean;
          taxa_deslocamento_centavos?: number;
          uf?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cidade_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cidade_regiao_id_fkey";
            columns: ["regiao_id"];
            isOneToOne: false;
            referencedRelation: "regiao";
            referencedColumns: ["id"];
          },
        ];
      };
      cobranca: {
        Row: {
          atualizado_em: string;
          capture_method: string | null;
          comprovante_url: string | null;
          contrato_id: string;
          criado_em: string;
          criado_por: string | null;
          external_id: string;
          id: string;
          invoice_slug: string | null;
          link_pagamento: string | null;
          pago_em: string | null;
          parcela: number;
          parcelas_cartao: number | null;
          provider: string;
          status: Database["public"]["Enums"]["status_cobranca"];
          transaction_nsu: string | null;
          valor_centavos: number;
          valor_pago_centavos: number | null;
          vencimento: string;
        };
        Insert: {
          atualizado_em?: string;
          capture_method?: string | null;
          comprovante_url?: string | null;
          contrato_id: string;
          criado_em?: string;
          criado_por?: string | null;
          external_id: string;
          id?: string;
          invoice_slug?: string | null;
          link_pagamento?: string | null;
          pago_em?: string | null;
          parcela?: number;
          parcelas_cartao?: number | null;
          provider?: string;
          status?: Database["public"]["Enums"]["status_cobranca"];
          transaction_nsu?: string | null;
          valor_centavos: number;
          valor_pago_centavos?: number | null;
          vencimento: string;
        };
        Update: {
          atualizado_em?: string;
          capture_method?: string | null;
          comprovante_url?: string | null;
          contrato_id?: string;
          criado_em?: string;
          criado_por?: string | null;
          external_id?: string;
          id?: string;
          invoice_slug?: string | null;
          link_pagamento?: string | null;
          pago_em?: string | null;
          parcela?: number;
          parcelas_cartao?: number | null;
          provider?: string;
          status?: Database["public"]["Enums"]["status_cobranca"];
          transaction_nsu?: string | null;
          valor_centavos?: number;
          valor_pago_centavos?: number | null;
          vencimento?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cobranca_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contrato";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobranca_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      condicao_comercial: {
        Row: {
          ativa: boolean;
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          id: string;
          nome: string;
          observacao: string | null;
          requer_aprovacao: boolean;
          tipo: string;
          valor: number;
        };
        Insert: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome: string;
          observacao?: string | null;
          requer_aprovacao?: boolean;
          tipo: string;
          valor: number;
        };
        Update: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string;
          observacao?: string | null;
          requer_aprovacao?: boolean;
          tipo?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "condicao_comercial_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      consulta_prenatal: {
        Row: {
          agendada_para: string | null;
          atualizado_em: string;
          conduzida_por: string | null;
          criado_em: string;
          criado_por: string | null;
          familia_id: string;
          ficha: Json;
          id: string;
          instrumento_versao: string;
          periodo_preferido:
            Database["public"]["Enums"]["periodo_visita"][] | null;
          plano_cuidado: string | null;
          realizada_em: string | null;
          status: Database["public"]["Enums"]["status_consulta"];
          urgente: boolean;
          versao: number;
        };
        Insert: {
          agendada_para?: string | null;
          atualizado_em?: string;
          conduzida_por?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          familia_id: string;
          ficha?: Json;
          id?: string;
          instrumento_versao: string;
          periodo_preferido?:
            Database["public"]["Enums"]["periodo_visita"][] | null;
          plano_cuidado?: string | null;
          realizada_em?: string | null;
          status?: Database["public"]["Enums"]["status_consulta"];
          urgente?: boolean;
          versao?: number;
        };
        Update: {
          agendada_para?: string | null;
          atualizado_em?: string;
          conduzida_por?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          familia_id?: string;
          ficha?: Json;
          id?: string;
          instrumento_versao?: string;
          periodo_preferido?:
            Database["public"]["Enums"]["periodo_visita"][] | null;
          plano_cuidado?: string | null;
          realizada_em?: string | null;
          status?: Database["public"]["Enums"]["status_consulta"];
          urgente?: boolean;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: "consulta_prenatal_conduzida_por_fkey";
            columns: ["conduzida_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consulta_prenatal_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consulta_prenatal_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
        ];
      };
      contrato: {
        Row: {
          assinado_em: string | null;
          atualizado_em: string;
          autentique_doc_id: string | null;
          contratante_pessoa_id: string | null;
          criado_em: string;
          criado_por: string | null;
          desconto_centavos: number;
          enviado_em: string | null;
          familia_id: string;
          formulario_expira_em: string | null;
          formulario_token_hash: string | null;
          id: string;
          pacote_versao_id: string;
          pagador_pessoa_id: string | null;
          parcelas: number;
          pdf_path: string | null;
          status: Database["public"]["Enums"]["status_contrato"];
          taxa_deslocamento_centavos: number;
          template_versao: string;
          testemunha_pessoa_id: string | null;
          valor_centavos: number;
        };
        Insert: {
          assinado_em?: string | null;
          atualizado_em?: string;
          autentique_doc_id?: string | null;
          contratante_pessoa_id?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          desconto_centavos?: number;
          enviado_em?: string | null;
          familia_id: string;
          formulario_expira_em?: string | null;
          formulario_token_hash?: string | null;
          id?: string;
          pacote_versao_id: string;
          pagador_pessoa_id?: string | null;
          parcelas?: number;
          pdf_path?: string | null;
          status?: Database["public"]["Enums"]["status_contrato"];
          taxa_deslocamento_centavos?: number;
          template_versao: string;
          testemunha_pessoa_id?: string | null;
          valor_centavos: number;
        };
        Update: {
          assinado_em?: string | null;
          atualizado_em?: string;
          autentique_doc_id?: string | null;
          contratante_pessoa_id?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          desconto_centavos?: number;
          enviado_em?: string | null;
          familia_id?: string;
          formulario_expira_em?: string | null;
          formulario_token_hash?: string | null;
          id?: string;
          pacote_versao_id?: string;
          pagador_pessoa_id?: string | null;
          parcelas?: number;
          pdf_path?: string | null;
          status?: Database["public"]["Enums"]["status_contrato"];
          taxa_deslocamento_centavos?: number;
          template_versao?: string;
          testemunha_pessoa_id?: string | null;
          valor_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "contrato_contratante_pessoa_id_fkey";
            columns: ["contratante_pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contrato_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contrato_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contrato_pacote_versao_id_fkey";
            columns: ["pacote_versao_id"];
            isOneToOne: false;
            referencedRelation: "pacote_versao";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contrato_pagador_pessoa_id_fkey";
            columns: ["pagador_pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contrato_testemunha_pessoa_id_fkey";
            columns: ["testemunha_pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoa";
            referencedColumns: ["id"];
          },
        ];
      };
      conversa: {
        Row: {
          agente_encerrado_em: string | null;
          agente_encerrado_motivo: string | null;
          agente_pausa_motivo: string | null;
          agente_pausado_ate: string | null;
          atualizado_em: string;
          canal: Database["public"]["Enums"]["canal_contato"];
          classificacao: Database["public"]["Enums"]["classificacao_contato"];
          criado_em: string;
          criado_por: string | null;
          familia_id: string | null;
          id: string;
          iniciada_por: Database["public"]["Enums"]["enviado_por"] | null;
          nome_contato_salvo: string | null;
          nome_whatsapp: string | null;
          pessoa_id: string | null;
          primeira_msg_em: string | null;
          telefone_e164: string | null;
          ultima_entrada_em: string | null;
          ultima_saida_em: string | null;
          wa_jid: string | null;
          wa_lid: string | null;
        };
        Insert: {
          agente_encerrado_em?: string | null;
          agente_encerrado_motivo?: string | null;
          agente_pausa_motivo?: string | null;
          agente_pausado_ate?: string | null;
          atualizado_em?: string;
          canal?: Database["public"]["Enums"]["canal_contato"];
          classificacao?: Database["public"]["Enums"]["classificacao_contato"];
          criado_em?: string;
          criado_por?: string | null;
          familia_id?: string | null;
          id?: string;
          iniciada_por?: Database["public"]["Enums"]["enviado_por"] | null;
          nome_contato_salvo?: string | null;
          nome_whatsapp?: string | null;
          pessoa_id?: string | null;
          primeira_msg_em?: string | null;
          telefone_e164?: string | null;
          ultima_entrada_em?: string | null;
          ultima_saida_em?: string | null;
          wa_jid?: string | null;
          wa_lid?: string | null;
        };
        Update: {
          agente_encerrado_em?: string | null;
          agente_encerrado_motivo?: string | null;
          agente_pausa_motivo?: string | null;
          agente_pausado_ate?: string | null;
          atualizado_em?: string;
          canal?: Database["public"]["Enums"]["canal_contato"];
          classificacao?: Database["public"]["Enums"]["classificacao_contato"];
          criado_em?: string;
          criado_por?: string | null;
          familia_id?: string | null;
          id?: string;
          iniciada_por?: Database["public"]["Enums"]["enviado_por"] | null;
          nome_contato_salvo?: string | null;
          nome_whatsapp?: string | null;
          pessoa_id?: string | null;
          primeira_msg_em?: string | null;
          telefone_e164?: string | null;
          ultima_entrada_em?: string | null;
          ultima_saida_em?: string | null;
          wa_jid?: string | null;
          wa_lid?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversa_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversa_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversa_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoa";
            referencedColumns: ["id"];
          },
        ];
      };
      designacao: {
        Row: {
          acompanhamento_id: string;
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          id: string;
          motivo_recusa: string | null;
          oferecida_em: string;
          papel: Database["public"]["Enums"]["papel_designacao"];
          profissional_id: string;
          respondida_em: string | null;
          status: Database["public"]["Enums"]["status_designacao"];
        };
        Insert: {
          acompanhamento_id: string;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          motivo_recusa?: string | null;
          oferecida_em?: string;
          papel: Database["public"]["Enums"]["papel_designacao"];
          profissional_id: string;
          respondida_em?: string | null;
          status?: Database["public"]["Enums"]["status_designacao"];
        };
        Update: {
          acompanhamento_id?: string;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          motivo_recusa?: string | null;
          oferecida_em?: string;
          papel?: Database["public"]["Enums"]["papel_designacao"];
          profissional_id?: string;
          respondida_em?: string | null;
          status?: Database["public"]["Enums"]["status_designacao"];
        };
        Relationships: [
          {
            foreignKeyName: "designacao_acompanhamento_id_fkey";
            columns: ["acompanhamento_id"];
            isOneToOne: false;
            referencedRelation: "acompanhamento";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "designacao_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "designacao_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissional";
            referencedColumns: ["id"];
          },
        ];
      };
      documento_profissional: {
        Row: {
          arquivo_path: string | null;
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          id: string;
          numero: string | null;
          profissional_id: string;
          tipo: string;
          validade: string | null;
        };
        Insert: {
          arquivo_path?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          numero?: string | null;
          profissional_id: string;
          tipo: string;
          validade?: string | null;
        };
        Update: {
          arquivo_path?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          numero?: string | null;
          profissional_id?: string;
          tipo?: string;
          validade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documento_profissional_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documento_profissional_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissional";
            referencedColumns: ["id"];
          },
        ];
      };
      evento_familia: {
        Row: {
          criado_em: string;
          criado_por: string | null;
          dados: Json;
          familia_id: string;
          id: number;
          restrito: boolean;
          tipo: string;
          titulo: string;
        };
        Insert: {
          criado_em?: string;
          criado_por?: string | null;
          dados?: Json;
          familia_id: string;
          id?: number;
          restrito?: boolean;
          tipo: string;
          titulo: string;
        };
        Update: {
          criado_em?: string;
          criado_por?: string | null;
          dados?: Json;
          familia_id?: string;
          id?: number;
          restrito?: boolean;
          tipo?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evento_familia_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
        ];
      };
      familia: {
        Row: {
          atualizado_em: string;
          bairro: string | null;
          cidade_id: string | null;
          cidade_informada: string | null;
          codigo_origem: string | null;
          criado_em: string;
          criado_por: string | null;
          data_alta: string | null;
          data_inicio_efetivo: string | null;
          data_nascimento: string | null;
          dpp: string | null;
          endereco_atendimento: Json | null;
          estado_sensivel: Database["public"]["Enums"]["estado_sensivel"];
          estado_sensivel_em: string | null;
          estado_sensivel_motivo: string | null;
          estado_sensivel_por: string | null;
          familia_anterior_id: string | null;
          gemelar: boolean;
          historico_sensivel: boolean;
          id: string;
          indicacao_familia_id: string | null;
          indicacao_medico_id: string | null;
          mesclada_em_id: string | null;
          municipio_codigo_ibge: number | null;
          nao_contatar: boolean;
          nao_contatar_em: string | null;
          nao_contatar_motivo: string | null;
          nome_exibicao: string;
          origem: Database["public"]["Enums"]["origem_lead"];
          primeira_gestacao: boolean | null;
          regiao_id: string | null;
          utm: Json | null;
        };
        Insert: {
          atualizado_em?: string;
          bairro?: string | null;
          cidade_id?: string | null;
          cidade_informada?: string | null;
          codigo_origem?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data_alta?: string | null;
          data_inicio_efetivo?: string | null;
          data_nascimento?: string | null;
          dpp?: string | null;
          endereco_atendimento?: Json | null;
          estado_sensivel?: Database["public"]["Enums"]["estado_sensivel"];
          estado_sensivel_em?: string | null;
          estado_sensivel_motivo?: string | null;
          estado_sensivel_por?: string | null;
          familia_anterior_id?: string | null;
          gemelar?: boolean;
          historico_sensivel?: boolean;
          id?: string;
          indicacao_familia_id?: string | null;
          indicacao_medico_id?: string | null;
          mesclada_em_id?: string | null;
          municipio_codigo_ibge?: number | null;
          nao_contatar?: boolean;
          nao_contatar_em?: string | null;
          nao_contatar_motivo?: string | null;
          nome_exibicao: string;
          origem?: Database["public"]["Enums"]["origem_lead"];
          primeira_gestacao?: boolean | null;
          regiao_id?: string | null;
          utm?: Json | null;
        };
        Update: {
          atualizado_em?: string;
          bairro?: string | null;
          cidade_id?: string | null;
          cidade_informada?: string | null;
          codigo_origem?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data_alta?: string | null;
          data_inicio_efetivo?: string | null;
          data_nascimento?: string | null;
          dpp?: string | null;
          endereco_atendimento?: Json | null;
          estado_sensivel?: Database["public"]["Enums"]["estado_sensivel"];
          estado_sensivel_em?: string | null;
          estado_sensivel_motivo?: string | null;
          estado_sensivel_por?: string | null;
          familia_anterior_id?: string | null;
          gemelar?: boolean;
          historico_sensivel?: boolean;
          id?: string;
          indicacao_familia_id?: string | null;
          indicacao_medico_id?: string | null;
          mesclada_em_id?: string | null;
          municipio_codigo_ibge?: number | null;
          nao_contatar?: boolean;
          nao_contatar_em?: string | null;
          nao_contatar_motivo?: string | null;
          nome_exibicao?: string;
          origem?: Database["public"]["Enums"]["origem_lead"];
          primeira_gestacao?: boolean | null;
          regiao_id?: string | null;
          utm?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "familia_cidade_id_fkey";
            columns: ["cidade_id"];
            isOneToOne: false;
            referencedRelation: "cidade";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "familia_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "familia_familia_anterior_id_fkey";
            columns: ["familia_anterior_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "familia_indicacao_familia_id_fkey";
            columns: ["indicacao_familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "familia_mesclada_em_id_fkey";
            columns: ["mesclada_em_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "familia_municipio_codigo_ibge_fkey";
            columns: ["municipio_codigo_ibge"];
            isOneToOne: false;
            referencedRelation: "municipio";
            referencedColumns: ["codigo_ibge"];
          },
          {
            foreignKeyName: "familia_regiao_id_fkey";
            columns: ["regiao_id"];
            isOneToOne: false;
            referencedRelation: "regiao";
            referencedColumns: ["id"];
          },
        ];
      };
      fila_sincronizacao: {
        Row: {
          campo: string | null;
          conflito: Json | null;
          criado_no_cliente_em: string;
          entidade: string;
          entidade_id: string | null;
          id: string;
          payload: Json;
          recebido_em: string;
          status: Database["public"]["Enums"]["status_sync"];
          tentativas: number;
          usuario_id: string;
          versao_base: number | null;
        };
        Insert: {
          campo?: string | null;
          conflito?: Json | null;
          criado_no_cliente_em: string;
          entidade: string;
          entidade_id?: string | null;
          id: string;
          payload: Json;
          recebido_em?: string;
          status?: Database["public"]["Enums"]["status_sync"];
          tentativas?: number;
          usuario_id: string;
          versao_base?: number | null;
        };
        Update: {
          campo?: string | null;
          conflito?: Json | null;
          criado_no_cliente_em?: string;
          entidade?: string;
          entidade_id?: string | null;
          id?: string;
          payload?: Json;
          recebido_em?: string;
          status?: Database["public"]["Enums"]["status_sync"];
          tentativas?: number;
          usuario_id?: string;
          versao_base?: number | null;
        };
        Relationships: [];
      };
      handoff: {
        Row: {
          assumido_em: string | null;
          assumido_por: string | null;
          atualizado_em: string;
          conversa_id: string | null;
          criado_em: string;
          criado_por: string | null;
          dados: Json;
          destino: Database["public"]["Enums"]["handoff_destino"];
          familia_id: string | null;
          id: string;
          motivo: Database["public"]["Enums"]["handoff_motivo"];
          notificacao_ok: boolean | null;
          notificado_em: string | null;
          prioridade: Database["public"]["Enums"]["prioridade"];
          resolvido_em: string | null;
          resumo: string;
          sla_vence_em: string | null;
          solicitacao: string | null;
          status: Database["public"]["Enums"]["status_handoff"];
        };
        Insert: {
          assumido_em?: string | null;
          assumido_por?: string | null;
          atualizado_em?: string;
          conversa_id?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          dados?: Json;
          destino: Database["public"]["Enums"]["handoff_destino"];
          familia_id?: string | null;
          id?: string;
          motivo: Database["public"]["Enums"]["handoff_motivo"];
          notificacao_ok?: boolean | null;
          notificado_em?: string | null;
          prioridade: Database["public"]["Enums"]["prioridade"];
          resolvido_em?: string | null;
          resumo: string;
          sla_vence_em?: string | null;
          solicitacao?: string | null;
          status?: Database["public"]["Enums"]["status_handoff"];
        };
        Update: {
          assumido_em?: string | null;
          assumido_por?: string | null;
          atualizado_em?: string;
          conversa_id?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          dados?: Json;
          destino?: Database["public"]["Enums"]["handoff_destino"];
          familia_id?: string | null;
          id?: string;
          motivo?: Database["public"]["Enums"]["handoff_motivo"];
          notificacao_ok?: boolean | null;
          notificado_em?: string | null;
          prioridade?: Database["public"]["Enums"]["prioridade"];
          resolvido_em?: string | null;
          resumo?: string;
          sla_vence_em?: string | null;
          solicitacao?: string | null;
          status?: Database["public"]["Enums"]["status_handoff"];
        };
        Relationships: [
          {
            foreignKeyName: "handoff_assumido_por_fkey";
            columns: ["assumido_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handoff_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "conversa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handoff_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handoff_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
        ];
      };
      instrumento: {
        Row: {
          aprovado_em: string | null;
          aprovado_por: string | null;
          atualizado_em: string;
          codigo: string;
          criado_em: string;
          criado_por: string | null;
          definicao: Json;
          id: string;
          versao: string;
          vigente: boolean;
        };
        Insert: {
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          atualizado_em?: string;
          codigo: string;
          criado_em?: string;
          criado_por?: string | null;
          definicao: Json;
          id?: string;
          versao: string;
          vigente?: boolean;
        };
        Update: {
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          atualizado_em?: string;
          codigo?: string;
          criado_em?: string;
          criado_por?: string | null;
          definicao?: Json;
          id?: string;
          versao?: string;
          vigente?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "instrumento_aprovado_por_fkey";
            columns: ["aprovado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "instrumento_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      log_auditoria: {
        Row: {
          acao: string;
          criado_em: string;
          entidade: string;
          entidade_id: string | null;
          id: number;
          ip: string | null;
          origem: string | null;
          usuario_id: string | null;
          valor_antes: Json | null;
          valor_depois: Json | null;
        };
        Insert: {
          acao: string;
          criado_em?: string;
          entidade: string;
          entidade_id?: string | null;
          id?: number;
          ip?: string | null;
          origem?: string | null;
          usuario_id?: string | null;
          valor_antes?: Json | null;
          valor_depois?: Json | null;
        };
        Update: {
          acao?: string;
          criado_em?: string;
          entidade?: string;
          entidade_id?: string | null;
          id?: number;
          ip?: string | null;
          origem?: string | null;
          usuario_id?: string | null;
          valor_antes?: Json | null;
          valor_depois?: Json | null;
        };
        Relationships: [];
      };
      medico: {
        Row: {
          atualizado_em: string;
          capturado_em: string | null;
          criado_em: string;
          criado_por: string | null;
          email: string | null;
          especialidade: Database["public"]["Enums"]["especialidade_medico"];
          familia_id: string | null;
          hospital: string | null;
          id: string;
          nome: string;
          origem_cadastro: string | null;
          telefone_e164: string | null;
        };
        Insert: {
          atualizado_em?: string;
          capturado_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          email?: string | null;
          especialidade: Database["public"]["Enums"]["especialidade_medico"];
          familia_id?: string | null;
          hospital?: string | null;
          id?: string;
          nome: string;
          origem_cadastro?: string | null;
          telefone_e164?: string | null;
        };
        Update: {
          atualizado_em?: string;
          capturado_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          email?: string | null;
          especialidade?: Database["public"]["Enums"]["especialidade_medico"];
          familia_id?: string | null;
          hospital?: string | null;
          id?: string;
          nome?: string;
          origem_cadastro?: string | null;
          telefone_e164?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "medico_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medico_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
        ];
      };
      mensagem: {
        Row: {
          conteudo: string | null;
          conversa_id: string;
          criado_em: string;
          criado_por: string | null;
          direcao: Database["public"]["Enums"]["direcao_mensagem"];
          enviada_em: string;
          enviado_por: Database["public"]["Enums"]["enviado_por"];
          id: string;
          midia_path: string | null;
          tipo: string;
          transcricao: string | null;
          wa_message_id: string | null;
        };
        Insert: {
          conteudo?: string | null;
          conversa_id: string;
          criado_em?: string;
          criado_por?: string | null;
          direcao: Database["public"]["Enums"]["direcao_mensagem"];
          enviada_em?: string;
          enviado_por: Database["public"]["Enums"]["enviado_por"];
          id?: string;
          midia_path?: string | null;
          tipo?: string;
          transcricao?: string | null;
          wa_message_id?: string | null;
        };
        Update: {
          conteudo?: string | null;
          conversa_id?: string;
          criado_em?: string;
          criado_por?: string | null;
          direcao?: Database["public"]["Enums"]["direcao_mensagem"];
          enviada_em?: string;
          enviado_por?: Database["public"]["Enums"]["enviado_por"];
          id?: string;
          midia_path?: string | null;
          tipo?: string;
          transcricao?: string | null;
          wa_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mensagem_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "conversa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mensagem_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      mensagem_modelo: {
        Row: {
          aprovado_em: string | null;
          aprovado_por: string | null;
          atualizado_em: string;
          canal: Database["public"]["Enums"]["canal_contato"];
          chave: string;
          destinatario: string;
          status: Database["public"]["Enums"]["status_conteudo"];
          texto: string;
          variaveis: string[];
        };
        Insert: {
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          atualizado_em?: string;
          canal?: Database["public"]["Enums"]["canal_contato"];
          chave: string;
          destinatario: string;
          status?: Database["public"]["Enums"]["status_conteudo"];
          texto: string;
          variaveis?: string[];
        };
        Update: {
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          atualizado_em?: string;
          canal?: Database["public"]["Enums"]["canal_contato"];
          chave?: string;
          destinatario?: string;
          status?: Database["public"]["Enums"]["status_conteudo"];
          texto?: string;
          variaveis?: string[];
        };
        Relationships: [];
      };
      municipio: {
        Row: {
          codigo_ibge: number;
          nome: string;
          regiao_intermediaria: string;
          uf: string;
        };
        Insert: {
          codigo_ibge: number;
          nome: string;
          regiao_intermediaria: string;
          uf: string;
        };
        Update: {
          codigo_ibge?: number;
          nome?: string;
          regiao_intermediaria?: string;
          uf?: string;
        };
        Relationships: [];
      };
      nota_fiscal: {
        Row: {
          atualizado_em: string;
          cobranca_id: string;
          criado_em: string;
          criado_por: string | null;
          emitida_em: string | null;
          erro: string | null;
          id: string;
          numero: string | null;
          pdf_path: string | null;
          provider: string;
          provider_ref: string | null;
          status: Database["public"]["Enums"]["status_nota"];
          xml_path: string | null;
        };
        Insert: {
          atualizado_em?: string;
          cobranca_id: string;
          criado_em?: string;
          criado_por?: string | null;
          emitida_em?: string | null;
          erro?: string | null;
          id?: string;
          numero?: string | null;
          pdf_path?: string | null;
          provider: string;
          provider_ref?: string | null;
          status?: Database["public"]["Enums"]["status_nota"];
          xml_path?: string | null;
        };
        Update: {
          atualizado_em?: string;
          cobranca_id?: string;
          criado_em?: string;
          criado_por?: string | null;
          emitida_em?: string | null;
          erro?: string | null;
          id?: string;
          numero?: string | null;
          pdf_path?: string | null;
          provider?: string;
          provider_ref?: string | null;
          status?: Database["public"]["Enums"]["status_nota"];
          xml_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_cobranca_id_fkey";
            columns: ["cobranca_id"];
            isOneToOne: false;
            referencedRelation: "cobranca";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nota_fiscal_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      notificacao: {
        Row: {
          atualizado_em: string;
          canais: string[];
          corpo: string | null;
          criado_em: string;
          criado_por: string | null;
          id: string;
          lida_em: string | null;
          link: string | null;
          papel: Database["public"]["Enums"]["papel_usuario"] | null;
          prioridade: Database["public"]["Enums"]["prioridade"];
          titulo: string;
          usuario_id: string | null;
        };
        Insert: {
          atualizado_em?: string;
          canais?: string[];
          corpo?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          lida_em?: string | null;
          link?: string | null;
          papel?: Database["public"]["Enums"]["papel_usuario"] | null;
          prioridade?: Database["public"]["Enums"]["prioridade"];
          titulo: string;
          usuario_id?: string | null;
        };
        Update: {
          atualizado_em?: string;
          canais?: string[];
          corpo?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          lida_em?: string | null;
          link?: string | null;
          papel?: Database["public"]["Enums"]["papel_usuario"] | null;
          prioridade?: Database["public"]["Enums"]["prioridade"];
          titulo?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notificacao_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacao_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      ocorrencia: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          descricao: string;
          familia_id: string | null;
          historico: Json;
          id: string;
          prioridade: Database["public"]["Enums"]["prioridade"];
          privada: boolean;
          profissional_id: string | null;
          responsavel_id: string | null;
          sla_vence_em: string | null;
          status: Database["public"]["Enums"]["status_ocorrencia"];
          tipo: Database["public"]["Enums"]["tipo_ocorrencia"];
          titulo: string;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          descricao: string;
          familia_id?: string | null;
          historico?: Json;
          id?: string;
          prioridade: Database["public"]["Enums"]["prioridade"];
          privada?: boolean;
          profissional_id?: string | null;
          responsavel_id?: string | null;
          sla_vence_em?: string | null;
          status?: Database["public"]["Enums"]["status_ocorrencia"];
          tipo: Database["public"]["Enums"]["tipo_ocorrencia"];
          titulo: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          descricao?: string;
          familia_id?: string | null;
          historico?: Json;
          id?: string;
          prioridade?: Database["public"]["Enums"]["prioridade"];
          privada?: boolean;
          profissional_id?: string | null;
          responsavel_id?: string | null;
          sla_vence_em?: string | null;
          status?: Database["public"]["Enums"]["status_ocorrencia"];
          tipo?: Database["public"]["Enums"]["tipo_ocorrencia"];
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ocorrencia_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ocorrencia_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ocorrencia_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissional";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ocorrencia_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      oportunidade: {
        Row: {
          atualizado_em: string;
          cadencia_etapa: number;
          classificacao:
            Database["public"]["Enums"]["classificacao_lead"] | null;
          condicao_id: string | null;
          criado_em: string;
          criado_por: string | null;
          desconto_aprovado_por: string | null;
          desconto_motivo: string | null;
          desconto_pct: number;
          estagio_p1: Database["public"]["Enums"]["estagio_p1"] | null;
          estagio_p2: Database["public"]["Enums"]["estagio_p2"] | null;
          familia_id: string;
          id: string;
          motivo_perda: Database["public"]["Enums"]["motivo_perda"] | null;
          motivo_perda_detalhe: string | null;
          pagador_pessoa_id: string | null;
          pagamento_preferido: string | null;
          para_quem: string | null;
          pdf_enviado_em: string | null;
          pipeline: number;
          plano_interesse_pacote_id: string | null;
          proximo_contato_em: string | null;
          qualificacao: Json;
          responsavel_id: string | null;
          score: number | null;
          sessao_interesse_em: string | null;
        };
        Insert: {
          atualizado_em?: string;
          cadencia_etapa?: number;
          classificacao?:
            Database["public"]["Enums"]["classificacao_lead"] | null;
          condicao_id?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          desconto_aprovado_por?: string | null;
          desconto_motivo?: string | null;
          desconto_pct?: number;
          estagio_p1?: Database["public"]["Enums"]["estagio_p1"] | null;
          estagio_p2?: Database["public"]["Enums"]["estagio_p2"] | null;
          familia_id: string;
          id?: string;
          motivo_perda?: Database["public"]["Enums"]["motivo_perda"] | null;
          motivo_perda_detalhe?: string | null;
          pagador_pessoa_id?: string | null;
          pagamento_preferido?: string | null;
          para_quem?: string | null;
          pdf_enviado_em?: string | null;
          pipeline: number;
          plano_interesse_pacote_id?: string | null;
          proximo_contato_em?: string | null;
          qualificacao?: Json;
          responsavel_id?: string | null;
          score?: number | null;
          sessao_interesse_em?: string | null;
        };
        Update: {
          atualizado_em?: string;
          cadencia_etapa?: number;
          classificacao?:
            Database["public"]["Enums"]["classificacao_lead"] | null;
          condicao_id?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          desconto_aprovado_por?: string | null;
          desconto_motivo?: string | null;
          desconto_pct?: number;
          estagio_p1?: Database["public"]["Enums"]["estagio_p1"] | null;
          estagio_p2?: Database["public"]["Enums"]["estagio_p2"] | null;
          familia_id?: string;
          id?: string;
          motivo_perda?: Database["public"]["Enums"]["motivo_perda"] | null;
          motivo_perda_detalhe?: string | null;
          pagador_pessoa_id?: string | null;
          pagamento_preferido?: string | null;
          para_quem?: string | null;
          pdf_enviado_em?: string | null;
          pipeline?: number;
          plano_interesse_pacote_id?: string | null;
          proximo_contato_em?: string | null;
          qualificacao?: Json;
          responsavel_id?: string | null;
          score?: number | null;
          sessao_interesse_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "oportunidade_condicao_id_fkey";
            columns: ["condicao_id"];
            isOneToOne: false;
            referencedRelation: "condicao_comercial";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidade_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidade_desconto_aprovado_por_fkey";
            columns: ["desconto_aprovado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidade_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidade_pagador_pessoa_id_fkey";
            columns: ["pagador_pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidade_plano_interesse_pacote_id_fkey";
            columns: ["plano_interesse_pacote_id"];
            isOneToOne: false;
            referencedRelation: "pacote";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidade_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      pacote: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          dias: number;
          gemelar: boolean;
          id: string;
          linha: string | null;
          nome: string;
          ordem: number;
          pagina_pdf: number | null;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          dias: number;
          gemelar?: boolean;
          id?: string;
          linha?: string | null;
          nome: string;
          ordem?: number;
          pagina_pdf?: number | null;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          dias?: number;
          gemelar?: boolean;
          id?: string;
          linha?: string | null;
          nome?: string;
          ordem?: number;
          pagina_pdf?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "pacote_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      pacote_versao: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          destaque: string | null;
          horas_por_visita: number;
          id: string;
          inclui: string[] | null;
          nao_inclui: string[] | null;
          pacote_id: string;
          parcelas_max_sem_juros: number;
          valor_centavos: number;
          vigencia_fim: string | null;
          vigencia_inicio: string;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          destaque?: string | null;
          horas_por_visita: number;
          id?: string;
          inclui?: string[] | null;
          nao_inclui?: string[] | null;
          pacote_id: string;
          parcelas_max_sem_juros?: number;
          valor_centavos: number;
          vigencia_fim?: string | null;
          vigencia_inicio: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          destaque?: string | null;
          horas_por_visita?: number;
          id?: string;
          inclui?: string[] | null;
          nao_inclui?: string[] | null;
          pacote_id?: string;
          parcelas_max_sem_juros?: number;
          valor_centavos?: number;
          vigencia_fim?: string | null;
          vigencia_inicio?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pacote_versao_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pacote_versao_pacote_id_fkey";
            columns: ["pacote_id"];
            isOneToOne: false;
            referencedRelation: "pacote";
            referencedColumns: ["id"];
          },
        ];
      };
      parametro: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          chave: string;
          descricao: string | null;
          valor: Json;
        };
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          chave: string;
          descricao?: string | null;
          valor: Json;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          chave?: string;
          descricao?: string | null;
          valor?: Json;
        };
        Relationships: [];
      };
      perfil: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          email: string;
          id: string;
          nome: string;
          profissional_id: string | null;
          telefone_e164: string | null;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          email: string;
          id: string;
          nome: string;
          profissional_id?: string | null;
          telefone_e164?: string | null;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          email?: string;
          id?: string;
          nome?: string;
          profissional_id?: string | null;
          telefone_e164?: string | null;
        };
        Relationships: [];
      };
      pessoa: {
        Row: {
          atualizado_em: string;
          consentimentos: Json;
          contato_principal: boolean;
          criado_em: string;
          criado_por: string | null;
          email: string | null;
          familia_id: string;
          id: string;
          idade: number | null;
          nome: string;
          ocupacao: string | null;
          papel: Database["public"]["Enums"]["papel_pessoa"];
          telefone_e164: string | null;
        };
        Insert: {
          atualizado_em?: string;
          consentimentos?: Json;
          contato_principal?: boolean;
          criado_em?: string;
          criado_por?: string | null;
          email?: string | null;
          familia_id: string;
          id?: string;
          idade?: number | null;
          nome: string;
          ocupacao?: string | null;
          papel: Database["public"]["Enums"]["papel_pessoa"];
          telefone_e164?: string | null;
        };
        Update: {
          atualizado_em?: string;
          consentimentos?: Json;
          contato_principal?: boolean;
          criado_em?: string;
          criado_por?: string | null;
          email?: string | null;
          familia_id?: string;
          id?: string;
          idade?: number | null;
          nome?: string;
          ocupacao?: string | null;
          papel?: Database["public"]["Enums"]["papel_pessoa"];
          telefone_e164?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pessoa_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pessoa_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
        ];
      };
      pessoa_dados_contrato: {
        Row: {
          atualizado_em: string;
          cpf: string | null;
          criado_em: string;
          criado_por: string | null;
          data_nascimento: string | null;
          endereco_residencial: Json | null;
          id: string;
          pessoa_id: string;
          preenchido_via: string;
        };
        Insert: {
          atualizado_em?: string;
          cpf?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data_nascimento?: string | null;
          endereco_residencial?: Json | null;
          id?: string;
          pessoa_id: string;
          preenchido_via?: string;
        };
        Update: {
          atualizado_em?: string;
          cpf?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data_nascimento?: string | null;
          endereco_residencial?: Json | null;
          id?: string;
          pessoa_id?: string;
          preenchido_via?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pessoa_dados_contrato_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pessoa_dados_contrato_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: true;
            referencedRelation: "pessoa";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_venda: {
        Row: {
          acao_executada_em: string | null;
          acompanhamento_id: string;
          atualizado_em: string;
          autorizacao_imagem: boolean | null;
          classificacao:
            Database["public"]["Enums"]["classificacao_nps"] | null;
          criado_em: string;
          criado_por: string | null;
          depoimento_autorizado: boolean | null;
          estagio: Database["public"]["Enums"]["estagio_p4"];
          id: string;
          nps: number | null;
          pesquisa_enviada_em: string | null;
          pesquisa_respondida_em: string | null;
          pesquisa_token_hash: string | null;
          respostas: Json | null;
        };
        Insert: {
          acao_executada_em?: string | null;
          acompanhamento_id: string;
          atualizado_em?: string;
          autorizacao_imagem?: boolean | null;
          classificacao?:
            Database["public"]["Enums"]["classificacao_nps"] | null;
          criado_em?: string;
          criado_por?: string | null;
          depoimento_autorizado?: boolean | null;
          estagio?: Database["public"]["Enums"]["estagio_p4"];
          id?: string;
          nps?: number | null;
          pesquisa_enviada_em?: string | null;
          pesquisa_respondida_em?: string | null;
          pesquisa_token_hash?: string | null;
          respostas?: Json | null;
        };
        Update: {
          acao_executada_em?: string | null;
          acompanhamento_id?: string;
          atualizado_em?: string;
          autorizacao_imagem?: boolean | null;
          classificacao?:
            Database["public"]["Enums"]["classificacao_nps"] | null;
          criado_em?: string;
          criado_por?: string | null;
          depoimento_autorizado?: boolean | null;
          estagio?: Database["public"]["Enums"]["estagio_p4"];
          id?: string;
          nps?: number | null;
          pesquisa_enviada_em?: string | null;
          pesquisa_respondida_em?: string | null;
          pesquisa_token_hash?: string | null;
          respostas?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "pos_venda_acompanhamento_id_fkey";
            columns: ["acompanhamento_id"];
            isOneToOne: true;
            referencedRelation: "acompanhamento";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_venda_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      profissional: {
        Row: {
          adicional_deslocamento_centavos: number;
          ativa: boolean;
          atualizado_em: string;
          conselho: string | null;
          conselho_numero: string | null;
          conselho_uf: string | null;
          criado_em: string;
          criado_por: string | null;
          funcao: string;
          id: string;
          nome: string;
          regioes: string[];
          telefone_e164: string | null;
          usuario_id: string | null;
          valor_hora_centavos: number | null;
          vinculo: Database["public"]["Enums"]["vinculo_profissional"];
        };
        Insert: {
          adicional_deslocamento_centavos?: number;
          ativa?: boolean;
          atualizado_em?: string;
          conselho?: string | null;
          conselho_numero?: string | null;
          conselho_uf?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          funcao: string;
          id?: string;
          nome: string;
          regioes?: string[];
          telefone_e164?: string | null;
          usuario_id?: string | null;
          valor_hora_centavos?: number | null;
          vinculo?: Database["public"]["Enums"]["vinculo_profissional"];
        };
        Update: {
          adicional_deslocamento_centavos?: number;
          ativa?: boolean;
          atualizado_em?: string;
          conselho?: string | null;
          conselho_numero?: string | null;
          conselho_uf?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          funcao?: string;
          id?: string;
          nome?: string;
          regioes?: string[];
          telefone_e164?: string | null;
          usuario_id?: string | null;
          valor_hora_centavos?: number | null;
          vinculo?: Database["public"]["Enums"]["vinculo_profissional"];
        };
        Relationships: [
          {
            foreignKeyName: "profissional_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profissional_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      regiao: {
        Row: {
          ativa: boolean;
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          id: string;
          limite_familias_semana: number;
          nome: string;
          praca: string;
          taxa_deslocamento_centavos: number;
        };
        Insert: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          limite_familias_semana: number;
          nome: string;
          praca: string;
          taxa_deslocamento_centavos?: number;
        };
        Update: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          limite_familias_semana?: number;
          nome?: string;
          praca?: string;
          taxa_deslocamento_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "regiao_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      registro_adendo: {
        Row: {
          autor_id: string;
          conteudo: string;
          criado_em: string;
          id: string;
          motivo: string;
          registro_id: string;
        };
        Insert: {
          autor_id: string;
          conteudo: string;
          criado_em?: string;
          id?: string;
          motivo: string;
          registro_id: string;
        };
        Update: {
          autor_id?: string;
          conteudo?: string;
          criado_em?: string;
          id?: string;
          motivo?: string;
          registro_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registro_adendo_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registro_adendo_registro_id_fkey";
            columns: ["registro_id"];
            isOneToOne: false;
            referencedRelation: "registro_atendimento";
            referencedColumns: ["id"];
          },
        ];
      };
      registro_atendimento: {
        Row: {
          assinado_em: string;
          assinatura: string;
          criado_em: string;
          dados: Json;
          id: string;
          instrumento_versao: string;
          profissional_id: string;
          resumo_descritivo: string;
          sincronizado_de: string | null;
          visita_id: string;
        };
        Insert: {
          assinado_em: string;
          assinatura: string;
          criado_em?: string;
          dados: Json;
          id?: string;
          instrumento_versao: string;
          profissional_id: string;
          resumo_descritivo: string;
          sincronizado_de?: string | null;
          visita_id: string;
        };
        Update: {
          assinado_em?: string;
          assinatura?: string;
          criado_em?: string;
          dados?: Json;
          id?: string;
          instrumento_versao?: string;
          profissional_id?: string;
          resumo_descritivo?: string;
          sincronizado_de?: string | null;
          visita_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registro_atendimento_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissional";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registro_atendimento_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visita";
            referencedColumns: ["id"];
          },
        ];
      };
      regra_alerta: {
        Row: {
          ativa: boolean;
          campo: string | null;
          condicao: Json | null;
          conduta: string;
          descricao: string;
          grupo: string;
          id: string;
          instrumento_versao: string;
          severidade: Database["public"]["Enums"]["severidade"];
        };
        Insert: {
          ativa?: boolean;
          campo?: string | null;
          condicao?: Json | null;
          conduta: string;
          descricao: string;
          grupo: string;
          id: string;
          instrumento_versao: string;
          severidade: Database["public"]["Enums"]["severidade"];
        };
        Update: {
          ativa?: boolean;
          campo?: string | null;
          condicao?: Json | null;
          conduta?: string;
          descricao?: string;
          grupo?: string;
          id?: string;
          instrumento_versao?: string;
          severidade?: Database["public"]["Enums"]["severidade"];
        };
        Relationships: [];
      };
      regua_faixa: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          gatilho_comercial: string;
          id: string;
          mensagem_chave: string;
          objetivo: string;
          ordem: number;
          semana_max: number | null;
          semana_min: number | null;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          gatilho_comercial: string;
          id?: string;
          mensagem_chave: string;
          objetivo: string;
          ordem: number;
          semana_max?: number | null;
          semana_min?: number | null;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          gatilho_comercial?: string;
          id?: string;
          mensagem_chave?: string;
          objetivo?: string;
          ordem?: number;
          semana_max?: number | null;
          semana_min?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "regua_faixa_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "regua_faixa_mensagem_chave_fkey";
            columns: ["mensagem_chave"];
            isOneToOne: false;
            referencedRelation: "mensagem_modelo";
            referencedColumns: ["chave"];
          },
        ];
      };
      relatorio_medico: {
        Row: {
          acompanhamento_id: string;
          aprovado_em: string | null;
          aprovado_por: string | null;
          atualizado_em: string;
          bebe_id: string | null;
          conteudo: Json;
          criado_em: string;
          criado_por: string | null;
          destinatarios: Json | null;
          enviado_em: string | null;
          id: string;
          pdf_path: string | null;
          profissional_id: string;
          status: Database["public"]["Enums"]["status_relatorio"];
          tipo: Database["public"]["Enums"]["tipo_relatorio"];
        };
        Insert: {
          acompanhamento_id: string;
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          atualizado_em?: string;
          bebe_id?: string | null;
          conteudo: Json;
          criado_em?: string;
          criado_por?: string | null;
          destinatarios?: Json | null;
          enviado_em?: string | null;
          id?: string;
          pdf_path?: string | null;
          profissional_id: string;
          status?: Database["public"]["Enums"]["status_relatorio"];
          tipo: Database["public"]["Enums"]["tipo_relatorio"];
        };
        Update: {
          acompanhamento_id?: string;
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          atualizado_em?: string;
          bebe_id?: string | null;
          conteudo?: Json;
          criado_em?: string;
          criado_por?: string | null;
          destinatarios?: Json | null;
          enviado_em?: string | null;
          id?: string;
          pdf_path?: string | null;
          profissional_id?: string;
          status?: Database["public"]["Enums"]["status_relatorio"];
          tipo?: Database["public"]["Enums"]["tipo_relatorio"];
        };
        Relationships: [
          {
            foreignKeyName: "relatorio_medico_acompanhamento_id_fkey";
            columns: ["acompanhamento_id"];
            isOneToOne: false;
            referencedRelation: "acompanhamento";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "relatorio_medico_aprovado_por_fkey";
            columns: ["aprovado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "relatorio_medico_bebe_id_fkey";
            columns: ["bebe_id"];
            isOneToOne: false;
            referencedRelation: "bebe";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "relatorio_medico_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "relatorio_medico_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissional";
            referencedColumns: ["id"];
          },
        ];
      };
      sessao_venda: {
        Row: {
          agendada_para: string | null;
          atualizado_em: string;
          conduzida_por: string | null;
          criado_em: string;
          criado_por: string | null;
          familia_id: string;
          id: string;
          link_reuniao: string | null;
          opcoes_informadas: string | null;
          parceiro_presente: boolean | null;
          realizada_em: string | null;
          status: Database["public"]["Enums"]["status_sessao"];
        };
        Insert: {
          agendada_para?: string | null;
          atualizado_em?: string;
          conduzida_por?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          familia_id: string;
          id?: string;
          link_reuniao?: string | null;
          opcoes_informadas?: string | null;
          parceiro_presente?: boolean | null;
          realizada_em?: string | null;
          status?: Database["public"]["Enums"]["status_sessao"];
        };
        Update: {
          agendada_para?: string | null;
          atualizado_em?: string;
          conduzida_por?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          familia_id?: string;
          id?: string;
          link_reuniao?: string | null;
          opcoes_informadas?: string | null;
          parceiro_presente?: boolean | null;
          realizada_em?: string | null;
          status?: Database["public"]["Enums"]["status_sessao"];
        };
        Relationships: [
          {
            foreignKeyName: "sessao_venda_conduzida_por_fkey";
            columns: ["conduzida_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessao_venda_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessao_venda_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
        ];
      };
      sessao_venda_gravacao: {
        Row: {
          atualizado_em: string;
          consentimento_em: string | null;
          consentimento_gravacao: boolean;
          consentimento_versao: string | null;
          criado_em: string;
          criado_por: string | null;
          gravacao_path: string | null;
          id: string;
          resumo: Json | null;
          sessao_id: string;
          transcricao: string | null;
        };
        Insert: {
          atualizado_em?: string;
          consentimento_em?: string | null;
          consentimento_gravacao?: boolean;
          consentimento_versao?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          gravacao_path?: string | null;
          id?: string;
          resumo?: Json | null;
          sessao_id: string;
          transcricao?: string | null;
        };
        Update: {
          atualizado_em?: string;
          consentimento_em?: string | null;
          consentimento_gravacao?: boolean;
          consentimento_versao?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          gravacao_path?: string | null;
          id?: string;
          resumo?: Json | null;
          sessao_id?: string;
          transcricao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sessao_venda_gravacao_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessao_venda_gravacao_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: true;
            referencedRelation: "sessao_venda";
            referencedColumns: ["id"];
          },
        ];
      };
      tarefa: {
        Row: {
          atualizado_em: string;
          concluida_em: string | null;
          concluida_por: string | null;
          criado_em: string;
          criado_por: string | null;
          familia_id: string | null;
          id: string;
          origem_automacao_id: string | null;
          papel_responsavel:
            Database["public"]["Enums"]["papel_usuario"] | null;
          payload: Json;
          prioridade: Database["public"]["Enums"]["prioridade"];
          responsavel_id: string | null;
          status: Database["public"]["Enums"]["status_tarefa"];
          tipo: Database["public"]["Enums"]["tipo_tarefa"];
          titulo: string;
          vence_em: string | null;
        };
        Insert: {
          atualizado_em?: string;
          concluida_em?: string | null;
          concluida_por?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          familia_id?: string | null;
          id?: string;
          origem_automacao_id?: string | null;
          papel_responsavel?:
            Database["public"]["Enums"]["papel_usuario"] | null;
          payload?: Json;
          prioridade?: Database["public"]["Enums"]["prioridade"];
          responsavel_id?: string | null;
          status?: Database["public"]["Enums"]["status_tarefa"];
          tipo: Database["public"]["Enums"]["tipo_tarefa"];
          titulo: string;
          vence_em?: string | null;
        };
        Update: {
          atualizado_em?: string;
          concluida_em?: string | null;
          concluida_por?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          familia_id?: string | null;
          id?: string;
          origem_automacao_id?: string | null;
          papel_responsavel?:
            Database["public"]["Enums"]["papel_usuario"] | null;
          payload?: Json;
          prioridade?: Database["public"]["Enums"]["prioridade"];
          responsavel_id?: string | null;
          status?: Database["public"]["Enums"]["status_tarefa"];
          tipo?: Database["public"]["Enums"]["tipo_tarefa"];
          titulo?: string;
          vence_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tarefa_concluida_por_fkey";
            columns: ["concluida_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tarefa_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tarefa_familia_id_fkey";
            columns: ["familia_id"];
            isOneToOne: false;
            referencedRelation: "familia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tarefa_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      termo_alerta: {
        Row: {
          acao: Database["public"]["Enums"]["acao_termo_alerta"];
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          id: string;
          mensagem_chave: string;
          termo: string;
        };
        Insert: {
          acao?: Database["public"]["Enums"]["acao_termo_alerta"];
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          mensagem_chave?: string;
          termo: string;
        };
        Update: {
          acao?: Database["public"]["Enums"]["acao_termo_alerta"];
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          mensagem_chave?: string;
          termo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "termo_alerta_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "termo_alerta_mensagem_chave_fkey";
            columns: ["mensagem_chave"];
            isOneToOne: false;
            referencedRelation: "mensagem_modelo";
            referencedColumns: ["chave"];
          },
        ];
      };
      usuario_papel: {
        Row: {
          papel: Database["public"]["Enums"]["papel_usuario"];
          usuario_id: string;
        };
        Insert: {
          papel: Database["public"]["Enums"]["papel_usuario"];
          usuario_id: string;
        };
        Update: {
          papel?: Database["public"]["Enums"]["papel_usuario"];
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usuario_papel_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      visita: {
        Row: {
          acompanhamento_id: string;
          atualizado_em: string;
          checkin_em: string | null;
          checkout_em: string | null;
          criado_em: string;
          criado_por: string | null;
          data: string;
          dia_numero: number;
          estado: Database["public"]["Enums"]["estado_visita"];
          hora_prevista: string | null;
          id: string;
          profissional_id: string;
          versao: number;
        };
        Insert: {
          acompanhamento_id: string;
          atualizado_em?: string;
          checkin_em?: string | null;
          checkout_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data: string;
          dia_numero: number;
          estado?: Database["public"]["Enums"]["estado_visita"];
          hora_prevista?: string | null;
          id?: string;
          profissional_id: string;
          versao?: number;
        };
        Update: {
          acompanhamento_id?: string;
          atualizado_em?: string;
          checkin_em?: string | null;
          checkout_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data?: string;
          dia_numero?: number;
          estado?: Database["public"]["Enums"]["estado_visita"];
          hora_prevista?: string | null;
          id?: string;
          profissional_id?: string;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: "visita_acompanhamento_id_fkey";
            columns: ["acompanhamento_id"];
            isOneToOne: false;
            referencedRelation: "acompanhamento";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visita_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visita_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "profissional";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      familia_elegivel_marketing: {
        Row: {
          cidade_id: string | null;
          codigo_origem: string | null;
          criado_em: string | null;
          dpp: string | null;
          gemelar: boolean | null;
          id: string | null;
          indicacao_familia_id: string | null;
          indicacao_medico_id: string | null;
          nome_exibicao: string | null;
          origem: Database["public"]["Enums"]["origem_lead"] | null;
          primeira_gestacao: boolean | null;
          regiao_id: string | null;
          utm: Json | null;
        };
        Relationships: [];
      };
      ocupacao_projetada: {
        Row: {
          capacidade_dias: number | null;
          dias_atendimento: number | null;
          familias: number | null;
          ocupacao_pct: number | null;
          regiao: string | null;
          regiao_id: string | null;
          semana: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      ig: {
        Args: { data: string; dpp: string };
        Returns: { dias: number; semanas: number; texto: string };
      };
    };
    Enums: {
      acao_termo_alerta: "handoff_saude" | "bloqueio_total";
      canal_contato:
        "whatsapp" | "site" | "email" | "telefone" | "presencial" | "outro";
      categoria_automacao: "interna" | "operacional" | "conteudo" | "marketing";
      classificacao_contato:
        | "nao_classificado"
        | "lead"
        | "cliente"
        | "candidata"
        | "parceiro_medico"
        | "fornecedor"
        | "consultorio"
        | "outro";
      classificacao_lead: "quente" | "morno" | "frio";
      classificacao_nps: "promotor" | "neutro" | "detrator";
      direcao_mensagem: "entrada" | "saida";
      enviado_por: "cliente" | "ia" | "humano" | "sistema";
      especialidade_medico: "obstetra" | "pediatra" | "outro";
      estado_acompanhamento:
        | "aguardando"
        | "ativo"
        | "em_execucao"
        | "ultima_visita_realizada"
        | "pendencias"
        | "encerrado"
        | "suspenso"
        | "interrompido_familia"
        | "interrompido_clinico"
        | "intercorrencia";
      estado_sensivel:
        "normal" | "atencao" | "bloqueio_total" | "encerrado_sensivel";
      estado_visita:
        | "agendada"
        | "confirmada"
        | "a_caminho"
        | "iniciada"
        | "concluida"
        | "ficha_pendente"
        | "ficha_entregue"
        | "encerrada"
        | "reagendada"
        | "cancelada"
        | "nao_realizada_familia"
        | "nao_realizada_profissional";
      estagio_p1:
        | "novo"
        | "em_conversa_ia"
        | "qualificado"
        | "sessao_venda_agendada"
        | "sessao_venda_realizada"
        | "nutricao"
        | "nao_qualificado"
        | "fora_de_cobertura"
        | "perdido";
      estagio_p2:
        | "proposta_enviada"
        | "em_negociacao"
        | "ganho"
        | "contrato_gerado"
        | "aguardando_assinatura"
        | "assinado"
        | "cobranca_gerada"
        | "pagamento_confirmado"
        | "nota_fiscal_emitida"
        | "consulta_prenatal_agendada"
        | "consulta_realizada"
        | "enfermeira_designada"
        | "aguardando_nascimento"
        | "bebe_nasceu"
        | "aguardando_alta"
        | "atendimento_liberado"
        | "perdido"
        | "cancelado"
        | "distrato"
        | "intercorrencia";
      estagio_p4:
        | "protocolo_ultimo_dia_concluido"
        | "pesquisa_enviada"
        | "pesquisa_respondida"
        | "classificado"
        | "acao_executada"
        | "arquivado";
      executor_automacao: "sistema" | "agente" | "humano_tarefa";
      handoff_destino: "comercial" | "coordenacao_clinica" | "operacao";
      handoff_motivo:
        | "contratar"
        | "reuniao"
        | "condicao_comercial"
        | "cobertura_taxa"
        | "reembolso_fiscal"
        | "bebe_nasceu"
        | "pos_venda_operacao"
        | "duvida_sem_resposta"
        | "saude"
        | "perda"
        | "reclamacao"
        | "pediu_humano"
        | "parceiro_medico"
        | "midia_recebida"
        | "validacao_resposta"
        | "estado_sensivel_escreveu"
        | "outro"
        | "audio_nao_transcrito";
      modo_agente: "desligado" | "teste" | "producao";
      modo_mensageria: "manual" | "uazapi" | "cloud_api";
      motivo_perda:
        | "fora_de_cobertura"
        | "preco"
        | "sem_disponibilidade"
        | "achou_que_nao_precisaria"
        | "optou_outro_servico"
        | "parceiro_nao_aprovou"
        | "sem_resposta"
        | "familia_assumiu"
        | "perda_gestacional"
        | "nao_contatar"
        | "sem_interesse"
        | "outro";
      origem_lead:
        | "instagram_organico"
        | "meta_ads"
        | "google"
        | "site"
        | "indicacao_medica"
        | "indicacao_cliente"
        | "indicacao_amigo"
        | "presente"
        | "evento"
        | "outro"
        | "desconhecida";
      papel_designacao: "titular" | "backup";
      papel_pessoa:
        "mae" | "parceiro" | "acompanhante" | "responsavel" | "presenteador";
      papel_usuario:
        | "comercial"
        | "enfermeira"
        | "financeiro"
        | "marketing"
        | "coordenacao"
        | "diretoria";
      periodo_visita: "manha" | "tarde" | "noite_avaliar";
      prioridade: "normal" | "alta" | "maxima";
      severidade: "imediato" | "prioritario" | "atencao" | "informativo";
      status_audio: "pendente" | "transcrevendo" | "transcrito" | "erro";
      status_cobranca:
        "aberta" | "paga" | "vencida" | "cancelada" | "estornada";
      status_consulta:
        "pendente" | "agendada" | "realizada" | "nao_realizada" | "cancelada";
      status_conteudo: "rascunho" | "aprovado" | "arquivado";
      status_contrato:
        | "rascunho"
        | "aguardando_dados"
        | "gerado"
        | "enviado"
        | "assinado"
        | "cancelado"
        | "distrato";
      status_designacao:
        "oferecida" | "aceita" | "recusada" | "expirada" | "cancelada";
      status_execucao:
        "agendada" | "executada" | "abortada_freio" | "falhou" | "cancelada";
      status_handoff: "aberto" | "assumido" | "resolvido" | "cancelado";
      status_ingestao: "ok" | "falhou";
      status_nota:
        "pendente" | "processando" | "emitida" | "erro" | "cancelada";
      status_ocorrencia:
        | "aberta"
        | "triagem"
        | "responsavel_definido"
        | "em_acompanhamento"
        | "resolvida"
        | "encerrada";
      status_profissional:
        | "em_visita"
        | "em_atendimento"
        | "reservada"
        | "backup"
        | "oferta_pendente"
        | "folga"
        | "livre";
      status_relatorio:
        "rascunho" | "em_revisao" | "aprovado" | "enviado" | "erro_envio";
      status_sessao:
        "agendada" | "realizada" | "nao_compareceu" | "remarcada" | "cancelada";
      status_sync: "pendente" | "processado" | "conflito" | "erro";
      status_tarefa: "aberta" | "em_andamento" | "concluida" | "cancelada";
      tipo_conteudo:
        | "institucional"
        | "faq"
        | "objecao"
        | "politica"
        | "depoimento"
        | "equipe"
        | "cobertura"
        | "plano";
      tipo_ocorrencia:
        | "intercorrencia"
        | "contato_perdido"
        | "registro_atrasado"
        | "capacidade"
        | "experiencia"
        | "reclamacao"
        | "detrator"
        | "outro";
      tipo_relatorio: "puerperal" | "neonatal";
      tipo_tarefa:
        | "nutricao_contato"
        | "followup_comercial"
        | "agendar_sessao"
        | "enviar_formulario_contrato"
        | "checkin_dpp"
        | "agendar_prenatal"
        | "designar_profissional"
        | "obter_contato_medico"
        | "emitir_evolucao"
        | "escuta_neutro"
        | "enviar_pesquisa"
        | "enviar_guia"
        | "cobranca_atraso"
        | "documento_vencendo"
        | "outro";
      vinculo_profissional:
        "clt" | "pj" | "mei" | "autonoma" | "socia" | "a_definir";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  api: {
    Enums: {},
  },
  public: {
    Enums: {
      acao_termo_alerta: ["handoff_saude", "bloqueio_total"],
      canal_contato: [
        "whatsapp",
        "site",
        "email",
        "telefone",
        "presencial",
        "outro",
      ],
      categoria_automacao: ["interna", "operacional", "conteudo", "marketing"],
      classificacao_contato: [
        "nao_classificado",
        "lead",
        "cliente",
        "candidata",
        "parceiro_medico",
        "fornecedor",
        "consultorio",
        "outro",
      ],
      classificacao_lead: ["quente", "morno", "frio"],
      classificacao_nps: ["promotor", "neutro", "detrator"],
      direcao_mensagem: ["entrada", "saida"],
      enviado_por: ["cliente", "ia", "humano", "sistema"],
      especialidade_medico: ["obstetra", "pediatra", "outro"],
      estado_acompanhamento: [
        "aguardando",
        "ativo",
        "em_execucao",
        "ultima_visita_realizada",
        "pendencias",
        "encerrado",
        "suspenso",
        "interrompido_familia",
        "interrompido_clinico",
        "intercorrencia",
      ],
      estado_sensivel: [
        "normal",
        "atencao",
        "bloqueio_total",
        "encerrado_sensivel",
      ],
      estado_visita: [
        "agendada",
        "confirmada",
        "a_caminho",
        "iniciada",
        "concluida",
        "ficha_pendente",
        "ficha_entregue",
        "encerrada",
        "reagendada",
        "cancelada",
        "nao_realizada_familia",
        "nao_realizada_profissional",
      ],
      estagio_p1: [
        "novo",
        "em_conversa_ia",
        "qualificado",
        "sessao_venda_agendada",
        "sessao_venda_realizada",
        "nutricao",
        "nao_qualificado",
        "fora_de_cobertura",
        "perdido",
      ],
      estagio_p2: [
        "proposta_enviada",
        "em_negociacao",
        "ganho",
        "contrato_gerado",
        "aguardando_assinatura",
        "assinado",
        "cobranca_gerada",
        "pagamento_confirmado",
        "nota_fiscal_emitida",
        "consulta_prenatal_agendada",
        "consulta_realizada",
        "enfermeira_designada",
        "aguardando_nascimento",
        "bebe_nasceu",
        "aguardando_alta",
        "atendimento_liberado",
        "perdido",
        "cancelado",
        "distrato",
        "intercorrencia",
      ],
      estagio_p4: [
        "protocolo_ultimo_dia_concluido",
        "pesquisa_enviada",
        "pesquisa_respondida",
        "classificado",
        "acao_executada",
        "arquivado",
      ],
      executor_automacao: ["sistema", "agente", "humano_tarefa"],
      handoff_destino: ["comercial", "coordenacao_clinica", "operacao"],
      handoff_motivo: [
        "contratar",
        "reuniao",
        "condicao_comercial",
        "cobertura_taxa",
        "reembolso_fiscal",
        "bebe_nasceu",
        "pos_venda_operacao",
        "duvida_sem_resposta",
        "saude",
        "perda",
        "reclamacao",
        "pediu_humano",
        "parceiro_medico",
        "midia_recebida",
        "validacao_resposta",
        "estado_sensivel_escreveu",
        "outro",
        "audio_nao_transcrito",
      ],
      modo_agente: ["desligado", "teste", "producao"],
      modo_mensageria: ["manual", "uazapi", "cloud_api"],
      motivo_perda: [
        "fora_de_cobertura",
        "preco",
        "sem_disponibilidade",
        "achou_que_nao_precisaria",
        "optou_outro_servico",
        "parceiro_nao_aprovou",
        "sem_resposta",
        "familia_assumiu",
        "perda_gestacional",
        "nao_contatar",
        "sem_interesse",
        "outro",
      ],
      origem_lead: [
        "instagram_organico",
        "meta_ads",
        "google",
        "site",
        "indicacao_medica",
        "indicacao_cliente",
        "indicacao_amigo",
        "presente",
        "evento",
        "outro",
        "desconhecida",
      ],
      papel_designacao: ["titular", "backup"],
      papel_pessoa: [
        "mae",
        "parceiro",
        "acompanhante",
        "responsavel",
        "presenteador",
      ],
      papel_usuario: [
        "comercial",
        "enfermeira",
        "financeiro",
        "marketing",
        "coordenacao",
        "diretoria",
      ],
      periodo_visita: ["manha", "tarde", "noite_avaliar"],
      prioridade: ["normal", "alta", "maxima"],
      severidade: ["imediato", "prioritario", "atencao", "informativo"],
      status_audio: ["pendente", "transcrevendo", "transcrito", "erro"],
      status_cobranca: ["aberta", "paga", "vencida", "cancelada", "estornada"],
      status_consulta: [
        "pendente",
        "agendada",
        "realizada",
        "nao_realizada",
        "cancelada",
      ],
      status_conteudo: ["rascunho", "aprovado", "arquivado"],
      status_contrato: [
        "rascunho",
        "aguardando_dados",
        "gerado",
        "enviado",
        "assinado",
        "cancelado",
        "distrato",
      ],
      status_designacao: [
        "oferecida",
        "aceita",
        "recusada",
        "expirada",
        "cancelada",
      ],
      status_execucao: [
        "agendada",
        "executada",
        "abortada_freio",
        "falhou",
        "cancelada",
      ],
      status_handoff: ["aberto", "assumido", "resolvido", "cancelado"],
      status_ingestao: ["ok", "falhou"],
      status_nota: ["pendente", "processando", "emitida", "erro", "cancelada"],
      status_ocorrencia: [
        "aberta",
        "triagem",
        "responsavel_definido",
        "em_acompanhamento",
        "resolvida",
        "encerrada",
      ],
      status_profissional: [
        "em_visita",
        "em_atendimento",
        "reservada",
        "backup",
        "oferta_pendente",
        "folga",
        "livre",
      ],
      status_relatorio: [
        "rascunho",
        "em_revisao",
        "aprovado",
        "enviado",
        "erro_envio",
      ],
      status_sessao: [
        "agendada",
        "realizada",
        "nao_compareceu",
        "remarcada",
        "cancelada",
      ],
      status_sync: ["pendente", "processado", "conflito", "erro"],
      status_tarefa: ["aberta", "em_andamento", "concluida", "cancelada"],
      tipo_conteudo: [
        "institucional",
        "faq",
        "objecao",
        "politica",
        "depoimento",
        "equipe",
        "cobertura",
        "plano",
      ],
      tipo_ocorrencia: [
        "intercorrencia",
        "contato_perdido",
        "registro_atrasado",
        "capacidade",
        "experiencia",
        "reclamacao",
        "detrator",
        "outro",
      ],
      tipo_relatorio: ["puerperal", "neonatal"],
      tipo_tarefa: [
        "nutricao_contato",
        "followup_comercial",
        "agendar_sessao",
        "enviar_formulario_contrato",
        "checkin_dpp",
        "agendar_prenatal",
        "designar_profissional",
        "obter_contato_medico",
        "emitir_evolucao",
        "escuta_neutro",
        "enviar_pesquisa",
        "enviar_guia",
        "cobranca_atraso",
        "documento_vencendo",
        "outro",
      ],
      vinculo_profissional: [
        "clt",
        "pj",
        "mei",
        "autonoma",
        "socia",
        "a_definir",
      ],
    },
  },
} as const;
