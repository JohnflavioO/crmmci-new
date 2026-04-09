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
      clients: {
        Row: {
          address: string | null
          address_number: string | null
          cep: string | null
          city: string | null
          company: string | null
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
          company?: string | null
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
          company?: string | null
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
          nf_data: string | null
          nf_numero: string | null
          observacao_logistica: string | null
          quote_id: string
          transportadora: string | null
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
          nf_data?: string | null
          nf_numero?: string | null
          observacao_logistica?: string | null
          quote_id: string
          transportadora?: string | null
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
          nf_data?: string | null
          nf_numero?: string | null
          observacao_logistica?: string | null
          quote_id?: string
          transportadora?: string | null
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
      products: {
        Row: {
          brand: string | null
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number | null
          sku: string | null
        }
        Insert: {
          brand?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number | null
          sku?: string | null
        }
        Update: {
          brand?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
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
          commercial_visible: boolean
          created_at: string | null
          deleted_at: string | null
          full_name: string
          id: string
          phone: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          commercial_visible?: boolean
          created_at?: string | null
          deleted_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          commercial_visible?: boolean
          created_at?: string | null
          deleted_at?: string | null
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
      quotes: {
        Row: {
          approved_at: string | null
          client_id: string | null
          client_name: string
          created_at: string | null
          created_by: string | null
          discount: number | null
          external_order_id: string | null
          external_status: string | null
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
          shipping_cost: number | null
          shipping_deadline: string | null
          shipping_method: string | null
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
        }
        Insert: {
          approved_at?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          discount?: number | null
          external_order_id?: string | null
          external_status?: string | null
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
          shipping_cost?: number | null
          shipping_deadline?: string | null
          shipping_method?: string | null
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
        }
        Update: {
          approved_at?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          discount?: number | null
          external_order_id?: string | null
          external_status?: string | null
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
          shipping_cost?: number | null
          shipping_deadline?: string | null
          shipping_method?: string | null
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
      get_public_quote_token: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      is_financeiro: { Args: never; Returns: boolean }
      is_gestor: { Args: never; Returns: boolean }
      is_logistica: { Args: never; Returns: boolean }
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
