export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          ativa: boolean | null
          cor: string | null
          created_at: string
          icone: string | null
          id: string
          nome: string
          saldo_atual: number | null
          saldo_inicial: number
          scope: Database["public"]["Enums"]["scope_type"] | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativa?: boolean | null
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          nome: string
          saldo_atual?: number | null
          saldo_inicial?: number
          scope?: Database["public"]["Enums"]["scope_type"] | null
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativa?: boolean | null
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          nome?: string
          saldo_atual?: number | null
          saldo_inicial?: number
          scope?: Database["public"]["Enums"]["scope_type"] | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          contexto: string | null
          created_at: string
          id: string
          scope: Database["public"]["Enums"]["scope_type"] | null
          titulo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contexto?: string | null
          created_at?: string
          id?: string
          scope?: Database["public"]["Enums"]["scope_type"] | null
          titulo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contexto?: string | null
          created_at?: string
          id?: string
          scope?: Database["public"]["Enums"]["scope_type"] | null
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          contexto_enviado: Json | null
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["ai_message_role"]
          user_id: string
        }
        Insert: {
          content: string
          contexto_enviado?: Json | null
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["ai_message_role"]
          user_id: string
        }
        Update: {
          content?: string
          contexto_enviado?: Json | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["ai_message_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          dados: Json | null
          data_expiracao: string | null
          id: string
          lido: boolean | null
          mensagem: string
          nivel: Database["public"]["Enums"]["alert_level"] | null
          scope: Database["public"]["Enums"]["scope_type"] | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          data_expiracao?: string | null
          id?: string
          lido?: boolean | null
          mensagem: string
          nivel?: Database["public"]["Enums"]["alert_level"] | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          data_expiracao?: string | null
          id?: string
          lido?: boolean | null
          mensagem?: string
          nivel?: Database["public"]["Enums"]["alert_level"] | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_valuations: {
        Row: {
          asset_id: string
          created_at: string
          data_referencia: string
          id: string
          valor: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          data_referencia?: string
          id?: string
          valor: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          data_referencia?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_valuations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          ativo: boolean | null
          created_at: string
          data_aquisicao: string | null
          detalhes: Json | null
          id: string
          instituicao: string | null
          liquidez: string | null
          nome: string
          tipo: string
          updated_at: string
          user_id: string
          valor_aquisicao: number
          valor_atual: number
          vencimento: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          data_aquisicao?: string | null
          detalhes?: Json | null
          id?: string
          instituicao?: string | null
          liquidez?: string | null
          nome: string
          tipo?: string
          updated_at?: string
          user_id: string
          valor_aquisicao?: number
          valor_atual?: number
          vencimento?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          data_aquisicao?: string | null
          detalhes?: Json | null
          id?: string
          instituicao?: string | null
          liquidez?: string | null
          nome?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_aquisicao?: number
          valor_atual?: number
          vencimento?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          context: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          context?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          context?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          ano: number
          categoria_id: string | null
          created_at: string
          id: string
          mes: number
          scope: Database["public"]["Enums"]["scope_type"] | null
          updated_at: string
          user_id: string
          valor_planejado: number
        }
        Insert: {
          ano: number
          categoria_id?: string | null
          created_at?: string
          id?: string
          mes: number
          scope?: Database["public"]["Enums"]["scope_type"] | null
          updated_at?: string
          user_id: string
          valor_planejado?: number
        }
        Update: {
          ano?: number
          categoria_id?: string | null
          created_at?: string
          id?: string
          mes?: number
          scope?: Database["public"]["Enums"]["scope_type"] | null
          updated_at?: string
          user_id?: string
          valor_planejado?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          cor: string | null
          created_at: string
          e_mei: boolean | null
          icone: string | null
          id: string
          is_system: boolean | null
          limite_mensal: number | null
          nome: string
          scope: Database["public"]["Enums"]["scope_type"] | null
          tipo: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cor?: string | null
          created_at?: string
          e_mei?: boolean | null
          icone?: string | null
          id?: string
          is_system?: boolean | null
          limite_mensal?: number | null
          nome: string
          scope?: Database["public"]["Enums"]["scope_type"] | null
          tipo?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cor?: string | null
          created_at?: string
          e_mei?: boolean | null
          icone?: string | null
          id?: string
          is_system?: boolean | null
          limite_mensal?: number | null
          nome?: string
          scope?: Database["public"]["Enums"]["scope_type"] | null
          tipo?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          ano_fiscal: number | null
          category: string | null
          competencia: string | null
          created_at: string
          dados_extraidos: Json | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          file_name: string
          file_url: string | null
          holder: string | null
          id: string
          linked_entity_id: string | null
          linked_entity_type: string | null
          retention_policy: string | null
          scope: Database["public"]["Enums"]["scope_type"] | null
          status_processamento: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ano_fiscal?: number | null
          category?: string | null
          competencia?: string | null
          created_at?: string
          dados_extraidos?: Json | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          file_name: string
          file_url?: string | null
          holder?: string | null
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          retention_policy?: string | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          status_processamento?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ano_fiscal?: number | null
          category?: string | null
          competencia?: string | null
          created_at?: string
          dados_extraidos?: Json | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          file_name?: string
          file_url?: string | null
          holder?: string | null
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          retention_policy?: string | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          status_processamento?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      extra_amortizations: {
        Row: {
          created_at: string
          data: string
          economia_juros_calculada: number | null
          emprestimo_id: string
          id: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          economia_juros_calculada?: number | null
          emprestimo_id: string
          id?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          economia_juros_calculada?: number | null
          emprestimo_id?: string
          id?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extra_amortizations_emprestimo_id_fkey"
            columns: ["emprestimo_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      family_values: {
        Row: {
          categoria_id: string | null
          created_at: string
          descricao: string
          id: string
          importancia: number | null
          scope: Database["public"]["Enums"]["scope_type"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          importancia?: number | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          importancia?: number | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_values_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          created_at: string
          data: string
          goal_id: string
          id: string
          notas: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          goal_id: string
          id?: string
          notas?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          goal_id?: string
          id?: string
          notas?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          ativo: boolean | null
          created_at: string
          foto_url: string | null
          id: string
          nome: string
          notas: string | null
          para_quem: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["goal_priority"] | null
          scope: Database["public"]["Enums"]["scope_type"] | null
          updated_at: string
          user_id: string
          valor_alvo: number
          valor_atual: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          foto_url?: string | null
          id?: string
          nome: string
          notas?: string | null
          para_quem?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["goal_priority"] | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          updated_at?: string
          user_id: string
          valor_alvo: number
          valor_atual?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          foto_url?: string | null
          id?: string
          nome?: string
          notas?: string | null
          para_quem?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["goal_priority"] | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          updated_at?: string
          user_id?: string
          valor_alvo?: number
          valor_atual?: number | null
        }
        Relationships: []
      }
      health_scores: {
        Row: {
          adimplencia: number | null
          ano: number
          comprometimento_renda: number | null
          controle_orcamento: number | null
          created_at: string
          detalhes: Json | null
          id: string
          mes: number
          regularidade: number | null
          reserva_emergencia: number | null
          score_geral: number | null
          user_id: string
        }
        Insert: {
          adimplencia?: number | null
          ano: number
          comprometimento_renda?: number | null
          controle_orcamento?: number | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          mes: number
          regularidade?: number | null
          reserva_emergencia?: number | null
          score_geral?: number | null
          user_id: string
        }
        Update: {
          adimplencia?: number | null
          ano?: number
          comprometimento_renda?: number | null
          controle_orcamento?: number | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          mes?: number
          regularidade?: number | null
          reserva_emergencia?: number | null
          score_geral?: number | null
          user_id?: string
        }
        Relationships: []
      }
      loan_installments: {
        Row: {
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          emprestimo_id: string
          id: string
          numero: number
          status: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          emprestimo_id: string
          id?: string
          numero: number
          status?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          emprestimo_id?: string
          id?: string
          numero?: number
          status?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_emprestimo_id_fkey"
            columns: ["emprestimo_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          ativo: boolean | null
          cet_anual: number | null
          created_at: string
          credor: string | null
          data_inicio: string | null
          devedor: string | null
          id: string
          metodo_amortizacao:
            | Database["public"]["Enums"]["amortization_method"]
            | null
          nome: string
          observacoes: string | null
          parcelas_restantes: number | null
          parcelas_total: number | null
          saldo_devedor: number | null
          scope: Database["public"]["Enums"]["scope_type"] | null
          taxa_juros_mensal: number | null
          tipo: Database["public"]["Enums"]["loan_type"] | null
          updated_at: string
          user_id: string
          valor_original: number
          valor_parcela: number | null
        }
        Insert: {
          ativo?: boolean | null
          cet_anual?: number | null
          created_at?: string
          credor?: string | null
          data_inicio?: string | null
          devedor?: string | null
          id?: string
          metodo_amortizacao?:
            | Database["public"]["Enums"]["amortization_method"]
            | null
          nome: string
          observacoes?: string | null
          parcelas_restantes?: number | null
          parcelas_total?: number | null
          saldo_devedor?: number | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          taxa_juros_mensal?: number | null
          tipo?: Database["public"]["Enums"]["loan_type"] | null
          updated_at?: string
          user_id: string
          valor_original: number
          valor_parcela?: number | null
        }
        Update: {
          ativo?: boolean | null
          cet_anual?: number | null
          created_at?: string
          credor?: string | null
          data_inicio?: string | null
          devedor?: string | null
          id?: string
          metodo_amortizacao?:
            | Database["public"]["Enums"]["amortization_method"]
            | null
          nome?: string
          observacoes?: string | null
          parcelas_restantes?: number | null
          parcelas_total?: number | null
          saldo_devedor?: number | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          taxa_juros_mensal?: number | null
          tipo?: Database["public"]["Enums"]["loan_type"] | null
          updated_at?: string
          user_id?: string
          valor_original?: number
          valor_parcela?: number | null
        }
        Relationships: []
      }
      mei_settings: {
        Row: {
          alerta_threshold_percent: number | null
          ano_referencia: number
          created_at: string
          id: string
          limite_anual: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alerta_threshold_percent?: number | null
          ano_referencia: number
          created_at?: string
          id?: string
          limite_anual?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alerta_threshold_percent?: number | null
          ano_referencia?: number
          created_at?: string
          id?: string
          limite_anual?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_closings: {
        Row: {
          ano: number
          created_at: string
          fechado_em: string | null
          fechado_por: string | null
          id: string
          mes: number
          pendencias: Json | null
          reaberto_em: string | null
          reaberto_por: string | null
          reabertura_motivo: string | null
          resumo: string | null
          saldo: number | null
          status: Database["public"]["Enums"]["closing_status"] | null
          total_despesas: number | null
          total_receitas: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes: number
          pendencias?: Json | null
          reaberto_em?: string | null
          reaberto_por?: string | null
          reabertura_motivo?: string | null
          resumo?: string | null
          saldo?: number | null
          status?: Database["public"]["Enums"]["closing_status"] | null
          total_despesas?: number | null
          total_receitas?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes?: number
          pendencias?: Json | null
          reaberto_em?: string | null
          reaberto_por?: string | null
          reabertura_motivo?: string | null
          resumo?: string | null
          saldo?: number | null
          status?: Database["public"]["Enums"]["closing_status"] | null
          total_despesas?: number | null
          total_receitas?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          completed: boolean | null
          created_at: string
          id: string
          step_assinaturas: boolean | null
          step_despesas: boolean | null
          step_dividas: boolean | null
          step_metas: boolean | null
          step_perfil: boolean | null
          step_preferencias_ia: boolean | null
          step_renda: boolean | null
          step_valores: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          id?: string
          step_assinaturas?: boolean | null
          step_despesas?: boolean | null
          step_dividas?: boolean | null
          step_metas?: boolean | null
          step_perfil?: boolean | null
          step_preferencias_ia?: boolean | null
          step_renda?: boolean | null
          step_valores?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          id?: string
          step_assinaturas?: boolean | null
          step_despesas?: boolean | null
          step_dividas?: boolean | null
          step_metas?: boolean | null
          step_perfil?: boolean | null
          step_preferencias_ia?: boolean | null
          step_renda?: boolean | null
          step_valores?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          familia_id: string | null
          id: string
          nome: string
          perfil: string | null
          preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          familia_id?: string | null
          id?: string
          nome?: string
          perfil?: string | null
          preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          familia_id?: string | null
          id?: string
          nome?: string
          perfil?: string | null
          preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          ativa: boolean | null
          categoria_id: string | null
          created_at: string
          descricao: string
          dia_mes: number | null
          e_mei: boolean | null
          frequencia: Database["public"]["Enums"]["frequency_type"] | null
          id: string
          responsavel: string | null
          scope: Database["public"]["Enums"]["scope_type"] | null
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          ativa?: boolean | null
          categoria_id?: string | null
          created_at?: string
          descricao: string
          dia_mes?: number | null
          e_mei?: boolean | null
          frequencia?: Database["public"]["Enums"]["frequency_type"] | null
          id?: string
          responsavel?: string | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          ativa?: boolean | null
          categoria_id?: string | null
          created_at?: string
          descricao?: string
          dia_mes?: number | null
          e_mei?: boolean | null
          frequencia?: Database["public"]["Enums"]["frequency_type"] | null
          id?: string
          responsavel?: string | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          tipo?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          categoria_id: string | null
          created_at: string
          data_cobranca: number | null
          id: string
          nome_servico: string
          observacoes: string | null
          scope: Database["public"]["Enums"]["scope_type"] | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string
          user_id: string
          valor_mensal: number
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          data_cobranca?: number | null
          id?: string
          nome_servico: string
          observacoes?: string | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string
          user_id: string
          valor_mensal: number
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          data_cobranca?: number | null
          id?: string
          nome_servico?: string
          observacoes?: string | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string
          user_id?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          categoria_id: string | null
          competencia: string | null
          comprovante_url: string | null
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          created_at: string
          created_by: string | null
          data: string
          data_status: Database["public"]["Enums"]["data_status"] | null
          descricao: string | null
          e_mei: boolean | null
          emprestimo_id: string | null
          id: string
          scope: Database["public"]["Enums"]["scope_type"] | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          tags: string[] | null
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          updated_by: string | null
          user_id: string
          validation_notes: string | null
          valor: number
        }
        Insert: {
          account_id?: string | null
          categoria_id?: string | null
          competencia?: string | null
          comprovante_url?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          created_by?: string | null
          data?: string
          data_status?: Database["public"]["Enums"]["data_status"] | null
          descricao?: string | null
          e_mei?: boolean | null
          emprestimo_id?: string | null
          id?: string
          scope?: Database["public"]["Enums"]["scope_type"] | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          tags?: string[] | null
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
          validation_notes?: string | null
          valor: number
        }
        Update: {
          account_id?: string | null
          categoria_id?: string | null
          competencia?: string | null
          comprovante_url?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          created_by?: string | null
          data?: string
          data_status?: Database["public"]["Enums"]["data_status"] | null
          descricao?: string | null
          e_mei?: boolean | null
          emprestimo_id?: string | null
          id?: string
          scope?: Database["public"]["Enums"]["scope_type"] | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          tags?: string[] | null
          tipo?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          validation_notes?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_emprestimo_id_fkey"
            columns: ["emprestimo_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_familia_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      ai_message_role: "user" | "assistant" | "system"
      alert_level: "critical" | "warning" | "info" | "opportunity"
      amortization_method: "price" | "sac"
      closing_status: "open" | "reviewing" | "closed"
      confidence_level: "alta" | "media" | "baixa"
      data_status:
        | "confirmed"
        | "suggested"
        | "incomplete"
        | "inconsistent"
        | "missing"
        | "estimated"
      document_type:
        | "contracheque"
        | "recibo_medico"
        | "recibo_educacao"
        | "informe_rendimentos"
        | "das_mei"
        | "nota_fiscal"
        | "comprovante"
        | "outro"
      frequency_type:
        | "daily"
        | "weekly"
        | "biweekly"
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "yearly"
      goal_priority: "alta" | "media" | "baixa"
      loan_type: "consignado" | "pessoal" | "cartao" | "financiamento" | "outro"
      scope_type: "private" | "family" | "business"
      source_type:
        | "manual"
        | "voice"
        | "photo_ocr"
        | "free_text"
        | "sms"
        | "ai_suggestion"
        | "system_generated"
      subscription_status: "active" | "cancelled" | "paused"
      transaction_type: "income" | "expense"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_message_role: ["user", "assistant", "system"],
      alert_level: ["critical", "warning", "info", "opportunity"],
      amortization_method: ["price", "sac"],
      closing_status: ["open", "reviewing", "closed"],
      confidence_level: ["alta", "media", "baixa"],
      data_status: [
        "confirmed",
        "suggested",
        "incomplete",
        "inconsistent",
        "missing",
        "estimated",
      ],
      document_type: [
        "contracheque",
        "recibo_medico",
        "recibo_educacao",
        "informe_rendimentos",
        "das_mei",
        "nota_fiscal",
        "comprovante",
        "outro",
      ],
      frequency_type: [
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "semiannual",
        "yearly",
      ],
      goal_priority: ["alta", "media", "baixa"],
      loan_type: ["consignado", "pessoal", "cartao", "financiamento", "outro"],
      scope_type: ["private", "family", "business"],
      source_type: [
        "manual",
        "voice",
        "photo_ocr",
        "free_text",
        "sms",
        "ai_suggestion",
        "system_generated",
      ],
      subscription_status: ["active", "cancelled", "paused"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
