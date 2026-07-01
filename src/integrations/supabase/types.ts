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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          plan: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id: string
          plan?: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          plan?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_memberships: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["agency_role"]
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["agency_role"]
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["agency_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_memberships_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          ends_at: string
          external_id: string | null
          id: string
          location: string | null
          owner_user_id: string
          starts_at: string
          sub_account_id: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          ends_at: string
          external_id?: string | null
          id?: string
          location?: string | null
          owner_user_id: string
          starts_at: string
          sub_account_id: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          ends_at?: string
          external_id?: string | null
          id?: string
          location?: string | null
          owner_user_id?: string
          starts_at?: string
          sub_account_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_files: {
        Row: {
          contact_id: string
          content_type: string | null
          created_at: string
          id: string
          name: string
          size: number
          storage_path: string
          sub_account_id: string
          uploaded_by: string
        }
        Insert: {
          contact_id: string
          content_type?: string | null
          created_at?: string
          id?: string
          name: string
          size?: number
          storage_path: string
          sub_account_id: string
          uploaded_by: string
        }
        Update: {
          contact_id?: string
          content_type?: string | null
          created_at?: string
          id?: string
          name?: string
          size?: number
          storage_path?: string
          sub_account_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_files_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_files_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          owner_id: string
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          owner_id: string
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          owner_id?: string
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_views_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lead_source: string | null
          lifecycle_stage: Database["public"]["Enums"]["contact_lifecycle_stage"]
          notes: string | null
          owner_id: string
          phone: string | null
          sub_account_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["contact_lifecycle_stage"]
          notes?: string | null
          owner_id: string
          phone?: string | null
          sub_account_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["contact_lifecycle_stage"]
          notes?: string | null
          owner_id?: string
          phone?: string | null
          sub_account_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          last_message_at: string | null
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_files: {
        Row: {
          content_type: string | null
          created_at: string
          deal_id: string
          id: string
          name: string
          size: number
          storage_path: string
          sub_account_id: string
          uploaded_by: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          deal_id: string
          id?: string
          name: string
          size?: number
          storage_path: string
          sub_account_id: string
          uploaded_by: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          name?: string
          size?: number
          storage_path?: string
          sub_account_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          contact_id: string | null
          created_at: string
          currency: string
          expected_close_date: string | null
          id: string
          notes: string | null
          owner_id: string
          pipeline_id: string
          position: number
          stage_id: string
          sub_account_id: string
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          pipeline_id: string
          position?: number
          stage_id: string
          sub_account_id: string
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          pipeline_id?: string
          position?: number
          stage_id?: string
          sub_account_id?: string
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          agency_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          sub_account_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          agency_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: string
          sub_account_id?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          agency_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          sub_account_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_user_id: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          sub_account_id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          sub_account_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          sub_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          sub_account_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          sub_account_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          sub_account_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          owner_id: string
          pipeline_id: string
          position: number
          sub_account_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          pipeline_id: string
          position?: number
          sub_account_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          pipeline_id?: string
          position?: number
          sub_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sub_account_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["sub_account_role"]
          sub_account_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["sub_account_role"]
          sub_account_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["sub_account_role"]
          sub_account_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_account_memberships_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_accounts: {
        Row: {
          agency_id: string
          archived_at: string | null
          created_at: string
          id: string
          industry: string | null
          name: string
          slug: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          archived_at?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          slug?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          archived_at?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          slug?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_accounts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          sub_account_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          sub_account_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          sub_account_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_runs: {
        Row: {
          error: string | null
          id: string
          payload: Json | null
          ran_at: string
          status: string
          sub_account_id: string
          trigger_row_id: string | null
          workflow_id: string
        }
        Insert: {
          error?: string | null
          id?: string
          payload?: Json | null
          ran_at?: string
          status?: string
          sub_account_id: string
          trigger_row_id?: string | null
          workflow_id: string
        }
        Update: {
          error?: string | null
          id?: string
          payload?: Json | null
          ran_at?: string
          status?: string
          sub_account_id?: string
          trigger_row_id?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          actions: Json
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          name: string
          sub_account_id: string
          trigger_config: Json
          trigger_type: Database["public"]["Enums"]["workflow_trigger"]
          updated_at: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          name: string
          sub_account_id: string
          trigger_config?: Json
          trigger_type: Database["public"]["Enums"]["workflow_trigger"]
          updated_at?: string
        }
        Update: {
          actions?: Json
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          name?: string
          sub_account_id?: string
          trigger_config?: Json
          trigger_type?: Database["public"]["Enums"]["workflow_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { _token: string }
        Returns: {
          agency_id: string
          role: string
          sub_account_id: string
        }[]
      }
      has_agency_access: {
        Args: { _agency: string; _user: string }
        Returns: boolean
      }
      has_agency_role: {
        Args: {
          _agency: string
          _role: Database["public"]["Enums"]["agency_role"]
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_subaccount_access: {
        Args: { _sub: string; _user: string }
        Returns: boolean
      }
      list_agency_members: {
        Args: { _agency: string }
        Returns: {
          avatar_url: string
          full_name: string
          role: string
          scope: string
          sub_account_id: string
          sub_account_name: string
          user_id: string
        }[]
      }
      preview_invitation: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          agency_id: string
          agency_name: string
          email: string
          expires_at: string
          role: string
          sub_account_id: string
          sub_account_name: string
        }[]
      }
      run_workflows: {
        Args: {
          _payload: Json
          _row_id: string
          _sub: string
          _trigger: Database["public"]["Enums"]["workflow_trigger"]
        }
        Returns: undefined
      }
    }
    Enums: {
      agency_role: "owner" | "admin"
      app_role: "admin" | "user"
      contact_lifecycle_stage: "lead" | "mql" | "sql" | "customer" | "lost"
      message_kind: "note" | "email_log" | "sms_log"
      sub_account_role: "member" | "client"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "open" | "in_progress" | "done" | "cancelled"
      workflow_trigger:
        | "contact.created"
        | "contact.stage_changed"
        | "deal.stage_changed"
        | "task.completed"
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
      agency_role: ["owner", "admin"],
      app_role: ["admin", "user"],
      contact_lifecycle_stage: ["lead", "mql", "sql", "customer", "lost"],
      message_kind: ["note", "email_log", "sms_log"],
      sub_account_role: ["member", "client"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["open", "in_progress", "done", "cancelled"],
      workflow_trigger: [
        "contact.created",
        "contact.stage_changed",
        "deal.stage_changed",
        "task.completed",
      ],
    },
  },
} as const
