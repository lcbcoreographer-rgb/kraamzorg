-- =============================================================================
-- 0045_instrumentos_v1.sql
--
-- P34 (PROMPTS.md v2) · PRD 6.5 (instrumento), 9.1 a 9.4 e Apêndice B
--
-- Migration de dados. Carrega a definição v1 dos quatro instrumentos
-- clínicos (DOC 1 a DOC 4) com vigente = false: nenhuma versão vale até a
-- coordenação aprovar na tela de instrumentos (PRD 9, CLAUDE.md, "Clínico").
--
-- GERADA por scripts/gerar-migration-instrumentos.mjs a partir de
-- supabase/dados/instrumentos/doc1.json a doc4.json. Não edite à mão.
--
-- Conflito com (codigo, versao) já existente: só substitui a definição
-- provisória sem blocos que o seed.sql do P08 deixou ("definição completa
-- fica para o P34"), e só se ela nunca foi aprovada. Versão aprovada ou com
-- conteúdo real fica intacta.
--
-- Revisão humana do SQL antes de qualquer db push (CLAUDE.md).
-- =============================================================================

-- DOC1_ENTREVISTA v1-2026-09 · Ficha de entrevista pré-natal (doc1.json)
insert into public.instrumento (codigo, versao, definicao, vigente)
values ('DOC1_ENTREVISTA', 'v1-2026-09', $instrumento${
  "codigo": "DOC1_ENTREVISTA",
  "versao": "v1-2026-09",
  "titulo": "Ficha de entrevista pré-natal",
  "fonte": "PRD v4.2, 9.1",
  "descricao": "Preenchida na consulta pré-natal online, pelo celular, com salvamento a cada campo. Toda entrevista nova começa em branco.",
  "blocos": [
    {
      "id": "A",
      "titulo": "Origem",
      "campos": [
        {
          "id": "como_chegou",
          "tipo": "opcao_unica",
          "rotulo": "Como chegou até a Kraamzorg",
          "opcoes": [
            {
              "valor": "instagram",
              "rotulo": "Instagram"
            },
            {
              "valor": "indicacao_de_amigo",
              "rotulo": "Indicação de amigo"
            },
            {
              "valor": "indicacao_medica",
              "rotulo": "Indicação médica"
            },
            {
              "valor": "presente",
              "rotulo": "Presente"
            }
          ]
        }
      ]
    },
    {
      "id": "B",
      "titulo": "Dados da entrevista",
      "campos": [
        {
          "id": "data_da_entrevista",
          "tipo": "data",
          "rotulo": "Data da entrevista"
        },
        {
          "id": "hora_de_inicio",
          "tipo": "hora",
          "rotulo": "Hora de início",
          "preenchimento": "ao_abrir",
          "ajuda": "Preenchida automaticamente, editável."
        },
        {
          "id": "hora_de_termino",
          "tipo": "hora",
          "rotulo": "Hora de término",
          "preenchimento": "ao_concluir",
          "ajuda": "Preenchida automaticamente, editável."
        },
        {
          "id": "data_provavel_do_parto",
          "tipo": "data",
          "rotulo": "Data provável do parto"
        },
        {
          "id": "local_maternidade",
          "tipo": "texto",
          "rotulo": "Local (maternidade)"
        },
        {
          "id": "idade_gestacional_atual",
          "tipo": "automatico",
          "origem": "idade_gestacional_calculada",
          "rotulo": "Idade gestacional atual (semanas e dias)",
          "ajuda": "Calculada da data provável do parto e da data da entrevista. Não é gravada."
        },
        {
          "id": "percentil",
          "tipo": "numero",
          "rotulo": "Percentil"
        },
        {
          "id": "ganho_de_peso",
          "tipo": "numero",
          "rotulo": "Ganho de peso"
        },
        {
          "id": "tipo_de_parto_esperado",
          "tipo": "opcao_unica",
          "rotulo": "Tipo de parto esperado",
          "opcoes": [
            {
              "valor": "vaginal",
              "rotulo": "Vaginal"
            },
            {
              "valor": "cesarea",
              "rotulo": "Cesárea"
            }
          ]
        },
        {
          "id": "data_do_parto_agendado",
          "tipo": "data",
          "rotulo": "Data do parto agendado"
        },
        {
          "id": "ila",
          "tipo": "opcao_unica",
          "rotulo": "ILA",
          "opcoes": [
            {
              "valor": "normal",
              "rotulo": "Normal"
            },
            {
              "valor": "diminuido",
              "rotulo": "Diminuído"
            },
            {
              "valor": "aumentado",
              "rotulo": "Aumentado"
            }
          ]
        },
        {
          "id": "coletador",
          "tipo": "automatico",
          "origem": "login",
          "rotulo": "Coletador"
        }
      ]
    },
    {
      "id": "C",
      "titulo": "Identificação",
      "campos": [
        {
          "id": "nome_da_gestante",
          "tipo": "texto",
          "rotulo": "Nome da gestante"
        },
        {
          "id": "idade_da_gestante",
          "tipo": "numero",
          "rotulo": "Idade da gestante",
          "unidade": "anos"
        },
        {
          "id": "ocupacao_da_gestante",
          "tipo": "texto",
          "rotulo": "Ocupação da gestante"
        },
        {
          "id": "nome_do_companheiro",
          "tipo": "texto",
          "rotulo": "Nome do companheiro"
        },
        {
          "id": "idade_do_companheiro",
          "tipo": "numero",
          "rotulo": "Idade do companheiro",
          "unidade": "anos"
        },
        {
          "id": "ocupacao_do_companheiro",
          "tipo": "texto",
          "rotulo": "Ocupação do companheiro"
        },
        {
          "id": "gestacao_planejada",
          "tipo": "sim_nao",
          "rotulo": "Gestação planejada"
        },
        {
          "id": "sexo_do_bebe",
          "tipo": "texto",
          "rotulo": "Sexo do bebê"
        },
        {
          "id": "nome_do_bebe",
          "tipo": "texto",
          "rotulo": "Nome do bebê"
        },
        {
          "id": "crenca_religiosa",
          "tipo": "texto",
          "rotulo": "Crença religiosa"
        },
        {
          "id": "situacao_conjugal",
          "tipo": "opcao_unica",
          "rotulo": "Situação conjugal",
          "opcoes": [
            {
              "valor": "solteira",
              "rotulo": "Solteira"
            },
            {
              "valor": "casada",
              "rotulo": "Casada, civil e/ou religioso"
            },
            {
              "valor": "uniao_estavel",
              "rotulo": "União estável ou vive em união"
            }
          ]
        },
        {
          "id": "escolaridade",
          "tipo": "opcao_unica",
          "rotulo": "Escolaridade",
          "opcoes": [
            {
              "valor": "sem_instrucao",
              "rotulo": "Sem instrução ou menos de 1 ano"
            },
            {
              "valor": "fundamental_incompleto",
              "rotulo": "Fundamental incompleto"
            },
            {
              "valor": "fundamental_completo",
              "rotulo": "Fundamental completo"
            },
            {
              "valor": "medio_incompleto",
              "rotulo": "Médio incompleto"
            },
            {
              "valor": "medio_completo",
              "rotulo": "Médio completo"
            },
            {
              "valor": "superior_incompleto",
              "rotulo": "Superior incompleto"
            },
            {
              "valor": "superior_completo",
              "rotulo": "Superior completo"
            }
          ]
        },
        {
          "id": "ocupacao",
          "tipo": "opcao_unica",
          "rotulo": "Ocupação",
          "opcoes": [
            {
              "valor": "autonoma",
              "rotulo": "Autônoma"
            },
            {
              "valor": "empregadora",
              "rotulo": "Empregadora"
            },
            {
              "valor": "empregada",
              "rotulo": "Empregada"
            }
          ]
        },
        {
          "id": "endereco_completo",
          "tipo": "texto_longo",
          "rotulo": "Endereço completo"
        },
        {
          "id": "telefone_da_gestante",
          "tipo": "texto",
          "rotulo": "Telefone da gestante",
          "teclado": "telefone"
        },
        {
          "id": "telefone_do_acompanhante",
          "tipo": "texto",
          "rotulo": "Telefone do acompanhante",
          "teclado": "telefone"
        }
      ]
    },
    {
      "id": "D",
      "titulo": "História obstétrica",
      "campos": [
        {
          "id": "gestacoes_anteriores",
          "tipo": "opcao_unica",
          "rotulo": "Gestações anteriores",
          "opcoes": [
            {
              "valor": "nenhuma",
              "rotulo": "Nenhuma"
            },
            {
              "valor": "um",
              "rotulo": "1"
            },
            {
              "valor": "dois",
              "rotulo": "2"
            },
            {
              "valor": "tres_ou_mais",
              "rotulo": "Três ou mais"
            }
          ]
        },
        {
          "id": "filhos_vivos",
          "tipo": "opcao_unica",
          "rotulo": "Filhos vivos",
          "opcoes": [
            {
              "valor": "nenhum",
              "rotulo": "Nenhum"
            },
            {
              "valor": "um",
              "rotulo": "1"
            },
            {
              "valor": "dois",
              "rotulo": "2"
            },
            {
              "valor": "tres_ou_mais",
              "rotulo": "Três ou mais"
            }
          ]
        },
        {
          "id": "partos_vaginais_anteriores",
          "tipo": "opcao_unica",
          "rotulo": "Partos vaginais anteriores",
          "opcoes": [
            {
              "valor": "nenhum",
              "rotulo": "Nenhum"
            },
            {
              "valor": "um",
              "rotulo": "1"
            },
            {
              "valor": "dois",
              "rotulo": "2"
            },
            {
              "valor": "tres_ou_mais",
              "rotulo": "Três ou mais"
            }
          ]
        },
        {
          "id": "cesareas_anteriores",
          "tipo": "opcao_unica",
          "rotulo": "Cesáreas anteriores",
          "opcoes": [
            {
              "valor": "nenhuma",
              "rotulo": "Nenhuma"
            },
            {
              "valor": "um",
              "rotulo": "1"
            },
            {
              "valor": "dois",
              "rotulo": "2"
            },
            {
              "valor": "tres_ou_mais",
              "rotulo": "Três ou mais"
            }
          ]
        },
        {
          "id": "consultas_de_prenatal",
          "tipo": "opcao_unica",
          "rotulo": "Número de consultas de pré-natal",
          "opcoes": [
            {
              "valor": "menos_de_6",
              "rotulo": "Menos de 6"
            },
            {
              "valor": "seis_ou_mais",
              "rotulo": "Seis ou mais"
            }
          ]
        },
        {
          "id": "intercorrencias_gestacao_atual",
          "tipo": "texto",
          "rotulo": "Intercorrências na gestação atual"
        },
        {
          "id": "orientacao_amamentacao_prenatal",
          "tipo": "sim_nao_texto",
          "rotulo": "Orientação sobre amamentação no pré-natal",
          "rotulo_texto": "Detalhe"
        }
      ]
    },
    {
      "id": "E",
      "titulo": "História de amamentação",
      "campos": [
        {
          "id": "amamentou_anteriormente",
          "tipo": "opcao_unica",
          "rotulo": "Amamentou anteriormente",
          "opcoes": [
            {
              "valor": "sim",
              "rotulo": "Sim"
            },
            {
              "valor": "nao",
              "rotulo": "Não"
            },
            {
              "valor": "nao_se_aplica",
              "rotulo": "Não se aplica"
            }
          ]
        },
        {
          "id": "numero_de_filhos_amamentados",
          "tipo": "opcao_unica",
          "rotulo": "Número de filhos amamentados",
          "opcoes": [
            {
              "valor": "um",
              "rotulo": "1"
            },
            {
              "valor": "dois",
              "rotulo": "2"
            },
            {
              "valor": "tres_ou_mais",
              "rotulo": "Três ou mais"
            }
          ],
          "aparece_se": {
            "campo": "E.amamentou_anteriormente",
            "operador": "=",
            "valor": "sim"
          }
        },
        {
          "id": "maior_tempo_de_amamentacao",
          "tipo": "opcao_unica",
          "rotulo": "Maior tempo de amamentação",
          "opcoes": [
            {
              "valor": "menos_de_1_mes",
              "rotulo": "Menos de 1 mês"
            },
            {
              "valor": "de_2_a_3_meses",
              "rotulo": "2 a 3 meses"
            },
            {
              "valor": "de_4_a_6_meses",
              "rotulo": "4 a 6 meses"
            },
            {
              "valor": "de_7_meses_a_1_ano",
              "rotulo": "7 meses a 1 ano"
            },
            {
              "valor": "mais_de_1_ano",
              "rotulo": "Mais de 1 ano"
            }
          ],
          "aparece_se": {
            "campo": "E.amamentou_anteriormente",
            "operador": "=",
            "valor": "sim"
          }
        },
        {
          "id": "dor_lesao_mamilar_anterior",
          "tipo": "sim_nao",
          "rotulo": "Dor ou lesão mamilar em amamentação anterior",
          "aparece_se": {
            "campo": "E.amamentou_anteriormente",
            "operador": "=",
            "valor": "sim"
          }
        },
        {
          "id": "motivo_do_desmame",
          "tipo": "opcao_unica",
          "rotulo": "Motivo do desmame",
          "opcoes": [
            {
              "valor": "dor_ou_lesao_mamilar",
              "rotulo": "Dor ou lesão mamilar"
            },
            {
              "valor": "naturalmente",
              "rotulo": "Naturalmente"
            },
            {
              "valor": "contexto_ou_desejo",
              "rotulo": "Contexto ou desejo"
            },
            {
              "valor": "indesejado_ou_insucesso",
              "rotulo": "Indesejado ou insucesso da amamentação"
            }
          ],
          "aparece_se": {
            "campo": "E.amamentou_anteriormente",
            "operador": "=",
            "valor": "sim"
          }
        }
      ]
    },
    {
      "id": "F",
      "titulo": "Expectativas",
      "ajuda": "Texto livre.",
      "campos": [
        {
          "id": "sobre_amamentacao",
          "tipo": "texto_longo",
          "rotulo": "O que pensam e sabem sobre amamentação"
        },
        {
          "id": "disponibilidade_para_o_processo",
          "tipo": "texto_longo",
          "rotulo": "Disponibilidade para o processo"
        },
        {
          "id": "o_que_motiva_a_amamentar",
          "tipo": "texto_longo",
          "rotulo": "O que motiva a amamentar"
        },
        {
          "id": "sobre_o_puerperio",
          "tipo": "texto_longo",
          "rotulo": "O que sabem sobre o puerpério"
        },
        {
          "id": "medos_e_receios",
          "tipo": "texto_longo",
          "rotulo": "Medos e receios"
        },
        {
          "id": "ajuda_prevista",
          "tipo": "texto_longo",
          "rotulo": "Ajuda prevista e de quem"
        },
        {
          "id": "expectativas_primeira_semana",
          "tipo": "texto_longo",
          "rotulo": "Expectativas para a primeira semana"
        },
        {
          "id": "o_que_esperam_do_cuidado",
          "tipo": "texto_longo",
          "rotulo": "O que esperam do cuidado"
        }
      ]
    },
    {
      "id": "G",
      "titulo": "Temas essenciais abordados",
      "campos": [
        {
          "id": "temas_abordados",
          "tipo": "multipla",
          "rotulo": "Temas essenciais abordados",
          "opcoes": [
            {
              "valor": "golden_hour",
              "rotulo": "Golden Hour"
            },
            {
              "valor": "apojadura",
              "rotulo": "Apojadura"
            },
            {
              "valor": "complemento",
              "rotulo": "Complemento"
            },
            {
              "valor": "chupeta_e_mamadeira",
              "rotulo": "Chupeta e mamadeira"
            },
            {
              "valor": "beneficios_leite_materno",
              "rotulo": "Benefícios do leite materno e malefícios do leite de vaca"
            },
            {
              "valor": "aviso_do_nascimento",
              "rotulo": "Necessidade de aviso do nascimento"
            }
          ]
        }
      ]
    },
    {
      "id": "H",
      "titulo": "Médicos e preferências",
      "campos": [
        {
          "id": "nome_do_obstetra",
          "tipo": "texto",
          "rotulo": "Nome do obstetra",
          "destino": "medico.obstetra"
        },
        {
          "id": "telefone_do_obstetra",
          "tipo": "texto",
          "rotulo": "Telefone do obstetra",
          "teclado": "telefone",
          "destino": "medico.obstetra"
        },
        {
          "id": "nome_do_pediatra",
          "tipo": "texto",
          "rotulo": "Nome do pediatra",
          "destino": "medico.pediatra",
          "ajuda": "Opcional aqui, obrigatório no último dia."
        },
        {
          "id": "telefone_do_pediatra",
          "tipo": "texto",
          "rotulo": "Telefone do pediatra",
          "teclado": "telefone",
          "destino": "medico.pediatra",
          "ajuda": "Opcional aqui, obrigatório no último dia."
        },
        {
          "id": "recomendacoes_pedidos_especiais",
          "tipo": "texto_longo",
          "rotulo": "Recomendações ou pedidos especiais",
          "destino": "consulta_prenatal.plano_cuidado"
        },
        {
          "id": "preferencia_de_periodo",
          "tipo": "multipla",
          "rotulo": "Preferência de período em ordem",
          "opcoes": [
            {
              "valor": "manha",
              "rotulo": "Manhã"
            },
            {
              "valor": "tarde",
              "rotulo": "Tarde"
            },
            {
              "valor": "noite_avaliar",
              "rotulo": "Noite"
            }
          ],
          "ordenada": true,
          "destino": "consulta_prenatal.periodo_preferido"
        }
      ]
    }
  ]
}$instrumento$::jsonb, false)
on conflict (codigo, versao) do update
  set definicao = excluded.definicao,
      vigente = false
  where public.instrumento.aprovado_em is null
    and coalesce(jsonb_array_length(public.instrumento.definicao -> 'blocos'), 0) = 0;

-- DOC2_CHECKLIST v1-2026-09 · Checklist diário de atendimento (doc2.json)
insert into public.instrumento (codigo, versao, definicao, vigente)
values ('DOC2_CHECKLIST', 'v1-2026-09', $instrumento${
  "codigo": "DOC2_CHECKLIST",
  "versao": "v1-2026-09",
  "titulo": "Checklist diário de atendimento",
  "fonte": "PRD v4.2, 9.2 e Apêndice B",
  "descricao": "Uma coluna por dia, de D1 a D6 ou D12. Um registro por visita, assinado pela profissional.",
  "cabecalho": [
    {
      "id": "cabecalho",
      "titulo": "Cabeçalho do acompanhamento",
      "ajuda": "Preenchido uma vez por acompanhamento.",
      "campos": [
        {
          "id": "paciente",
          "tipo": "texto",
          "rotulo": "Paciente"
        },
        {
          "id": "ginecologista",
          "tipo": "texto",
          "rotulo": "Ginecologista"
        },
        {
          "id": "hospital",
          "tipo": "texto",
          "rotulo": "Hospital"
        },
        {
          "id": "data_da_alta",
          "tipo": "data",
          "rotulo": "Data da alta"
        },
        {
          "id": "pediatra",
          "tipo": "texto",
          "rotulo": "Pediatra"
        }
      ]
    },
    {
      "id": "cabecalho_bebe",
      "titulo": "Cabeçalho do recém-nascido",
      "ajuda": "Em gemelares, os campos do bebê repetem por bebê.",
      "repete_por_bebe": true,
      "campos": [
        {
          "id": "nome_recem_nascido",
          "tipo": "texto",
          "rotulo": "Nome do recém-nascido"
        },
        {
          "id": "peso_ao_nascer",
          "tipo": "numero",
          "rotulo": "Peso ao nascer",
          "unidade": "g"
        },
        {
          "id": "peso_na_alta",
          "tipo": "numero",
          "rotulo": "Peso do bebê na alta",
          "unidade": "g"
        }
      ]
    }
  ],
  "blocos": [
    {
      "id": "1",
      "titulo": "Chegada e preparo",
      "campos": [
        {
          "id": "data",
          "tipo": "data",
          "rotulo": "Data",
          "obrigatorio": true
        },
        {
          "id": "horario",
          "tipo": "hora",
          "rotulo": "Horário",
          "obrigatorio": true
        },
        {
          "id": "acompanhante_presente",
          "tipo": "sim_nao_texto",
          "rotulo": "Acompanhante presente?",
          "rotulo_texto": "Quem?"
        },
        {
          "id": "pontualidade_confirmada",
          "tipo": "sim_nao",
          "rotulo": "Pontualidade confirmada"
        },
        {
          "id": "higienizacao_das_maos",
          "tipo": "sim_nao",
          "rotulo": "Higienização das mãos"
        },
        {
          "id": "apresentacao_acolhimento_familia",
          "tipo": "sim_nao",
          "rotulo": "Apresentação e acolhimento da família"
        },
        {
          "id": "relato_desde_ultima_visita",
          "tipo": "sim_nao",
          "rotulo": "Relato desde a última visita coletado"
        }
      ]
    },
    {
      "id": "2",
      "titulo": "Puérpera, estado geral",
      "campos": [
        {
          "id": "bem_estar_geral_preservado",
          "tipo": "sim_nao",
          "rotulo": "Bem-estar geral preservado"
        },
        {
          "id": "queixa_de_dor",
          "tipo": "sim_nao_texto",
          "rotulo": "Queixa de dor?",
          "rotulo_texto": "Local"
        },
        {
          "id": "dor_intensidade",
          "tipo": "escala",
          "rotulo": "Dor, intensidade",
          "min": 0,
          "max": 10,
          "alertas": [
            {
              "descricao": "≥ 7",
              "regras": [
                "PU-03",
                "PU-09"
              ],
              "condicao": {
                "campo": "2.dor_intensidade",
                "operador": ">=",
                "valor": 7
              },
              "clinico": true,
              "nota_clinica": "Apêndice B: PU-03 imediato ou PU-09 prioritário."
            }
          ]
        },
        {
          "id": "sangramento_loquios_esperado",
          "tipo": "sim_nao",
          "rotulo": "Sangramento (lóquios) esperado",
          "alertas": [
            {
              "descricao": "se não",
              "regras": [
                "PU-02",
                "PU-10"
              ],
              "condicao": {
                "campo": "2.sangramento_loquios_esperado",
                "operador": "=",
                "valor": false
              },
              "acao": "abrir_seletor_doc3",
              "clinico": true,
              "nota_clinica": "Apêndice B: o seletor pergunta a intensidade; PU-02 imediato ou PU-10 prioritário."
            }
          ]
        }
      ]
    },
    {
      "id": "2.1",
      "titulo": "Sinais vitais",
      "campos": [
        {
          "id": "pressao_arterial",
          "tipo": "numero",
          "rotulo": "Pressão arterial",
          "unidade": "mmHg",
          "partes": [
            {
              "id": "sistolica",
              "rotulo": "Sistólica"
            },
            {
              "id": "diastolica",
              "rotulo": "Diastólica"
            }
          ],
          "obrigatorio": true,
          "alertas": [
            {
              "descricao": "ver Apêndice B: sem corte definido",
              "regras": [],
              "severidade": "informativo",
              "clinico": true,
              "nota_clinica": "K-05: corte da pressão arterial a definir. Por ora, só registro."
            }
          ]
        },
        {
          "id": "temperatura",
          "tipo": "numero",
          "rotulo": "Temperatura",
          "unidade": "°C",
          "casas_decimais": 1,
          "obrigatorio": true,
          "alertas": [
            {
              "descricao": "≥ 38",
              "regras": [
                "PU-01"
              ],
              "severidade": "imediato",
              "condicao": {
                "campo": "2.1.temperatura",
                "operador": ">=",
                "valor": 38
              },
              "fonte": "DOC 3"
            },
            {
              "descricao": "37,5 a 37,9 °C em duas visitas seguidas",
              "regras": [
                "PU-08"
              ],
              "severidade": "prioritario",
              "condicao": {
                "campo": "2.1.temperatura",
                "operador": "entre",
                "min": 37.5,
                "max": 37.9
              },
              "clinico": true,
              "nota_clinica": "Corte de \"febre baixa persistente\" a confirmar. As duas visitas seguidas são conferidas pelo motor de alertas (P40)."
            }
          ]
        },
        {
          "id": "frequencia_cardiaca",
          "tipo": "numero",
          "rotulo": "Frequência cardíaca",
          "unidade": "bpm",
          "obrigatorio": true
        }
      ]
    },
    {
      "id": "2.2",
      "titulo": "Ferida operatória",
      "campos": [
        {
          "id": "cesarea_sem_sinais_infeccao",
          "tipo": "sim_nao",
          "rotulo": "Cesárea sem sinais de infecção",
          "alertas": [
            {
              "descricao": "se não",
              "regras": [
                "PU-04"
              ],
              "severidade": "imediato",
              "condicao": {
                "campo": "2.2.cesarea_sem_sinais_infeccao",
                "operador": "=",
                "valor": false
              },
              "fonte": "DOC 3"
            }
          ]
        },
        {
          "id": "episiotomia_laceracao_sem_alteracoes",
          "tipo": "sim_nao",
          "rotulo": "Episiotomia ou laceração sem alterações",
          "alertas": [
            {
              "descricao": "se não",
              "regras": [
                "PU-04"
              ],
              "severidade": "imediato",
              "condicao": {
                "campo": "2.2.episiotomia_laceracao_sem_alteracoes",
                "operador": "=",
                "valor": false
              },
              "clinico": true
            }
          ]
        },
        {
          "id": "orientacoes_cuidado_reforcadas",
          "tipo": "sim_nao",
          "rotulo": "Orientações de cuidado reforçadas"
        }
      ]
    },
    {
      "id": "2.3",
      "titulo": "Medicações",
      "campos": [
        {
          "id": "medicacoes_em_uso",
          "tipo": "texto",
          "rotulo": "Medicações em uso"
        }
      ]
    },
    {
      "id": "2.4",
      "titulo": "Autocuidado",
      "campos": [
        {
          "id": "higiene_intima_orientada",
          "tipo": "sim_nao",
          "rotulo": "Higiene íntima orientada"
        },
        {
          "id": "sono_repouso_adequados",
          "tipo": "sim_nao",
          "rotulo": "Sono e repouso adequados"
        },
        {
          "id": "alimentacao_hidratacao_adequadas",
          "tipo": "sim_nao",
          "rotulo": "Alimentação e hidratação adequadas"
        },
        {
          "id": "eliminacoes_evacuacao_presentes",
          "tipo": "sim_nao",
          "rotulo": "Eliminações e evacuação presentes"
        }
      ]
    },
    {
      "id": "2.5",
      "titulo": "Mamas",
      "campos": [
        {
          "id": "turgidas_ou_secretantes",
          "tipo": "sim_nao",
          "rotulo": "Túrgidas ou secretantes",
          "obrigatorio": true
        },
        {
          "id": "flacidas",
          "tipo": "sim_nao",
          "rotulo": "Flácidas",
          "obrigatorio": true
        },
        {
          "id": "ingurgitadas",
          "tipo": "sim_nao",
          "rotulo": "Ingurgitadas",
          "alertas": [
            {
              "descricao": "se sim",
              "regras": [
                "PU-11"
              ],
              "severidade": "prioritario",
              "condicao": {
                "campo": "2.5.ingurgitadas",
                "operador": "=",
                "valor": true
              },
              "clinico": true,
              "nota_clinica": "DOC 3 .docx pede \"sem melhora com o manejo\"."
            }
          ],
          "obrigatorio": true
        }
      ],
      "clinico": true,
      "nota_clinica": "PRD 9.2 v4.2: até a Edilaine dizer qual subcampo conta como registro de amamentação preenchido, o bloco inteiro 2.5 a 2.13 é obrigatório para concluir a visita (K-09)."
    },
    {
      "id": "2.6",
      "titulo": "Amamentação e dor",
      "campos": [
        {
          "id": "dor_mamilos_amamentar",
          "tipo": "sim_nao",
          "rotulo": "Dor nos mamilos para amamentar",
          "obrigatorio": true
        },
        {
          "id": "evn",
          "tipo": "escala",
          "rotulo": "EVN",
          "min": 0,
          "max": 10,
          "alertas": [
            {
              "descricao": "≥ 7",
              "regras": [
                "AM-05"
              ],
              "severidade": "prioritario",
              "condicao": {
                "campo": "2.6.evn",
                "operador": ">=",
                "valor": 7
              },
              "clinico": true
            }
          ],
          "obrigatorio": true
        },
        {
          "id": "intervencoes_para_dor",
          "tipo": "texto",
          "rotulo": "Intervenções realizadas para dor",
          "obrigatorio": true
        }
      ],
      "clinico": true,
      "nota_clinica": "PRD 9.2 v4.2: até a Edilaine dizer qual subcampo conta como registro de amamentação preenchido, o bloco inteiro 2.5 a 2.13 é obrigatório para concluir a visita (K-09)."
    },
    {
      "id": "2.7",
      "titulo": "Lesão mamilar",
      "campos": [
        {
          "id": "lesao_mamilar",
          "tipo": "opcao_unica",
          "rotulo": "Apresenta lesão mamilar?",
          "opcoes": [
            {
              "valor": "nao",
              "rotulo": "Não"
            },
            {
              "valor": "direita",
              "rotulo": "Direita"
            },
            {
              "valor": "esquerda",
              "rotulo": "Esquerda"
            },
            {
              "valor": "ambas",
              "rotulo": "Ambas"
            }
          ],
          "obrigatorio": true
        },
        {
          "id": "nts",
          "tipo": "escala",
          "rotulo": "Escore de trauma mamilar (NTS)",
          "min": 0,
          "max": 5,
          "ajuda": "Escala do DOC 4.",
          "alertas": [
            {
              "descricao": "escala DOC 4; Apêndice B: ≥ 4",
              "regras": [
                "PU-12",
                "AM-04"
              ],
              "severidade": "prioritario",
              "condicao": {
                "campo": "2.7.nts",
                "operador": ">=",
                "valor": 4
              },
              "clinico": true
            }
          ],
          "obrigatorio": true
        },
        {
          "id": "interrupcao_adequada_succao",
          "tipo": "sim_nao",
          "rotulo": "Interrupção adequada da sucção",
          "obrigatorio": true
        }
      ],
      "clinico": true,
      "nota_clinica": "PRD 9.2 v4.2: até a Edilaine dizer qual subcampo conta como registro de amamentação preenchido, o bloco inteiro 2.5 a 2.13 é obrigatório para concluir a visita (K-09)."
    },
    {
      "id": "2.8",
      "titulo": "Técnica",
      "campos": [
        {
          "id": "latch",
          "tipo": "escala",
          "rotulo": "LATCH",
          "min": 0,
          "max": 10,
          "ajuda": "Tabela L-A-T-C-H do DOC 4.",
          "complemento": {
            "rotulo": "Avaliação",
            "opcoes": [
              {
                "valor": "otimo",
                "rotulo": "Ótimo"
              },
              {
                "valor": "regular",
                "rotulo": "Regular"
              },
              {
                "valor": "ruim",
                "rotulo": "Ruim"
              }
            ]
          },
          "alertas": [
            {
              "descricao": "≤ 5",
              "regras": [],
              "severidade": "atencao",
              "condicao": {
                "campo": "2.8.latch",
                "operador": "<=",
                "valor": 5
              },
              "clinico": true,
              "nota_clinica": "K-03: o DOC 4 interpreta 0 a 7 como \"apoio necessário\". Sem regra no DOC 3."
            }
          ],
          "obrigatorio": true
        },
        {
          "id": "teste_da_linguinha",
          "tipo": "opcao_unica",
          "rotulo": "Teste da linguinha",
          "opcoes": [
            {
              "valor": "normal",
              "rotulo": "Normal"
            },
            {
              "valor": "alterado",
              "rotulo": "Alterado"
            },
            {
              "valor": "nao_fez",
              "rotulo": "Não fez"
            }
          ],
          "obrigatorio": true
        }
      ],
      "clinico": true,
      "nota_clinica": "PRD 9.2 v4.2: até a Edilaine dizer qual subcampo conta como registro de amamentação preenchido, o bloco inteiro 2.5 a 2.13 é obrigatório para concluir a visita (K-09)."
    },
    {
      "id": "2.9",
      "titulo": "Laserterapia",
      "campos": [
        {
          "id": "fbm_aplicada",
          "tipo": "multipla",
          "rotulo": "FBM aplicada",
          "opcoes": [
            {
              "valor": "analgesia",
              "rotulo": "Analgesia"
            },
            {
              "valor": "reparacao",
              "rotulo": "Reparação"
            },
            {
              "valor": "ilib",
              "rotulo": "ILIB"
            },
            {
              "valor": "nao_aplicada",
              "rotulo": "Não aplicada",
              "exclusiva": true
            }
          ],
          "obrigatorio": true
        }
      ],
      "clinico": true,
      "nota_clinica": "PRD 9.2 v4.2: até a Edilaine dizer qual subcampo conta como registro de amamentação preenchido, o bloco inteiro 2.5 a 2.13 é obrigatório para concluir a visita (K-09)."
    },
    {
      "id": "2.10",
      "titulo": "Hábitos",
      "campos": [
        {
          "id": "bicos_artificiais",
          "tipo": "sim_nao",
          "rotulo": "Uso de bicos artificiais",
          "obrigatorio": true
        },
        {
          "id": "forros_e_conchas",
          "tipo": "sim_nao",
          "rotulo": "Uso de forros e conchas",
          "obrigatorio": true
        },
        {
          "id": "bomba_de_extracao",
          "tipo": "sim_nao",
          "rotulo": "Uso de bomba de extração",
          "obrigatorio": true
        }
      ],
      "clinico": true,
      "nota_clinica": "PRD 9.2 v4.2: até a Edilaine dizer qual subcampo conta como registro de amamentação preenchido, o bloco inteiro 2.5 a 2.13 é obrigatório para concluir a visita (K-09)."
    },
    {
      "id": "2.11",
      "titulo": "Frequência",
      "campos": [
        {
          "id": "succoes_por_dia",
          "tipo": "opcao_unica",
          "rotulo": "Sucções por dia",
          "opcoes": [
            {
              "valor": "menos_de_8",
              "rotulo": "< 8"
            },
            {
              "valor": "mais_de_8",
              "rotulo": "> 8"
            }
          ],
          "clinico": true,
          "nota_clinica": "O impresso não diz onde entra o 8.",
          "alertas": [
            {
              "descricao": "se < 8",
              "regras": [],
              "severidade": "atencao",
              "condicao": {
                "campo": "2.11.succoes_por_dia",
                "operador": "=",
                "valor": "menos_de_8"
              },
              "clinico": true,
              "nota_clinica": "Sem regra no DOC 3."
            }
          ],
          "obrigatorio": true
        }
      ],
      "clinico": true,
      "nota_clinica": "PRD 9.2 v4.2: até a Edilaine dizer qual subcampo conta como registro de amamentação preenchido, o bloco inteiro 2.5 a 2.13 é obrigatório para concluir a visita (K-09)."
    },
    {
      "id": "2.12",
      "titulo": "Produção",
      "campos": [
        {
          "id": "producao_de_leite",
          "tipo": "opcao_unica",
          "rotulo": "Produção de leite",
          "opcoes": [
            {
              "valor": "alta",
              "rotulo": "Alta"
            },
            {
              "valor": "normal",
              "rotulo": "Normal"
            },
            {
              "valor": "baixa",
              "rotulo": "Baixa"
            }
          ],
          "alertas": [
            {
              "descricao": "se baixa",
              "regras": [
                "AM-06"
              ],
              "severidade": "prioritario",
              "condicao": {
                "campo": "2.12.producao_de_leite",
                "operador": "=",
                "valor": "baixa"
              },
              "clinico": true,
              "nota_clinica": "Quando houver impacto no RN."
            }
          ],
          "obrigatorio": true
        }
      ],
      "clinico": true,
      "nota_clinica": "PRD 9.2 v4.2: até a Edilaine dizer qual subcampo conta como registro de amamentação preenchido, o bloco inteiro 2.5 a 2.13 é obrigatório para concluir a visita (K-09)."
    },
    {
      "id": "2.13",
      "titulo": "Apoio",
      "campos": [
        {
          "id": "sente_se_apoiada",
          "tipo": "escala",
          "rotulo": "Sente-se apoiada ao amamentar",
          "min": 0,
          "max": 10,
          "alertas": [
            {
              "descricao": "≤ 3",
              "regras": [],
              "severidade": "atencao",
              "condicao": {
                "campo": "2.13.sente_se_apoiada",
                "operador": "<=",
                "valor": 3
              },
              "clinico": true,
              "nota_clinica": "Sem regra no DOC 3."
            }
          ],
          "obrigatorio": true
        },
        {
          "id": "quem_mais_apoia",
          "tipo": "texto",
          "rotulo": "Quem mais apoia",
          "obrigatorio": true
        }
      ],
      "clinico": true,
      "nota_clinica": "PRD 9.2 v4.2: até a Edilaine dizer qual subcampo conta como registro de amamentação preenchido, o bloco inteiro 2.5 a 2.13 é obrigatório para concluir a visita (K-09)."
    },
    {
      "id": "3",
      "titulo": "RN, avaliação",
      "repete_por_bebe": true,
      "campos": [
        {
          "id": "cor_da_pele_icterica",
          "tipo": "opcao_unica",
          "rotulo": "Cor da pele ictérica",
          "opcoes": [
            {
              "valor": "ausente",
              "rotulo": "Ausente"
            },
            {
              "valor": "zona_i",
              "rotulo": "Zona I"
            },
            {
              "valor": "zona_ii",
              "rotulo": "Zona II"
            },
            {
              "valor": "zona_iii",
              "rotulo": "Zona III"
            },
            {
              "valor": "zona_iv",
              "rotulo": "Zona IV"
            },
            {
              "valor": "zona_v",
              "rotulo": "Zona V"
            }
          ],
          "alertas": [
            {
              "descricao": "≥ zona III",
              "regras": [
                "RN-10"
              ],
              "severidade": "prioritario",
              "condicao": {
                "campo": "3.cor_da_pele_icterica",
                "operador": "em",
                "valores": [
                  "zona_iii",
                  "zona_iv",
                  "zona_v"
                ]
              },
              "fonte": "v4.0"
            }
          ]
        },
        {
          "id": "respiracao_sem_sinais_esforco",
          "tipo": "sim_nao",
          "rotulo": "Respiração sem sinais de esforço",
          "alertas": [
            {
              "descricao": "se não",
              "regras": [
                "RN-01"
              ],
              "severidade": "imediato",
              "condicao": {
                "campo": "3.respiracao_sem_sinais_esforco",
                "operador": "=",
                "valor": false
              },
              "fonte": "DOC 3"
            }
          ]
        },
        {
          "id": "choro_habitual",
          "tipo": "sim_nao",
          "rotulo": "Choro habitual"
        },
        {
          "id": "atividade_responsividade_preservadas",
          "tipo": "sim_nao",
          "rotulo": "Atividade e responsividade preservadas",
          "alertas": [
            {
              "descricao": "se não",
              "regras": [
                "RN-03"
              ],
              "severidade": "imediato",
              "condicao": {
                "campo": "3.atividade_responsividade_preservadas",
                "operador": "=",
                "valor": false
              },
              "fonte": "DOC 3"
            }
          ]
        }
      ]
    },
    {
      "id": "3.1",
      "titulo": "Sinais vitais do RN",
      "repete_por_bebe": true,
      "campos": [
        {
          "id": "temperatura",
          "tipo": "numero",
          "rotulo": "Temperatura",
          "unidade": "°C",
          "casas_decimais": 1,
          "obrigatorio": true,
          "alertas": [
            {
              "descricao": "> 38 ou < 36",
              "regras": [
                "RN-08"
              ],
              "severidade": "imediato",
              "condicao": {
                "campo": "3.1.temperatura",
                "operador": "fora_da_faixa",
                "min": 36,
                "max": 38
              },
              "fonte": "DOC 3"
            }
          ]
        },
        {
          "id": "frequencia_cardiaca",
          "tipo": "numero",
          "rotulo": "Frequência cardíaca",
          "unidade": "bpm",
          "obrigatorio": true
        },
        {
          "id": "frequencia_respiratoria",
          "tipo": "numero",
          "rotulo": "Frequência respiratória",
          "unidade": "rpm",
          "obrigatorio": true
        },
        {
          "id": "peso",
          "tipo": "numero",
          "rotulo": "Peso",
          "unidade": "g",
          "obrigatorio": true,
          "alertas": [
            {
              "descricao": "curva",
              "regras": [
                "RN-13"
              ],
              "severidade": "prioritario",
              "clinico": true,
              "nota_clinica": "Apêndice B: perda acima de 10% do peso ao nascer ou sem recuperação do peso até o D14. Corte a definir; a curva de peso é do P39."
            }
          ]
        }
      ]
    },
    {
      "id": "3.2",
      "titulo": "Cuidados com o RN",
      "repete_por_bebe": true,
      "campos": [
        {
          "id": "troca_fraldas_avaliacao_diurese",
          "tipo": "sim_nao_texto",
          "rotulo": "Troca de fraldas e avaliação de diurese",
          "alertas": [
            {
              "descricao": "sem diurese ≥ 4 h",
              "regras": [
                "RN-04"
              ],
              "severidade": "imediato",
              "fonte": "DOC 3",
              "nota_clinica": "O campo não traz as horas sem diurese como número; a forma de avaliar fica para o motor de alertas (P40)."
            }
          ]
        },
        {
          "id": "banho_orientado_realizado",
          "tipo": "sim_nao",
          "rotulo": "Banho orientado ou realizado"
        },
        {
          "id": "coto_umbilical_avaliado",
          "tipo": "sim_nao_texto",
          "rotulo": "Coto umbilical avaliado e cuidado",
          "rotulo_texto": "Estado",
          "alertas": [
            {
              "descricao": "sinais flogísticos",
              "regras": [
                "RN-07"
              ],
              "severidade": "imediato",
              "fonte": "DOC 3",
              "nota_clinica": "O estado do coto é texto; a forma de avaliar fica para o motor de alertas (P40)."
            }
          ]
        },
        {
          "id": "vestimenta_adequada_clima",
          "tipo": "sim_nao",
          "rotulo": "Vestimenta adequada ao clima"
        }
      ]
    },
    {
      "id": "4",
      "titulo": "Orientações adicionais",
      "nota_clinica": "PRD 20.6 item 2 e K-19: a forma \"feito hoje\" é proposta da direção de arte e ainda não foi aprovada. Até a aprovação, sim ou não item a item.",
      "campos": [
        {
          "id": "massagem_extracao_leite",
          "tipo": "sim_nao",
          "rotulo": "Massagem e extração de leite"
        },
        {
          "id": "correcao_pega_posicao",
          "tipo": "sim_nao",
          "rotulo": "Correção de pega e posição"
        },
        {
          "id": "livre_demanda_reforcada",
          "tipo": "sim_nao",
          "rotulo": "Livre demanda reforçada"
        },
        {
          "id": "colica_disquesia",
          "tipo": "sim_nao",
          "rotulo": "Cólica e disquesia"
        },
        {
          "id": "posturas_de_conforto",
          "tipo": "sim_nao",
          "rotulo": "Posturas de conforto"
        },
        {
          "id": "sinais_de_fome",
          "tipo": "sim_nao",
          "rotulo": "Sinais de fome"
        },
        {
          "id": "manobra_de_desengasgo",
          "tipo": "sim_nao",
          "rotulo": "Manobra de desengasgo"
        }
      ]
    },
    {
      "id": "5",
      "titulo": "Sono e rotina",
      "nota_clinica": "PRD 20.6 item 2 e K-19: a forma \"feito hoje\" é proposta da direção de arte e ainda não foi aprovada. Até a aprovação, sim ou não item a item.",
      "campos": [
        {
          "id": "sono_seguro_orientado",
          "tipo": "sim_nao",
          "rotulo": "Sono seguro orientado"
        },
        {
          "id": "sinais_janelas_sono_explicados",
          "tipo": "sim_nao",
          "rotulo": "Sinais e janelas de sono explicados"
        },
        {
          "id": "organizacao_rotina_familiar",
          "tipo": "sim_nao",
          "rotulo": "Organização em acordo com a rotina familiar"
        }
      ]
    },
    {
      "id": "6",
      "titulo": "Educação da família",
      "nota_clinica": "PRD 20.6 item 2 e K-19: a forma \"feito hoje\" é proposta da direção de arte e ainda não foi aprovada. Até a aprovação, sim ou não item a item.",
      "campos": [
        {
          "id": "orientacoes_ao_parceiro",
          "tipo": "sim_nao",
          "rotulo": "Orientações ao parceiro"
        },
        {
          "id": "duvidas_esclarecidas",
          "tipo": "sim_nao",
          "rotulo": "Dúvidas esclarecidas"
        }
      ]
    },
    {
      "id": "7",
      "titulo": "Apoio emocional",
      "campos": [
        {
          "id": "escuta_ativa_emocoes_validadas",
          "tipo": "sim_nao",
          "rotulo": "Escuta ativa e emoções validadas"
        },
        {
          "id": "sinais_sofrimento_emocional",
          "tipo": "sim_nao_texto",
          "rotulo": "Sinais de sofrimento emocional",
          "alertas": [
            {
              "descricao": "se sim",
              "regras": [
                "SM-01",
                "SM-02",
                "SM-03",
                "SM-04",
                "SM-05",
                "SM-06",
                "SM-07"
              ],
              "condicao": {
                "campo": "7.sinais_sofrimento_emocional",
                "operador": "=",
                "valor": true
              },
              "acao": "abrir_seletor_doc3",
              "nota_clinica": "Apêndice B: seletor SM-01 a SM-07; severidade conforme o sinal; SM imediato cria ocorrência privada."
            }
          ]
        }
      ]
    },
    {
      "id": "8",
      "titulo": "Encerramento",
      "nota_clinica": "PRD 20.6 item 2 e K-19: a forma \"feito hoje\" é proposta da direção de arte e ainda não foi aprovada. Até a aprovação, sim ou não item a item.",
      "campos": [
        {
          "id": "ambiente_organizado",
          "tipo": "sim_nao",
          "rotulo": "Ambiente organizado"
        },
        {
          "id": "alinhamento_dia_seguinte",
          "tipo": "sim_nao",
          "rotulo": "Alinhamento para o dia seguinte"
        }
      ]
    },
    {
      "id": "9",
      "titulo": "Comunicação",
      "campos": [
        {
          "id": "contato_medico_necessario",
          "tipo": "sim_nao",
          "rotulo": "Contato com médico necessário",
          "alertas": [
            {
              "descricao": "abre ocorrência",
              "regras": [],
              "acao": "abrir_ocorrencia",
              "condicao": {
                "campo": "9.contato_medico_necessario",
                "operador": "=",
                "valor": true
              },
              "fonte": "v4.0"
            }
          ]
        },
        {
          "id": "motivo_contato_realizado",
          "tipo": "texto",
          "rotulo": "Motivo do contato realizado",
          "aparece_se": {
            "campo": "9.contato_medico_necessario",
            "operador": "=",
            "valor": true
          }
        }
      ]
    },
    {
      "id": "ultimo_dia",
      "titulo": "Último dia",
      "ajuda": "Obrigatórios do último dia.",
      "aparece_se": {
        "contexto": "ultimo_dia",
        "operador": "=",
        "valor": true
      },
      "campos": [
        {
          "id": "contato_obstetra",
          "tipo": "texto",
          "rotulo": "Contato do obstetra",
          "obrigatorio": true
        },
        {
          "id": "contato_pediatra",
          "tipo": "texto",
          "rotulo": "Contato do pediatra",
          "obrigatorio": true,
          "justificar_ausencia": {
            "rotulo_acao": "Não consegui, justificar",
            "rotulo_justificativa": "Justificativa da ausência do contato do pediatra"
          }
        },
        {
          "id": "resumo_encerramento",
          "tipo": "texto_longo",
          "rotulo": "Resumo de encerramento",
          "obrigatorio": true
        }
      ]
    },
    {
      "id": "assinatura",
      "titulo": "Assinatura",
      "campos": [
        {
          "id": "enfermeira_e_hora",
          "tipo": "automatico",
          "origem": "assinatura",
          "rotulo": "Enfermeira e hora",
          "obrigatorio": true
        }
      ]
    },
    {
      "id": "resumo",
      "titulo": "Resumo",
      "campos": [
        {
          "id": "resumo_descritivo",
          "tipo": "texto_longo",
          "rotulo": "Resumo descritivo do dia",
          "obrigatorio": true
        }
      ]
    }
  ]
}$instrumento$::jsonb, false)
on conflict (codigo, versao) do update
  set definicao = excluded.definicao,
      vigente = false
  where public.instrumento.aprovado_em is null
    and coalesce(jsonb_array_length(public.instrumento.definicao -> 'blocos'), 0) = 0;

-- DOC3_ALERTAS v1-2026-09 · Sinais de alerta e acionamento médico (doc3.json)
insert into public.instrumento (codigo, versao, definicao, vigente)
values ('DOC3_ALERTAS', 'v1-2026-09', $instrumento${
  "codigo": "DOC3_ALERTAS",
  "versao": "v1-2026-09",
  "titulo": "Sinais de alerta e acionamento médico",
  "fonte": "PRD v4.2, 9.3 (texto conforme a versão .docx do DOC 3)",
  "descricao": "Cada regra vira uma linha em regra_alerta. Sinais que não têm campo no checklist são registrados pela enfermeira num seletor com a lista do DOC 3.",
  "blocos": [
    {
      "id": "registro",
      "titulo": "Registro obrigatório",
      "ajuda": "Antes de fechar qualquer alerta. O registro e a comunicação ficam no checklist diário.",
      "campos": [
        {
          "id": "sinal_identificado",
          "tipo": "opcao_unica",
          "rotulo": "Sinal identificado",
          "opcoes": [
            {
              "valor": "pu_01",
              "rotulo": "PU-01 · Febre ≥ 38 °C"
            },
            {
              "valor": "pu_02",
              "rotulo": "PU-02 · Sangramento vaginal intenso (encharcar 1 absorvente em menos de 1 hora)"
            },
            {
              "valor": "pu_03",
              "rotulo": "PU-03 · Dor intensa, progressiva ou fora do esperado"
            },
            {
              "valor": "pu_04",
              "rotulo": "PU-04 · Sinais de infecção em ferida operatória (calor, vermelhidão, secreção purulenta)"
            },
            {
              "valor": "pu_05",
              "rotulo": "PU-05 · Cefaleia intensa associada a alteração visual"
            },
            {
              "valor": "pu_06",
              "rotulo": "PU-06 · Falta de ar, dor torácica"
            },
            {
              "valor": "pu_07",
              "rotulo": "PU-07 · Mal-estar importante ou prostração"
            },
            {
              "valor": "pu_08",
              "rotulo": "PU-08 · Febre baixa persistente (< 38 °C)"
            },
            {
              "valor": "pu_09",
              "rotulo": "PU-09 · Dor moderada não controlada"
            },
            {
              "valor": "pu_10",
              "rotulo": "PU-10 · Aumento progressivo dos lóquios (1 absorvente saturado em 3 h de uso)"
            },
            {
              "valor": "pu_11",
              "rotulo": "PU-11 · Sinais de ingurgitamento mamário patológico sem melhora com o manejo (hiperemia, dor intensa, febre, sem sucesso na drenagem de alívio)"
            },
            {
              "valor": "pu_12",
              "rotulo": "PU-12 · Fissuras mamilares graves ou com sinais inflamatórios"
            },
            {
              "valor": "sm_01",
              "rotulo": "SM-01 · Ideação suicida ou autoagressiva"
            },
            {
              "valor": "sm_02",
              "rotulo": "SM-02 · Comportamento desorganizado"
            },
            {
              "valor": "sm_03",
              "rotulo": "SM-03 · Desconexão importante com o bebê"
            },
            {
              "valor": "sm_04",
              "rotulo": "SM-04 · Tristeza intensa e persistente"
            },
            {
              "valor": "sm_05",
              "rotulo": "SM-05 · Ansiedade incapacitante"
            },
            {
              "valor": "sm_06",
              "rotulo": "SM-06 · Choro frequente sem alívio"
            },
            {
              "valor": "sm_07",
              "rotulo": "SM-07 · Relato de incapacidade de cuidar do bebê"
            },
            {
              "valor": "rn_01",
              "rotulo": "RN-01 · Dificuldade respiratória"
            },
            {
              "valor": "rn_02",
              "rotulo": "RN-02 · Cianose ou palidez acentuada"
            },
            {
              "valor": "rn_03",
              "rotulo": "RN-03 · Letargia importante"
            },
            {
              "valor": "rn_04",
              "rotulo": "RN-04 · Ausência de diurese por 4 horas ou mais"
            },
            {
              "valor": "rn_05",
              "rotulo": "RN-05 · Sangue nas fezes"
            },
            {
              "valor": "rn_06",
              "rotulo": "RN-06 · Convulsão"
            },
            {
              "valor": "rn_07",
              "rotulo": "RN-07 · Um ou mais sinais flogísticos do coto umbilical (hiperemia, secreção purulenta ou odor fétido)"
            },
            {
              "valor": "rn_08",
              "rotulo": "RN-08 · Febre (> 38 °C) ou hipotermia (< 36 °C)"
            },
            {
              "valor": "rn_09",
              "rotulo": "RN-09 · Recusa alimentar completa"
            },
            {
              "valor": "rn_10",
              "rotulo": "RN-10 · Icterícia progressiva indicando fototerapia"
            },
            {
              "valor": "rn_11",
              "rotulo": "RN-11 · Oligúria concentrada"
            },
            {
              "valor": "rn_12",
              "rotulo": "RN-12 · Vômitos frequentes"
            },
            {
              "valor": "rn_13",
              "rotulo": "RN-13 · Ganho ponderal insatisfatório (quando conhecido)"
            },
            {
              "valor": "am_01",
              "rotulo": "AM-01 · Mastite com sinais sistêmicos"
            },
            {
              "valor": "am_02",
              "rotulo": "AM-02 · Dor intensa associada a febre"
            },
            {
              "valor": "am_03",
              "rotulo": "AM-03 · Abscesso suspeito"
            },
            {
              "valor": "am_04",
              "rotulo": "AM-04 · Fissuras profundas"
            },
            {
              "valor": "am_05",
              "rotulo": "AM-05 · Dor persistente à amamentação"
            },
            {
              "valor": "am_06",
              "rotulo": "AM-06 · Baixa produção percebida com impacto no RN"
            }
          ],
          "obrigatorio": true,
          "clinico": true,
          "nota_clinica": "PRD 9.3: validar o seletor com a lista do DOC 3."
        },
        {
          "id": "horario_do_acionamento",
          "tipo": "hora",
          "rotulo": "Horário do acionamento",
          "obrigatorio": true
        },
        {
          "id": "orientacao_medica_recebida",
          "tipo": "texto_longo",
          "rotulo": "Orientação médica recebida",
          "obrigatorio": true
        },
        {
          "id": "conduta_adotada",
          "tipo": "texto_longo",
          "rotulo": "Conduta adotada",
          "obrigatorio": true
        }
      ]
    }
  ],
  "catalogo_alertas": {
    "severidades": [
      {
        "id": "imediato",
        "significado": "Acionar supervisão médica imediatamente. Orientar busca de atendimento emergencial."
      },
      {
        "id": "prioritario",
        "significado": "Comunicar supervisão médica no mesmo dia. Seguir orientação."
      }
    ],
    "grupos": [
      {
        "id": "puerpera",
        "titulo": "Puérpera",
        "condutas": [
          {
            "severidade": "imediato",
            "texto": "Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial."
          },
          {
            "severidade": "prioritario",
            "texto": "Comunicar supervisão médica e seguir orientação."
          }
        ],
        "sinais": [
          {
            "codigo": "PU-01",
            "descricao": "Febre ≥ 38 °C",
            "severidade": "imediato"
          },
          {
            "codigo": "PU-02",
            "descricao": "Sangramento vaginal intenso (encharcar 1 absorvente em menos de 1 hora)",
            "severidade": "imediato"
          },
          {
            "codigo": "PU-03",
            "descricao": "Dor intensa, progressiva ou fora do esperado",
            "severidade": "imediato"
          },
          {
            "codigo": "PU-04",
            "descricao": "Sinais de infecção em ferida operatória (calor, vermelhidão, secreção purulenta)",
            "severidade": "imediato"
          },
          {
            "codigo": "PU-05",
            "descricao": "Cefaleia intensa associada a alteração visual",
            "severidade": "imediato"
          },
          {
            "codigo": "PU-06",
            "descricao": "Falta de ar, dor torácica",
            "severidade": "imediato"
          },
          {
            "codigo": "PU-07",
            "descricao": "Mal-estar importante ou prostração",
            "severidade": "imediato"
          },
          {
            "codigo": "PU-08",
            "descricao": "Febre baixa persistente (< 38 °C)",
            "severidade": "prioritario"
          },
          {
            "codigo": "PU-09",
            "descricao": "Dor moderada não controlada",
            "severidade": "prioritario"
          },
          {
            "codigo": "PU-10",
            "descricao": "Aumento progressivo dos lóquios (1 absorvente saturado em 3 h de uso)",
            "severidade": "prioritario"
          },
          {
            "codigo": "PU-11",
            "descricao": "Sinais de ingurgitamento mamário patológico sem melhora com o manejo (hiperemia, dor intensa, febre, sem sucesso na drenagem de alívio)",
            "severidade": "prioritario"
          },
          {
            "codigo": "PU-12",
            "descricao": "Fissuras mamilares graves ou com sinais inflamatórios",
            "severidade": "prioritario"
          }
        ]
      },
      {
        "id": "saude_mental",
        "titulo": "Saúde mental materna",
        "condutas": [
          {
            "severidade": "imediato",
            "texto": "Não deixar a puérpera sozinha, acionar supervisão médica imediatamente e orientar busca de atendimento emergencial."
          },
          {
            "severidade": "prioritario",
            "texto": "Comunicar supervisão médica e registrar."
          }
        ],
        "observacao": "Regras SM imediatas escalam para a coordenação com prioridade máxima e criam ocorrência privada.",
        "sinais": [
          {
            "codigo": "SM-01",
            "descricao": "Ideação suicida ou autoagressiva",
            "severidade": "imediato"
          },
          {
            "codigo": "SM-02",
            "descricao": "Comportamento desorganizado",
            "severidade": "imediato"
          },
          {
            "codigo": "SM-03",
            "descricao": "Desconexão importante com o bebê",
            "severidade": "imediato"
          },
          {
            "codigo": "SM-04",
            "descricao": "Tristeza intensa e persistente",
            "severidade": "prioritario"
          },
          {
            "codigo": "SM-05",
            "descricao": "Ansiedade incapacitante",
            "severidade": "prioritario"
          },
          {
            "codigo": "SM-06",
            "descricao": "Choro frequente sem alívio",
            "severidade": "prioritario"
          },
          {
            "codigo": "SM-07",
            "descricao": "Relato de incapacidade de cuidar do bebê",
            "severidade": "prioritario"
          }
        ]
      },
      {
        "id": "recem_nascido",
        "titulo": "Recém-nascido",
        "condutas": [
          {
            "severidade": "imediato",
            "texto": "Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica."
          },
          {
            "severidade": "prioritario",
            "texto": "Comunicar supervisão médica e seguir orientação."
          }
        ],
        "sinais": [
          {
            "codigo": "RN-01",
            "descricao": "Dificuldade respiratória",
            "severidade": "imediato"
          },
          {
            "codigo": "RN-02",
            "descricao": "Cianose ou palidez acentuada",
            "severidade": "imediato"
          },
          {
            "codigo": "RN-03",
            "descricao": "Letargia importante",
            "severidade": "imediato"
          },
          {
            "codigo": "RN-04",
            "descricao": "Ausência de diurese por 4 horas ou mais",
            "severidade": "imediato"
          },
          {
            "codigo": "RN-05",
            "descricao": "Sangue nas fezes",
            "severidade": "imediato"
          },
          {
            "codigo": "RN-06",
            "descricao": "Convulsão",
            "severidade": "imediato"
          },
          {
            "codigo": "RN-07",
            "descricao": "Um ou mais sinais flogísticos do coto umbilical (hiperemia, secreção purulenta ou odor fétido)",
            "severidade": "imediato"
          },
          {
            "codigo": "RN-08",
            "descricao": "Febre (> 38 °C) ou hipotermia (< 36 °C)",
            "severidade": "imediato"
          },
          {
            "codigo": "RN-09",
            "descricao": "Recusa alimentar completa",
            "severidade": "imediato"
          },
          {
            "codigo": "RN-10",
            "descricao": "Icterícia progressiva indicando fototerapia",
            "severidade": "prioritario"
          },
          {
            "codigo": "RN-11",
            "descricao": "Oligúria concentrada",
            "severidade": "prioritario"
          },
          {
            "codigo": "RN-12",
            "descricao": "Vômitos frequentes",
            "severidade": "prioritario"
          },
          {
            "codigo": "RN-13",
            "descricao": "Ganho ponderal insatisfatório (quando conhecido)",
            "severidade": "prioritario"
          }
        ]
      },
      {
        "id": "amamentacao",
        "titulo": "Amamentação e mamas",
        "condutas": [
          {
            "severidade": "imediato",
            "texto": "Suspender procedimentos eletivos (laser) e acionar supervisão médica."
          },
          {
            "severidade": "prioritario",
            "texto": "Comunicar supervisão médica e avaliar consultoria especializada."
          }
        ],
        "sinais": [
          {
            "codigo": "AM-01",
            "descricao": "Mastite com sinais sistêmicos",
            "severidade": "imediato"
          },
          {
            "codigo": "AM-02",
            "descricao": "Dor intensa associada a febre",
            "severidade": "imediato"
          },
          {
            "codigo": "AM-03",
            "descricao": "Abscesso suspeito",
            "severidade": "imediato"
          },
          {
            "codigo": "AM-04",
            "descricao": "Fissuras profundas",
            "severidade": "prioritario"
          },
          {
            "codigo": "AM-05",
            "descricao": "Dor persistente à amamentação",
            "severidade": "prioritario"
          },
          {
            "codigo": "AM-06",
            "descricao": "Baixa produção percebida com impacto no RN",
            "severidade": "prioritario"
          }
        ]
      }
    ],
    "notificacao": [
      {
        "severidade": "imediato",
        "texto": "Push para a coordenação, mensagem no grupo clínico da equipe pelo WhatsApp interno e ligação sugerida na tela da enfermeira. O alerta aparece na ficha até ser fechado."
      },
      {
        "severidade": "prioritario",
        "texto": "Push e mensagem no grupo. O alerta aparece na ficha até ser fechado."
      }
    ]
  }
}$instrumento$::jsonb, false)
on conflict (codigo, versao) do update
  set definicao = excluded.definicao,
      vigente = false
  where public.instrumento.aprovado_em is null
    and coalesce(jsonb_array_length(public.instrumento.definicao -> 'blocos'), 0) = 0;

-- DOC4_MAMADA v1-2026-09 · Avaliação da mamada e laserterapia (doc4.json)
insert into public.instrumento (codigo, versao, definicao, vigente)
values ('DOC4_MAMADA', 'v1-2026-09', $instrumento${
  "codigo": "DOC4_MAMADA",
  "versao": "v1-2026-09",
  "titulo": "Avaliação da mamada e laserterapia",
  "fonte": "PRD v4.2, 9.4",
  "descricao": "Instrumento de apoio visual, usado durante a visita, em janela auxiliar dos campos 2.7, 2.8 e 2.9 do checklist diário.",
  "blocos": [
    {
      "id": "latch",
      "titulo": "Escala LATCH",
      "apoia_campo": "DOC2_CHECKLIST:2.8.latch",
      "ajuda": "Interpretação do DOC 4: 0 a 7 apoio necessário, 8 a 10 amamentação eficaz.",
      "campos": [
        {
          "id": "pega",
          "tipo": "escala",
          "rotulo": "Pega",
          "min": 0,
          "max": 2
        },
        {
          "id": "degluticao_audivel",
          "tipo": "escala",
          "rotulo": "Deglutição audível",
          "min": 0,
          "max": 2
        },
        {
          "id": "tipo_de_mamilo",
          "tipo": "escala",
          "rotulo": "Tipo de mamilo",
          "min": 0,
          "max": 2
        },
        {
          "id": "conforto",
          "tipo": "escala",
          "rotulo": "Conforto",
          "min": 0,
          "max": 2
        },
        {
          "id": "colo",
          "tipo": "escala",
          "rotulo": "Colo",
          "min": 0,
          "max": 2
        }
      ]
    },
    {
      "id": "nts",
      "titulo": "Escore de trauma mamilar (NTS)",
      "apoia_campo": "DOC2_CHECKLIST:2.7.nts",
      "ajuda": "Escala visual em janela auxiliar.",
      "campos": [
        {
          "id": "nts",
          "tipo": "escala",
          "rotulo": "Escore de trauma mamilar (NTS)",
          "min": 0,
          "max": 5,
          "pontos": [
            {
              "valor": 0,
              "rotulo": "Normal"
            },
            {
              "valor": 1,
              "rotulo": "Leve (eritema ou edema)"
            },
            {
              "valor": 2,
              "rotulo": "Moderado (dano superficial em menos de 25% do mamilo)"
            },
            {
              "valor": 3,
              "rotulo": "Grave (dano superficial em mais de 25%)"
            },
            {
              "valor": 4,
              "rotulo": "Crítico (lesão de espessura parcial em menos de 25%)"
            },
            {
              "valor": 5,
              "rotulo": "Severo (lesão de espessura parcial em mais de 25%)"
            }
          ]
        }
      ]
    },
    {
      "id": "laserterapia",
      "titulo": "Protocolos de laserterapia",
      "apoia_campo": "DOC2_CHECKLIST:2.9.fbm_aplicada",
      "campos": [
        {
          "id": "protocolo",
          "tipo": "opcao_unica",
          "rotulo": "Protocolo",
          "opcoes": [
            {
              "valor": "analgesia",
              "rotulo": "Analgesia",
              "ajuda": "4 J de infravermelho nos 4 pontos cardeais"
            },
            {
              "valor": "reparacao",
              "rotulo": "Reparação",
              "ajuda": "2 J de vermelho no centro do mamilo"
            },
            {
              "valor": "fotoativacao_drenagem_linfatica",
              "rotulo": "Fotoativação e drenagem linfática",
              "ajuda": "4 J de infravermelho na rede ganglionar"
            },
            {
              "valor": "ilib",
              "rotulo": "ILIB",
              "ajuda": "Vermelho, 30 minutos",
              "clinico": true,
              "nota_clinica": "PRD 9.4 e K-08: no impresso o ILIB aparece como \"infravermelho\"; a v4.0 e o treinamento de 25/07 mandam \"vermelho\". A versão digital já nasce com vermelho; confirmar o texto exato."
            }
          ]
        }
      ]
    }
  ]
}$instrumento$::jsonb, false)
on conflict (codigo, versao) do update
  set definicao = excluded.definicao,
      vigente = false
  where public.instrumento.aprovado_em is null
    and coalesce(jsonb_array_length(public.instrumento.definicao -> 'blocos'), 0) = 0;
