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
      bank_slip_history: {
        Row: {
          action: string
          bank_slip_id: string | null
          created_at: string | null
          id: string
          new_status: string | null
          notes: string | null
          performed_by: string | null
          prev_status: string | null
        }
        Insert: {
          action: string
          bank_slip_id?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          performed_by?: string | null
          prev_status?: string | null
        }
        Update: {
          action?: string
          bank_slip_id?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          performed_by?: string | null
          prev_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_slip_history_bank_slip_id_fkey"
            columns: ["bank_slip_id"]
            isOneToOne: false
            referencedRelation: "bank_slips"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_slips: {
        Row: {
          classification: string | null
          client_name: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          dda: string | null
          due_date: string
          fine_amount: number
          id: string
          import_batch_id: string | null
          interest_amount: number
          lembrete: string | null
          nfe_number: string | null
          notes: string | null
          payment_date: string | null
          principal_amount: number
          reference: string | null
          reminder: string | null
          salesperson_name: string | null
          status: string
          updated_amount: number
          updated_at: string | null
        }
        Insert: {
          classification?: string | null
          client_name: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dda?: string | null
          due_date: string
          fine_amount?: number
          id?: string
          import_batch_id?: string | null
          interest_amount?: number
          lembrete?: string | null
          nfe_number?: string | null
          notes?: string | null
          payment_date?: string | null
          principal_amount?: number
          reference?: string | null
          reminder?: string | null
          salesperson_name?: string | null
          status?: string
          updated_amount?: number
          updated_at?: string | null
        }
        Update: {
          classification?: string | null
          client_name?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dda?: string | null
          due_date?: string
          fine_amount?: number
          id?: string
          import_batch_id?: string | null
          interest_amount?: number
          lembrete?: string | null
          nfe_number?: string | null
          notes?: string | null
          payment_date?: string | null
          principal_amount?: number
          reference?: string | null
          reminder?: string | null
          salesperson_name?: string | null
          status?: string
          updated_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_slips_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "financial_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          address_number: string | null
          cep: string | null
          city: string | null
          client_type: string | null
          company: string | null
          company_id: string | null
          company_name: string | null
          complement: string | null
          contact_name: string | null
          contact_phone: string | null
          contrib_icms: string | null
          cpf_cnpj: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_revenda: boolean
          is_whatsapp: boolean | null
          last_interaction_at: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          phone: string | null
          pipeline_stage: string
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          client_type?: string | null
          company?: string | null
          company_id?: string | null
          company_name?: string | null
          complement?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contrib_icms?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_revenda?: boolean
          is_whatsapp?: boolean | null
          last_interaction_at?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          client_type?: string | null
          company?: string | null
          company_id?: string | null
          company_name?: string | null
          complement?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contrib_icms?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_revenda?: boolean
          is_whatsapp?: boolean | null
          last_interaction_at?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      financial_action_history: {
        Row: {
          action_type: string
          created_at: string
          financial_record_id: string
          id: string
          new_status: string | null
          notes: string | null
          performed_by: string
          performed_by_name: string | null
          previous_status: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          financial_record_id: string
          id?: string
          new_status?: string | null
          notes?: string | null
          performed_by: string
          performed_by_name?: string | null
          previous_status?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          financial_record_id?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          performed_by?: string
          performed_by_name?: string | null
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_action_history_financial_record_id_fkey"
            columns: ["financial_record_id"]
            isOneToOne: false
            referencedRelation: "financial_records"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_import_batches: {
        Row: {
          company_id: string
          created_at: string
          filename: string
          id: string
          import_date: string
          imported_by: string
          status: string
          total_records: number
          total_value: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          filename: string
          id?: string
          import_date?: string
          imported_by: string
          status?: string
          total_records?: number
          total_value?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          filename?: string
          id?: string
          import_date?: string
          imported_by?: string
          status?: string
          total_records?: number
          total_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      financial_records: {
        Row: {
          amount_paid: number | null
          baixa_at: string | null
          baixa_by: string | null
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string | null
          due_date: string | null
          external_order_id: string | null
          financial_notes: string | null
          financial_status: string
          id: string
          installment_number: number | null
          installments_total: number | null
          paid_date: string | null
          payment_method: string | null
          quote_id: string | null
          source: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          baixa_at?: string | null
          baixa_by?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          external_order_id?: string | null
          financial_notes?: string | null
          financial_status?: string
          id?: string
          installment_number?: number | null
          installments_total?: number | null
          paid_date?: string | null
          payment_method?: string | null
          quote_id?: string | null
          source?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          baixa_at?: string | null
          baixa_by?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          external_order_id?: string | null
          financial_notes?: string | null
          financial_status?: string
          id?: string
          installment_number?: number | null
          installments_total?: number | null
          paid_date?: string | null
          payment_method?: string | null
          quote_id?: string | null
          source?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_notification_logs: {
        Row: {
          created_at: string
          id: string
          notification_type: string
          notified_at: string
          quote_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_type: string
          notified_at?: string
          quote_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_type?: string
          notified_at?: string
          quote_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_notification_logs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          records_count: number | null
          source_url: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          records_count?: number | null
          source_url?: string | null
          status: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          records_count?: number | null
          source_url?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          api_key: string | null
          application_key: string | null
          config: Json | null
          created_at: string
          created_by: string
          id: string
          integration_name: string
          last_sync_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          application_key?: string | null
          config?: Json | null
          created_at?: string
          created_by: string
          id?: string
          integration_name: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          application_key?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string
          id?: string
          integration_name?: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      logistics_action_history: {
        Row: {
          action_type: string
          created_at: string
          id: string
          logistics_record_id: string
          new_status: string | null
          notes: string | null
          performed_by: string
          performed_by_name: string | null
          previous_status: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          logistics_record_id: string
          new_status?: string | null
          notes?: string | null
          performed_by: string
          performed_by_name?: string | null
          previous_status?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          logistics_record_id?: string
          new_status?: string | null
          notes?: string | null
          performed_by?: string
          performed_by_name?: string | null
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_action_history_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_records: {
        Row: {
          codigo_rastreio: string | null
          created_at: string
          data_entrega: string | null
          data_envio: string | null
          entrada_at: string | null
          entrada_by: string | null
          id: string
          logistics_status: string
          nf_chave_acesso: string | null
          nf_data: string | null
          nf_numero: string | null
          nf_pdf_url: string | null
          nf_xml_url: string | null
          observacao_logistica: string | null
          origem_nf: string | null
          quote_id: string
          transportadora: string | null
          ultima_sincronizacao_nf: string | null
          updated_at: string
        }
        Insert: {
          codigo_rastreio?: string | null
          created_at?: string
          data_entrega?: string | null
          data_envio?: string | null
          entrada_at?: string | null
          entrada_by?: string | null
          id?: string
          logistics_status?: string
          nf_chave_acesso?: string | null
          nf_data?: string | null
          nf_numero?: string | null
          nf_pdf_url?: string | null
          nf_xml_url?: string | null
          observacao_logistica?: string | null
          origem_nf?: string | null
          quote_id: string
          transportadora?: string | null
          ultima_sincronizacao_nf?: string | null
          updated_at?: string
        }
        Update: {
          codigo_rastreio?: string | null
          created_at?: string
          data_entrega?: string | null
          data_envio?: string | null
          entrada_at?: string | null
          entrada_by?: string | null
          id?: string
          logistics_status?: string
          nf_chave_acesso?: string | null
          nf_data?: string | null
          nf_numero?: string | null
          nf_pdf_url?: string | null
          nf_xml_url?: string | null
          observacao_logistica?: string | null
          origem_nf?: string | null
          quote_id?: string
          transportadora?: string | null
          ultima_sincronizacao_nf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_records_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_client_id: string | null
          related_quote_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_client_id?: string | null
          related_quote_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_client_id?: string | null
          related_quote_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_quote_id_fkey"
            columns: ["related_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_log: {
        Row: {
          created_at: string
          id: string
          performed_by: string
          performed_by_name: string | null
          target_user_id: string
          target_user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          performed_by: string
          performed_by_name?: string | null
          target_user_id: string
          target_user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          performed_by?: string
          performed_by_name?: string | null
          target_user_id?: string
          target_user_name?: string | null
        }
        Relationships: []
      }
      product_relationships: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          observacao: string | null
          product_id: string | null
          related_product_id: string | null
          tipo_relacao: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          observacao?: string | null
          product_id?: string | null
          related_product_id?: string | null
          tipo_relacao: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          observacao?: string | null
          product_id?: string | null
          related_product_id?: string | null
          tipo_relacao?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_relationships_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_relationships_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_principal: string | null
          code: string | null
          company_id: string | null
          compatibility: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          level: string | null
          name: string
          price: number | null
          sku: string | null
        }
        Insert: {
          brand?: string | null
          category_principal?: string | null
          code?: string | null
          company_id?: string | null
          compatibility?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          level?: string | null
          name: string
          price?: number | null
          sku?: string | null
        }
        Update: {
          brand?: string | null
          category_principal?: string | null
          code?: string | null
          company_id?: string | null
          compatibility?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          level?: string | null
          name?: string
          price?: number | null
          sku?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          can_access_support_manager: boolean | null
          commercial_visible: boolean
          company_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          force_password_change: boolean
          full_name: string
          id: string
          phone: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          can_access_support_manager?: boolean | null
          commercial_visible?: boolean
          company_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          force_password_change?: boolean
          full_name?: string
          id?: string
          phone?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          can_access_support_manager?: boolean | null
          commercial_visible?: boolean
          company_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          force_password_change?: boolean
          full_name?: string
          id?: string
          phone?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          brand: string | null
          category: string | null
          code: string | null
          description: string
          discount_percent: number | null
          id: string
          image_url: string | null
          is_gift: boolean
          item_number: number | null
          line_total: number | null
          model: string | null
          product_code: string | null
          quantity: number | null
          quote_id: string
          specifications: string | null
          total_price: number | null
          unit_price: number | null
          unit_total: number | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          code?: string | null
          description?: string
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          is_gift?: boolean
          item_number?: number | null
          line_total?: number | null
          model?: string | null
          product_code?: string | null
          quantity?: number | null
          quote_id: string
          specifications?: string | null
          total_price?: number | null
          unit_price?: number | null
          unit_total?: number | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          code?: string | null
          description?: string
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          is_gift?: boolean
          item_number?: number | null
          line_total?: number | null
          model?: string | null
          product_code?: string | null
          quantity?: number | null
          quote_id?: string
          specifications?: string | null
          total_price?: number | null
          unit_price?: number | null
          unit_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          quote_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          quote_id: string
          user_id: string
          user_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          quote_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          client_id: string | null
          client_name: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          discount: number | null
          external_order_id: string | null
          external_status: string | null
          followup_date: string | null
          id: string
          installments: number | null
          is_reseller: boolean
          is_split_payment: boolean
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_status: string | null
          payment_terms: string | null
          proposal_validity: string | null
          public_token: string | null
          quote_date: string | null
          quote_number: string
          rejected_at: string | null
          salesperson: string | null
          salesperson_id: string | null
          shipping_address: string | null
          shipping_address_number: string | null
          shipping_cep: string | null
          shipping_city: string | null
          shipping_complement: string | null
          shipping_cost: number | null
          shipping_deadline: string | null
          shipping_method: string | null
          shipping_neighborhood: string | null
          shipping_notes: string | null
          shipping_phone: string | null
          shipping_recipient: string | null
          shipping_state: string | null
          source: string | null
          split_date_1: string | null
          split_date_2: string | null
          split_installments_1: number | null
          split_installments_2: number | null
          split_method_1: string | null
          split_method_2: string | null
          split_value_1: number | null
          split_value_2: number | null
          status: string | null
          total: number | null
          total_amount: number | null
          updated_at: string | null
          use_alt_shipping_address: boolean
        }
        Insert: {
          approved_at?: string | null
          client_id?: string | null
          client_name?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount?: number | null
          external_order_id?: string | null
          external_status?: string | null
          followup_date?: string | null
          id?: string
          installments?: number | null
          is_reseller?: boolean
          is_split_payment?: boolean
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          proposal_validity?: string | null
          public_token?: string | null
          quote_date?: string | null
          quote_number?: string
          rejected_at?: string | null
          salesperson?: string | null
          salesperson_id?: string | null
          shipping_address?: string | null
          shipping_address_number?: string | null
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_cost?: number | null
          shipping_deadline?: string | null
          shipping_method?: string | null
          shipping_neighborhood?: string | null
          shipping_notes?: string | null
          shipping_phone?: string | null
          shipping_recipient?: string | null
          shipping_state?: string | null
          source?: string | null
          split_date_1?: string | null
          split_date_2?: string | null
          split_installments_1?: number | null
          split_installments_2?: number | null
          split_method_1?: string | null
          split_method_2?: string | null
          split_value_1?: number | null
          split_value_2?: number | null
          status?: string | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string | null
          use_alt_shipping_address?: boolean
        }
        Update: {
          approved_at?: string | null
          client_id?: string | null
          client_name?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount?: number | null
          external_order_id?: string | null
          external_status?: string | null
          followup_date?: string | null
          id?: string
          installments?: number | null
          is_reseller?: boolean
          is_split_payment?: boolean
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          proposal_validity?: string | null
          public_token?: string | null
          quote_date?: string | null
          quote_number?: string
          rejected_at?: string | null
          salesperson?: string | null
          salesperson_id?: string | null
          shipping_address?: string | null
          shipping_address_number?: string | null
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_cost?: number | null
          shipping_deadline?: string | null
          shipping_method?: string | null
          shipping_neighborhood?: string | null
          shipping_notes?: string | null
          shipping_phone?: string | null
          shipping_recipient?: string | null
          shipping_state?: string | null
          source?: string | null
          split_date_1?: string | null
          split_date_2?: string | null
          split_installments_1?: number | null
          split_installments_2?: number | null
          split_method_1?: string | null
          split_method_2?: string | null
          split_value_1?: number | null
          split_value_2?: number | null
          status?: string | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string | null
          use_alt_shipping_address?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      salespeople: {
        Row: {
          active: boolean | null
          code: number | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          active?: boolean | null
          code?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          active?: boolean | null
          code?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      smart_opportunities: {
        Row: {
          cliente_id: string | null
          company_id: string | null
          created_at: string | null
          id: string
          motivo: string | null
          prioridade: string | null
          produto_base: string | null
          produto_sugerido: string | null
          quote_id: string | null
          status: string
          tipo_oportunidade: string
          updated_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
          prioridade?: string | null
          produto_base?: string | null
          produto_sugerido?: string | null
          quote_id?: string | null
          status?: string
          tipo_oportunidade: string
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
          prioridade?: string | null
          produto_base?: string | null
          produto_sugerido?: string | null
          quote_id?: string | null
          status?: string
          tipo_oportunidade?: string
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_opportunities_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_opportunities_produto_base_fkey"
            columns: ["produto_base"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_opportunities_produto_sugerido_fkey"
            columns: ["produto_sugerido"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_opportunities_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_opportunities_vendedor_id_fkey_profiles"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tasks: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          quote_id: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          quote_id?: string | null
          status?: string
          task_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          quote_id?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_brands: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      technical_budgets: {
        Row: {
          client_id: string | null
          created_at: string | null
          created_by: string | null
          discount: number | null
          id: string
          notes: string | null
          status: string
          technical_order_id: string | null
          total_amount: number | null
          total_parts: number | null
          total_services: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          status?: string
          technical_order_id?: string | null
          total_amount?: number | null
          total_parts?: number | null
          total_services?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          status?: string
          technical_order_id?: string | null
          total_amount?: number | null
          total_parts?: number | null
          total_services?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "technical_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_budgets_technical_order_id_fkey"
            columns: ["technical_order_id"]
            isOneToOne: false
            referencedRelation: "technical_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_clients: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          document_type: string | null
          email: string | null
          equipments: Json | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          document_type?: string | null
          email?: string | null
          equipments?: Json | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          document_type?: string | null
          email?: string | null
          equipments?: Json | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      technical_cloud_files: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      technical_maintenances: {
        Row: {
          brand: string | null
          created_at: string
          description: string | null
          id: string
          model: string | null
          notes: string | null
          product_id: string | null
          status: string | null
          technician: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          product_id?: string | null
          status?: string | null
          technician?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          product_id?: string | null
          status?: string | null
          technician?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_maintenances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "technical_products"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_orders: {
        Row: {
          attachments: Json | null
          brand: string | null
          client_id: string | null
          client_name: string
          company_id: string | null
          created_at: string
          created_by: string | null
          entry_date: string | null
          equipment: string | null
          estimated_date: string | null
          exit_date: string | null
          id: string
          labor_value: number
          model: string | null
          os_number: string
          os_type: string | null
          parts_value: number
          photos: Json | null
          public_token: string | null
          reported_defect: string | null
          serial: string | null
          services_value: number | null
          shipping_value: number
          status: string
          technical_diagnosis: string | null
          technician_id: string | null
          technician_name: string | null
          technician_notes: string | null
          total_value: number
          updated_at: string
          warranty: string | null
        }
        Insert: {
          attachments?: Json | null
          brand?: string | null
          client_id?: string | null
          client_name?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string | null
          equipment?: string | null
          estimated_date?: string | null
          exit_date?: string | null
          id?: string
          labor_value?: number
          model?: string | null
          os_number?: string
          os_type?: string | null
          parts_value?: number
          photos?: Json | null
          public_token?: string | null
          reported_defect?: string | null
          serial?: string | null
          services_value?: number | null
          shipping_value?: number
          status?: string
          technical_diagnosis?: string | null
          technician_id?: string | null
          technician_name?: string | null
          technician_notes?: string | null
          total_value?: number
          updated_at?: string
          warranty?: string | null
        }
        Update: {
          attachments?: Json | null
          brand?: string | null
          client_id?: string | null
          client_name?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string | null
          equipment?: string | null
          estimated_date?: string | null
          exit_date?: string | null
          id?: string
          labor_value?: number
          model?: string | null
          os_number?: string
          os_type?: string | null
          parts_value?: number
          photos?: Json | null
          public_token?: string | null
          reported_defect?: string | null
          serial?: string | null
          services_value?: number | null
          shipping_value?: number
          status?: string
          technical_diagnosis?: string | null
          technician_id?: string | null
          technician_name?: string | null
          technician_notes?: string | null
          total_value?: number
          updated_at?: string
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "technical_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_products: {
        Row: {
          brand: string | null
          category: string | null
          code: string | null
          company_id: string | null
          compatibility: string | null
          cost: number
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          location: string | null
          manufacturer: string | null
          min_quantity: number
          name: string
          notes: string | null
          price: number
          quantity: number
          unit_measure: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          code?: string | null
          company_id?: string | null
          compatibility?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          manufacturer?: string | null
          min_quantity?: number
          name: string
          notes?: string | null
          price?: number
          quantity?: number
          unit_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          code?: string | null
          company_id?: string | null
          compatibility?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          manufacturer?: string | null
          min_quantity?: number
          name?: string
          notes?: string | null
          price?: number
          quantity?: number
          unit_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      technical_purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          purchase_order_id: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "technical_purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "technical_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "technical_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          expected_delivery: string | null
          id: string
          notes: string | null
          order_type: string | null
          purchase_date: string | null
          received_at: string | null
          status: string
          supplier_id: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_type?: string | null
          purchase_date?: string | null
          received_at?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_type?: string | null
          purchase_date?: string | null
          received_at?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "technical_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_services: {
        Row: {
          base_price: number | null
          category: string | null
          created_at: string | null
          description: string | null
          estimated_time: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          estimated_time?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          estimated_time?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      technical_status_history: {
        Row: {
          created_at: string
          id: string
          new_status: string
          notes: string | null
          order_id: string
          performed_by: string | null
          performed_by_name: string | null
          previous_status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          order_id: string
          performed_by?: string | null
          performed_by_name?: string | null
          previous_status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          order_id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "technical_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_suppliers: {
        Row: {
          address: string | null
          cnpj: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_approvals: {
        Row: {
          approved_by: string | null
          created_at: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_push_tokens: {
        Row: {
          browser: string | null
          company_id: string | null
          created_at: string
          device_type: string | null
          fcm_token: string
          id: string
          is_active: boolean | null
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          company_id?: string | null
          created_at?: string
          device_type?: string | null
          fcm_token: string
          id?: string
          is_active?: boolean | null
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          browser?: string | null
          company_id?: string | null
          created_at?: string
          device_type?: string | null
          fcm_token?: string
          id?: string
          is_active?: boolean | null
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_quote_cascade: { Args: { p_quote_id: string }; Returns: undefined }
      generate_quote_number: { Args: never; Returns: string }
      generate_technical_os_number: { Args: never; Returns: string }
      get_public_quote_token: { Args: never; Returns: string }
      get_team_dashboard_recent_quotes: {
        Args: { p_limit?: number; p_owner?: string }
        Returns: {
          client_name: string
          created_at: string
          created_by: string
          id: string
          payment_method: string
          payment_status: string
          quote_number: string
          shipping_cost: number
          status: string
          total_amount: number
        }[]
      }
      get_team_dashboard_sellers: {
        Args: never
        Returns: {
          approved_count: number
          clients_count: number
          full_name: string
          pending_count: number
          quotes_count: number
          rejected_count: number
          total_value: number
          user_id: string
        }[]
      }
      get_team_dashboard_top_clients: {
        Args: { p_limit?: number; p_owner?: string }
        Returns: {
          client_id: string
          client_name: string
          quotes_count: number
          total_value: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      is_financeiro: { Args: never; Returns: boolean }
      is_gestor: { Args: never; Returns: boolean }
      is_logistica: { Args: never; Returns: boolean }
      is_quote_owner: { Args: { p_quote_id: string }; Returns: boolean }
      is_support_any: { Args: never; Returns: boolean }
      is_support_manager: { Args: never; Returns: boolean }
      is_support_tech: { Args: never; Returns: boolean }
      process_all_approved_quotes_opportunities: {
        Args: never
        Returns: number
      }
      process_smart_opportunities_diagnostics: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
