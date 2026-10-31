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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          available_senders: Json
          corporate_mode: boolean
          default_from_email: string | null
          default_from_name: string | null
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available_senders?: Json
          corporate_mode?: boolean
          default_from_email?: string | null
          default_from_name?: string | null
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available_senders?: Json
          corporate_mode?: boolean
          default_from_email?: string | null
          default_from_name?: string | null
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          attempts: number
          bounced_at: string | null
          campaign_id: string
          click_count: number
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          email: string
          first_clicked_at: string | null
          id: string
          internal_click_count: number
          internal_first_clicked_at: string | null
          internal_open_count: number
          internal_opened_at: string | null
          last_error: string | null
          message_id: string | null
          next_attempt_at: string | null
          open_count: number
          opened_at: string | null
          provider_click_count: number
          provider_first_clicked_at: string | null
          provider_message: string | null
          provider_open_count: number
          provider_opened_at: string | null
          provider_response: Json | null
          provider_status_code: number | null
          queued_at: string | null
          rejected_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["recipient_status"]
          updated_at: string
          variables: Json
        }
        Insert: {
          attempts?: number
          bounced_at?: string | null
          campaign_id: string
          click_count?: number
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email: string
          first_clicked_at?: string | null
          id?: string
          internal_click_count?: number
          internal_first_clicked_at?: string | null
          internal_open_count?: number
          internal_opened_at?: string | null
          last_error?: string | null
          message_id?: string | null
          next_attempt_at?: string | null
          open_count?: number
          opened_at?: string | null
          provider_click_count?: number
          provider_first_clicked_at?: string | null
          provider_message?: string | null
          provider_open_count?: number
          provider_opened_at?: string | null
          provider_response?: Json | null
          provider_status_code?: number | null
          queued_at?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          updated_at?: string
          variables?: Json
        }
        Update: {
          attempts?: number
          bounced_at?: string | null
          campaign_id?: string
          click_count?: number
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string
          first_clicked_at?: string | null
          id?: string
          internal_click_count?: number
          internal_first_clicked_at?: string | null
          internal_open_count?: number
          internal_opened_at?: string | null
          last_error?: string | null
          message_id?: string | null
          next_attempt_at?: string | null
          open_count?: number
          opened_at?: string | null
          provider_click_count?: number
          provider_first_clicked_at?: string | null
          provider_message?: string | null
          provider_open_count?: number
          provider_opened_at?: string | null
          provider_response?: Json | null
          provider_status_code?: number | null
          queued_at?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          attachments: Json
          audience_summary: Json | null
          cancelled_at: string | null
          clicked_count: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          from_email: string | null
          from_name: string | null
          html_content: string
          id: string
          idempotency_key: string | null
          name: string
          opened_count: number
          paused_at: string | null
          scheduled_at: string | null
          sent_count: number
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string
          total_count: number
          updated_at: string
        }
        Insert: {
          attachments?: Json
          audience_summary?: Json | null
          cancelled_at?: string | null
          clicked_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          from_email?: string | null
          from_name?: string | null
          html_content: string
          id?: string
          idempotency_key?: string | null
          name: string
          opened_count?: number
          paused_at?: string | null
          scheduled_at?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          subject: string
          total_count?: number
          updated_at?: string
        }
        Update: {
          attachments?: Json
          audience_summary?: Json | null
          cancelled_at?: string | null
          clicked_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          from_email?: string | null
          from_name?: string | null
          html_content?: string
          id?: string
          idempotency_key?: string | null
          name?: string
          opened_count?: number
          paused_at?: string | null
          scheduled_at?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string
          total_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          bounce_count: number
          category: string
          created_at: string
          created_by: string | null
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          last_engaged_at: string | null
          last_name: string | null
          mobile: string | null
          previous_category: string | null
          registration_code: string | null
          source: string | null
          status: string
          suppressed_until: string | null
          suppression_kind: string | null
          suppression_reason: string | null
          unsubscribed_at: string | null
          updated_at: string
          workspace_sender: string
        }
        Insert: {
          bounce_count?: number
          category?: string
          created_at?: string
          created_by?: string | null
          email: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_engaged_at?: string | null
          last_name?: string | null
          mobile?: string | null
          previous_category?: string | null
          registration_code?: string | null
          source?: string | null
          status?: string
          suppressed_until?: string | null
          suppression_kind?: string | null
          suppression_reason?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          workspace_sender?: string
        }
        Update: {
          bounce_count?: number
          category?: string
          created_at?: string
          created_by?: string | null
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_engaged_at?: string | null
          last_name?: string | null
          mobile?: string | null
          previous_category?: string | null
          registration_code?: string | null
          source?: string | null
          status?: string
          suppressed_until?: string | null
          suppression_kind?: string | null
          suppression_reason?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          workspace_sender?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_key: string | null
          event_type: string
          id: number
          ip_hash: string | null
          provider_payload: Json | null
          recipient_id: string
          source: string
          target_url: string | null
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_key?: string | null
          event_type: string
          id?: never
          ip_hash?: string | null
          provider_payload?: Json | null
          recipient_id: string
          source?: string
          target_url?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_key?: string | null
          event_type?: string
          id?: never
          ip_hash?: string | null
          provider_payload?: Json | null
          recipient_id?: string
          source?: string
          target_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      mailketing_webhook_config: {
        Row: {
          active: boolean
          id: boolean
          last_event_at: string | null
          secret_hash: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          id?: boolean
          last_event_at?: string | null
          secret_hash: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          id?: boolean
          last_event_at?: string | null
          secret_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          created_at: string
          created_by: string
          id: string
          mime_type: string
          name: string
          public_url: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          mime_type: string
          name: string
          public_url: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          mime_type?: string
          name?: string
          public_url?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      queue_worker_config: {
        Row: {
          active: boolean
          batch_size: number
          id: boolean
          last_completed_at: string | null
          last_error: string | null
          last_processed: number
          last_started_at: string | null
          max_attempts: number
          secret_hash: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          batch_size?: number
          id?: boolean
          last_completed_at?: string | null
          last_error?: string | null
          last_processed?: number
          last_started_at?: string | null
          max_attempts?: number
          secret_hash: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          batch_size?: number
          id?: boolean
          last_completed_at?: string | null
          last_error?: string | null
          last_processed?: number
          last_started_at?: string | null
          max_attempts?: number
          secret_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      queue_worker_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          failed_count: number
          id: number
          processed_count: number
          retry_count: number
          sent_count: number
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          failed_count?: number
          id?: never
          processed_count?: number
          retry_count?: number
          sent_count?: number
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          failed_count?: number
          id?: never
          processed_count?: number
          retry_count?: number
          sent_count?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      suppressions: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string | null
          id: string
          kind: string
          reason: string
          source: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string | null
          id?: string
          kind?: string
          reason?: string
          source?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          kind?: string
          reason?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppressions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          created_at: string
          created_by: string
          html_content: string
          id: number
          name: string
          subject: string
          template_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          html_content: string
          id?: never
          name: string
          subject: string
          template_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          html_content?: string
          id?: never
          name?: string
          subject?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          html_content: string
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          html_content: string
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          html_content?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_daily_email_stats: {
        Args: { p_days?: number }
        Returns: {
          bounced: number
          clicked: number
          day: string
          delivered: number
          failed: number
          opened: number
          rejected: number
          sent: number
        }[]
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      read_mailketing_token: { Args: never; Returns: string }
      set_safar_staff_role: {
        Args: { p_actor: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      store_mailketing_token: {
        Args: { p_token: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      campaign_status:
        | "draft"
        | "scheduled"
        | "processing"
        | "paused"
        | "completed"
        | "partial"
        | "failed"
        | "cancelled"
      recipient_status:
        | "pending"
        | "processing"
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "bounced"
        | "rejected"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      campaign_status: [
        "draft",
        "scheduled",
        "processing",
        "paused",
        "completed",
        "partial",
        "failed",
        "cancelled",
      ],
      recipient_status: [
        "pending",
        "processing",
        "queued",
        "sent",
        "delivered",
        "failed",
        "bounced",
        "rejected",
        "cancelled",
      ],
    },
  },
} as const
