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
      ad_campaigns: {
        Row: {
          budget: number | null
          clicks: number | null
          conversions: number | null
          created_at: string
          created_by: string
          end_date: string | null
          external_id: string | null
          id: string
          impressions: number | null
          name: string
          notes: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          spend: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["ad_campaign_status"]
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          created_by: string
          end_date?: string | null
          external_id?: string | null
          id?: string
          impressions?: number | null
          name: string
          notes?: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          spend?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["ad_campaign_status"]
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          external_id?: string | null
          id?: string
          impressions?: number | null
          name?: string
          notes?: string | null
          platform?: Database["public"]["Enums"]["ad_platform"]
          spend?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["ad_campaign_status"]
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_platform_connections: {
        Row: {
          accessible_customers: Json
          account_name: string | null
          connected_by: string
          created_at: string
          external_customer_id: string | null
          id: string
          last_sync_error: string | null
          last_synced_at: string | null
          platform: string
          refresh_token: string
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          accessible_customers?: Json
          account_name?: string | null
          connected_by: string
          created_at?: string
          external_customer_id?: string | null
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          platform: string
          refresh_token: string
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          accessible_customers?: Json
          account_name?: string | null
          connected_by?: string
          created_at?: string
          external_customer_id?: string | null
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          platform?: string
          refresh_token?: string
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_platform_connections_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_spend_daily: {
        Row: {
          campaign_name: string | null
          clicks: number
          created_at: string
          created_by: string | null
          currency: string
          entry_source: string
          external_campaign_id: string | null
          id: string
          impressions: number
          leads: number
          platform: Database["public"]["Enums"]["ad_platform"]
          spend: number
          spend_date: string
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          campaign_name?: string | null
          clicks?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_source?: string
          external_campaign_id?: string | null
          id?: string
          impressions?: number
          leads?: number
          platform: Database["public"]["Enums"]["ad_platform"]
          spend?: number
          spend_date: string
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          campaign_name?: string | null
          clicks?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_source?: string
          external_campaign_id?: string | null
          id?: string
          impressions?: number
          leads?: number
          platform?: Database["public"]["Enums"]["ad_platform"]
          spend?: number
          spend_date?: string
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_daily_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      agency_module_presets: {
        Row: {
          agency_id: string
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_module_presets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_settings: {
        Row: {
          booking_page_id: string | null
          business_info: string
          created_at: string
          enabled: boolean
          extra_instructions: string
          id: string
          offer_booking_link: boolean
          signature: string
          sub_account_id: string
          suggest_escalation: boolean
          tone: string
          updated_at: string
          use_contact_context: boolean
          use_deal_context: boolean
        }
        Insert: {
          booking_page_id?: string | null
          business_info?: string
          created_at?: string
          enabled?: boolean
          extra_instructions?: string
          id?: string
          offer_booking_link?: boolean
          signature?: string
          sub_account_id: string
          suggest_escalation?: boolean
          tone?: string
          updated_at?: string
          use_contact_context?: boolean
          use_deal_context?: boolean
        }
        Update: {
          booking_page_id?: string | null
          business_info?: string
          created_at?: string
          enabled?: boolean
          extra_instructions?: string
          id?: string
          offer_booking_link?: boolean
          signature?: string
          sub_account_id?: string
          suggest_escalation?: boolean
          tone?: string
          updated_at?: string
          use_contact_context?: boolean
          use_deal_context?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_settings_booking_page_id_fkey"
            columns: ["booking_page_id"]
            isOneToOne: false
            referencedRelation: "booking_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_settings_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: true
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_draft_feedback: {
        Row: {
          channel: string | null
          conversation_id: string | null
          created_at: string
          draft: string
          id: string
          note: string
          rating: string
          sub_account_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          conversation_id?: string | null
          created_at?: string
          draft?: string
          id?: string
          note?: string
          rating: string
          sub_account_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          conversation_id?: string | null
          created_at?: string
          draft?: string
          id?: string
          note?: string
          rating?: string
          sub_account_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_draft_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_draft_feedback_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_docs: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          source_name: string | null
          sub_account_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          source_name?: string | null
          sub_account_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          source_name?: string | null
          sub_account_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_docs_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_connections: {
        Row: {
          account_email: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointment_audit: {
        Row: {
          action: string
          actor_label: string | null
          actor_user_id: string | null
          booking_page_id: string | null
          channel: string | null
          contact_id: string | null
          created_at: string
          detail: string | null
          event_id: string | null
          id: string
          metadata: Json
          sub_account_id: string
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_user_id?: string | null
          booking_page_id?: string | null
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          detail?: string | null
          event_id?: string | null
          id?: string
          metadata?: Json
          sub_account_id: string
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_user_id?: string | null
          booking_page_id?: string | null
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          detail?: string | null
          event_id?: string | null
          id?: string
          metadata?: Json
          sub_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_audit_booking_page_id_fkey"
            columns: ["booking_page_id"]
            isOneToOne: false
            referencedRelation: "booking_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_audit_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_audit_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          error: string | null
          event_id: string
          id: string
          offset_minutes: number
          outbound_message_id: string | null
          scheduled_for: string
          status: string
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error?: string | null
          event_id: string
          id?: string
          offset_minutes: number
          outbound_message_id?: string | null
          scheduled_for: string
          status?: string
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error?: string | null
          event_id?: string
          id?: string
          offset_minutes?: number
          outbound_message_id?: string | null
          scheduled_for?: string
          status?: string
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminders_outbound_message_id_fkey"
            columns: ["outbound_message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminders_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_reconcile_state: {
        Row: {
          consecutive_rate_limits: number
          created_at: string
          id: string
          last_result: Json
          last_run_at: string | null
          lease_until: string | null
          paused_reason: string | null
          paused_until: string | null
          updated_at: string
        }
        Insert: {
          consecutive_rate_limits?: number
          created_at?: string
          id?: string
          last_result?: Json
          last_run_at?: string | null
          lease_until?: string | null
          paused_reason?: string | null
          paused_until?: string | null
          updated_at?: string
        }
        Update: {
          consecutive_rate_limits?: number
          created_at?: string
          id?: string
          last_result?: Json
          last_run_at?: string | null
          lease_until?: string | null
          paused_reason?: string | null
          paused_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      booking_pages: {
        Row: {
          advance_days: number
          allow_reschedule: boolean
          availability: Json
          buffer_minutes: number
          confirmation_enabled: boolean
          created_at: string
          description: string | null
          duration_minutes: number
          enabled: boolean
          id: string
          min_notice_minutes: number
          name: string
          owner_user_id: string
          reminder_channel: string
          reminder_in_app: boolean
          reminder_offsets: number[]
          reminder_template: string | null
          slug: string
          sub_account_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          advance_days?: number
          allow_reschedule?: boolean
          availability?: Json
          buffer_minutes?: number
          confirmation_enabled?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          enabled?: boolean
          id?: string
          min_notice_minutes?: number
          name: string
          owner_user_id: string
          reminder_channel?: string
          reminder_in_app?: boolean
          reminder_offsets?: number[]
          reminder_template?: string | null
          slug: string
          sub_account_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          advance_days?: number
          allow_reschedule?: boolean
          availability?: Json
          buffer_minutes?: number
          confirmation_enabled?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          enabled?: boolean
          id?: string
          min_notice_minutes?: number
          name?: string
          owner_user_id?: string
          reminder_channel?: string
          reminder_in_app?: boolean
          reminder_offsets?: number[]
          reminder_template?: string | null
          slug?: string
          sub_account_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_pages_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          attendee_email: string | null
          attendee_phone: string | null
          booking_page_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          ends_at: string
          external_id: string | null
          id: string
          location: string | null
          original_starts_at: string | null
          owner_user_id: string
          reschedule_token: string | null
          rescheduled_at: string | null
          starts_at: string
          status: string
          sub_account_id: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          attendee_email?: string | null
          attendee_phone?: string | null
          booking_page_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          ends_at: string
          external_id?: string | null
          id?: string
          location?: string | null
          original_starts_at?: string | null
          owner_user_id: string
          reschedule_token?: string | null
          rescheduled_at?: string | null
          starts_at: string
          status?: string
          sub_account_id: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          attendee_email?: string | null
          attendee_phone?: string | null
          booking_page_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          ends_at?: string
          external_id?: string | null
          id?: string
          location?: string | null
          original_starts_at?: string | null
          owner_user_id?: string
          reschedule_token?: string | null
          rescheduled_at?: string | null
          starts_at?: string
          status?: string
          sub_account_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_booking_page_id_fkey"
            columns: ["booking_page_id"]
            isOneToOne: false
            referencedRelation: "booking_pages"
            referencedColumns: ["id"]
          },
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
      campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string
          error: string | null
          id: string
          outbound_message_id: string | null
          status: string
          sub_account_id: string
          to_address: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          outbound_message_id?: string | null
          status?: string
          sub_account_id: string
          to_address: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          outbound_message_id?: string | null
          status?: string
          sub_account_id?: string
          to_address?: string
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
          {
            foreignKeyName: "campaign_recipients_outbound_message_id_fkey"
            columns: ["outbound_message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["template_channel"]
          created_at: string
          created_by: string
          failed_count: number
          id: string
          name: string
          scheduled_at: string | null
          segment: Json
          sent_at: string | null
          sent_count: number
          status: Database["public"]["Enums"]["campaign_status"]
          sub_account_id: string
          subject: string | null
          template_id: string | null
          total_recipients: number
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          channel: Database["public"]["Enums"]["template_channel"]
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          name: string
          scheduled_at?: string | null
          segment?: Json
          sent_at?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          sub_account_id: string
          subject?: string | null
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          channel?: Database["public"]["Enums"]["template_channel"]
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          name?: string
          scheduled_at?: string | null
          segment?: Json
          sent_at?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          sub_account_id?: string
          subject?: string | null
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
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
      contact_touches: {
        Row: {
          campaign: string | null
          click_id: string | null
          contact_id: string
          content: string | null
          created_at: string
          external_campaign_id: string | null
          id: string
          kind: string
          landing_page: string | null
          medium: string | null
          occurred_at: string
          platform: string | null
          referrer: string | null
          source: string
          sub_account_id: string
          term: string | null
        }
        Insert: {
          campaign?: string | null
          click_id?: string | null
          contact_id: string
          content?: string | null
          created_at?: string
          external_campaign_id?: string | null
          id?: string
          kind?: string
          landing_page?: string | null
          medium?: string | null
          occurred_at?: string
          platform?: string | null
          referrer?: string | null
          source?: string
          sub_account_id: string
          term?: string | null
        }
        Update: {
          campaign?: string | null
          click_id?: string | null
          contact_id?: string
          content?: string | null
          created_at?: string
          external_campaign_id?: string | null
          id?: string
          kind?: string
          landing_page?: string | null
          medium?: string | null
          occurred_at?: string
          platform?: string | null
          referrer?: string | null
          source?: string
          sub_account_id?: string
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_touches_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_touches_sub_account_id_fkey"
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
          custom_fields: Json
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lead_source: string | null
          lifecycle_stage: Database["public"]["Enums"]["contact_lifecycle_stage"]
          meta_lead_id: string | null
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
          custom_fields?: Json
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["contact_lifecycle_stage"]
          meta_lead_id?: string | null
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
          custom_fields?: Json
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["contact_lifecycle_stage"]
          meta_lead_id?: string | null
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
          assigned_to_user_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          contact_id: string
          created_at: string
          external_thread_id: string | null
          id: string
          last_message_at: string | null
          last_read_at: string | null
          priority: boolean
          snoozed_until: string | null
          status: string
          sub_account_id: string
          twilio_number_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
          last_read_at?: string | null
          priority?: boolean
          snoozed_until?: string | null
          status?: string
          sub_account_id: string
          twilio_number_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id?: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
          last_read_at?: string | null
          priority?: boolean
          snoozed_until?: string | null
          status?: string
          sub_account_id?: string
          twilio_number_id?: string | null
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
          {
            foreignKeyName: "conversations_twilio_number_id_fkey"
            columns: ["twilio_number_id"]
            isOneToOne: false
            referencedRelation: "twilio_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_defs: {
        Row: {
          created_at: string
          entity: string
          field_type: string
          id: string
          key: string
          label: string
          options: Json
          position: number
          required: boolean
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity?: string
          field_type?: string
          id?: string
          key: string
          label: string
          options?: Json
          position?: number
          required?: boolean
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          field_type?: string
          id?: string
          key?: string
          label?: string
          options?: Json
          position?: number
          required?: boolean
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_defs_sub_account_id_fkey"
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
          custom_fields: Json
          deleted_at: string | null
          deleted_by: string | null
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
          custom_fields?: Json
          deleted_at?: string | null
          deleted_by?: string | null
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
          custom_fields?: Json
          deleted_at?: string | null
          deleted_by?: string | null
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
      form_submissions: {
        Row: {
          contact_id: string | null
          created_at: string
          form_id: string
          id: string
          ip_hash: string | null
          payload: Json
          source_url: string | null
          sub_account_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          form_id: string
          id?: string
          ip_hash?: string | null
          payload?: Json
          source_url?: string | null
          sub_account_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          form_id?: string
          id?: string
          ip_hash?: string | null
          payload?: Json
          source_url?: string | null
          sub_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "lead_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarded_mailboxes: {
        Row: {
          active: boolean
          address: string
          created_at: string
          display_name: string | null
          id: string
          inbound_token: string
          last_received_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address: string
          created_at?: string
          display_name?: string | null
          id?: string
          inbound_token: string
          last_received_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address?: string
          created_at?: string
          display_name?: string | null
          id?: string
          inbound_token?: string
          last_received_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forwarded_messages: {
        Row: {
          attachments: Json
          body_html: string | null
          body_text: string | null
          cc_address: string
          created_at: string
          direction: string
          folder: string
          from_address: string
          from_name: string
          id: string
          in_reply_to: string | null
          mailbox_id: string
          provider_message_id: string | null
          received_at: string
          snippet: string
          starred: boolean
          subject: string
          thread_key: string
          to_address: string
          unread: boolean
          user_id: string
        }
        Insert: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          cc_address?: string
          created_at?: string
          direction?: string
          folder?: string
          from_address?: string
          from_name?: string
          id?: string
          in_reply_to?: string | null
          mailbox_id: string
          provider_message_id?: string | null
          received_at?: string
          snippet?: string
          starred?: boolean
          subject?: string
          thread_key?: string
          to_address?: string
          unread?: boolean
          user_id: string
        }
        Update: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          cc_address?: string
          created_at?: string
          direction?: string
          folder?: string
          from_address?: string
          from_name?: string
          id?: string
          in_reply_to?: string | null
          mailbox_id?: string
          provider_message_id?: string | null
          received_at?: string
          snippet?: string
          starred?: boolean
          subject?: string
          thread_key?: string
          to_address?: string
          unread?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forwarded_messages_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "forwarded_mailboxes"
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
      invoice_branding: {
        Row: {
          accent_color: string
          address: string | null
          business_name: string | null
          created_at: string
          footer_note: string | null
          logo_url: string | null
          payment_instructions: string | null
          sub_account_id: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          address?: string | null
          business_name?: string | null
          created_at?: string
          footer_note?: string | null
          logo_url?: string | null
          payment_instructions?: string | null
          sub_account_id: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          address?: string | null
          business_name?: string | null
          created_at?: string
          footer_note?: string | null
          logo_url?: string | null
          payment_instructions?: string | null
          sub_account_id?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_branding_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: true
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_events: {
        Row: {
          actor: string | null
          created_at: string
          detail: Json
          id: string
          invoice_id: string
          sub_account_id: string
          type: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: Json
          id?: string
          invoice_id: string
          sub_account_id: string
          type: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: Json
          id?: string
          invoice_id?: string
          sub_account_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_events_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          position: number
          quantity: number
          sub_account_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          invoice_id: string
          position?: number
          quantity?: number
          sub_account_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number
          sub_account_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_reminders: {
        Row: {
          created_at: string
          error: string | null
          id: string
          invoice_id: string
          outbound_message_id: string | null
          scheduled_at: string
          sent_at: string | null
          sequence: number
          status: string
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          invoice_id: string
          outbound_message_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          sequence?: number
          status?: string
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          invoice_id?: string
          outbound_message_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          sequence?: number
          status?: string
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_reminders_outbound_message_id_fkey"
            columns: ["outbound_message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_reminders_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_renders: {
        Row: {
          branding_snapshot: Json
          created_at: string
          created_by: string | null
          html: string
          id: string
          invoice_id: string
          invoice_snapshot: Json
          reminder_sequence: number | null
          source: string
          sub_account_id: string
          template_id: string | null
          template_name: string | null
          template_version: number | null
        }
        Insert: {
          branding_snapshot?: Json
          created_at?: string
          created_by?: string | null
          html: string
          id?: string
          invoice_id: string
          invoice_snapshot?: Json
          reminder_sequence?: number | null
          source?: string
          sub_account_id: string
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
        }
        Update: {
          branding_snapshot?: Json
          created_at?: string
          created_by?: string | null
          html?: string
          id?: string
          invoice_id?: string
          invoice_snapshot?: Json
          reminder_sequence?: number | null
          source?: string
          sub_account_id?: string
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_renders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_renders_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_renders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_template_audit: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          detail: Json
          id: string
          sub_account_id: string
          template_id: string | null
          template_name: string | null
          template_version: number | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          detail?: Json
          id?: string
          sub_account_id: string
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          detail?: Json
          id?: string
          sub_account_id?: string
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_template_audit_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_template_audit_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          accent_color: string
          address: string | null
          archived_at: string | null
          business_name: string | null
          created_at: string
          created_by: string | null
          footer_note: string | null
          id: string
          is_default: boolean
          logo_url: string | null
          name: string
          payment_instructions: string | null
          sub_account_id: string
          terms: string | null
          updated_at: string
          version: number
        }
        Insert: {
          accent_color?: string
          address?: string | null
          archived_at?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string | null
          footer_note?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name: string
          payment_instructions?: string | null
          sub_account_id: string
          terms?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          accent_color?: string
          address?: string | null
          archived_at?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string | null
          footer_note?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name?: string
          payment_instructions?: string | null
          sub_account_id?: string
          terms?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          id: string
          issue_date: string
          last_sent_at: string | null
          max_reminders: number
          notes: string | null
          number: string
          paid_at: string | null
          reminder_interval_days: number
          reminders_enabled: boolean
          status: Database["public"]["Enums"]["invoice_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link_id: string | null
          stripe_payment_link_url: string | null
          sub_account_id: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          template_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string
          last_sent_at?: string | null
          max_reminders?: number
          notes?: string | null
          number: string
          paid_at?: string | null
          reminder_interval_days?: number
          reminders_enabled?: boolean
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          sub_account_id: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          template_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string
          last_sent_at?: string | null
          max_reminders?: number
          notes?: string | null
          number?: string
          paid_at?: string | null
          reminder_interval_days?: number
          reminders_enabled?: boolean
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          sub_account_id?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          template_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_forms: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          fields: Json
          id: string
          name: string
          owner_id: string
          redirect_url: string | null
          slug: string
          sub_account_id: string
          success_message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          fields?: Json
          id?: string
          name: string
          owner_id: string
          redirect_url?: string | null
          slug: string
          sub_account_id: string
          success_message?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          fields?: Json
          id?: string
          name?: string
          owner_id?: string
          redirect_url?: string | null
          slug?: string
          sub_account_id?: string
          success_message?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_forms_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["template_channel"]
          created_at: string
          created_by: string
          id: string
          name: string
          sub_account_id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          channel: Database["public"]["Enums"]["template_channel"]
          created_at?: string
          created_by: string
          id?: string
          name: string
          sub_account_id: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          channel?: Database["public"]["Enums"]["template_channel"]
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          sub_account_id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_sub_account_id_fkey"
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
          channel: Database["public"]["Enums"]["message_channel"]
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error_message: string | null
          external_id: string | null
          from_number: string | null
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          media_urls: string[]
          sender_handle: string | null
          sub_account_id: string
          to_number: string | null
        }
        Insert: {
          author_user_id?: string | null
          body: string
          channel?: Database["public"]["Enums"]["message_channel"]
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          error_message?: string | null
          external_id?: string | null
          from_number?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          media_urls?: string[]
          sender_handle?: string | null
          sub_account_id: string
          to_number?: string | null
        }
        Update: {
          author_user_id?: string | null
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          error_message?: string | null
          external_id?: string | null
          from_number?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          media_urls?: string[]
          sender_handle?: string | null
          sub_account_id?: string
          to_number?: string | null
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
      meta_ad_accounts: {
        Row: {
          ad_account_id: string
          connection_id: string
          created_at: string
          currency: string | null
          id: string
          name: string | null
          sub_account_id: string
          timezone_name: string | null
          updated_at: string
          use_for_reports: boolean
        }
        Insert: {
          ad_account_id: string
          connection_id: string
          created_at?: string
          currency?: string | null
          id?: string
          name?: string | null
          sub_account_id: string
          timezone_name?: string | null
          updated_at?: string
          use_for_reports?: boolean
        }
        Update: {
          ad_account_id?: string
          connection_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          name?: string | null
          sub_account_id?: string
          timezone_name?: string | null
          updated_at?: string
          use_for_reports?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_accounts_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          access_token: string
          created_at: string
          created_by: string
          granted_scopes: string[]
          id: string
          meta_user_id: string
          meta_user_name: string | null
          sub_account_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          created_by: string
          granted_scopes?: string[]
          id?: string
          meta_user_id: string
          meta_user_name?: string | null
          sub_account_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          created_by?: string
          granted_scopes?: string[]
          id?: string
          meta_user_id?: string
          meta_user_name?: string | null
          sub_account_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_connections_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_deletion_requests: {
        Row: {
          confirmation_code: string
          created_at: string
          deleted_counts: Json
          id: string
          meta_user_id: string
          status: string
        }
        Insert: {
          confirmation_code: string
          created_at?: string
          deleted_counts?: Json
          id?: string
          meta_user_id: string
          status?: string
        }
        Update: {
          confirmation_code?: string
          created_at?: string
          deleted_counts?: Json
          id?: string
          meta_user_id?: string
          status?: string
        }
        Relationships: []
      }
      meta_lead_ad_events: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          error: string | null
          form_id: string | null
          form_name: string | null
          id: string
          is_test: boolean
          lead_fields: Json
          leadgen_id: string | null
          page_id: string | null
          payload: Json
          pipeline_id: string | null
          routing_source: string
          stage_id: string | null
          status: string
          sub_account_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          error?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          is_test?: boolean
          lead_fields?: Json
          leadgen_id?: string | null
          page_id?: string | null
          payload?: Json
          pipeline_id?: string | null
          routing_source?: string
          stage_id?: string | null
          status?: string
          sub_account_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          error?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          is_test?: boolean
          lead_fields?: Json
          leadgen_id?: string | null
          page_id?: string | null
          payload?: Json
          pipeline_id?: string | null
          routing_source?: string
          stage_id?: string | null
          status?: string
          sub_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_ad_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_lead_ad_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_lead_ad_events_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_lead_ad_events_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_lead_ad_events_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_form_routes: {
        Row: {
          created_at: string
          created_by: string | null
          form_id: string
          form_name: string | null
          id: string
          page_id: string | null
          pipeline_id: string
          stage_id: string
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_id: string
          form_name?: string | null
          id?: string
          page_id?: string | null
          pipeline_id: string
          stage_id: string
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_id?: string
          form_name?: string | null
          id?: string
          page_id?: string | null
          pipeline_id?: string
          stage_id?: string
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_form_routes_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_lead_form_routes_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_lead_form_routes_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          redirect_after: string | null
          state: string
          sub_account_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          redirect_after?: string | null
          state: string
          sub_account_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          redirect_after?: string | null
          state?: string
          sub_account_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_oauth_states_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pages: {
        Row: {
          category: string | null
          connection_id: string
          created_at: string
          id: string
          instagram_business_account_id: string | null
          page_access_token: string
          page_id: string
          page_name: string
          route_instagram_to_inbox: boolean
          route_messenger_to_inbox: boolean
          sub_account_id: string
          sync_lead_ads: boolean
          updated_at: string
          webhook_subscribed: boolean
        }
        Insert: {
          category?: string | null
          connection_id: string
          created_at?: string
          id?: string
          instagram_business_account_id?: string | null
          page_access_token: string
          page_id: string
          page_name: string
          route_instagram_to_inbox?: boolean
          route_messenger_to_inbox?: boolean
          sub_account_id: string
          sync_lead_ads?: boolean
          updated_at?: string
          webhook_subscribed?: boolean
        }
        Update: {
          category?: string | null
          connection_id?: string
          created_at?: string
          id?: string
          instagram_business_account_id?: string | null
          page_access_token?: string
          page_id?: string
          page_name?: string
          route_instagram_to_inbox?: boolean
          route_messenger_to_inbox?: boolean
          sub_account_id?: string
          sync_lead_ads?: boolean
          updated_at?: string
          webhook_subscribed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pages_sub_account_id_fkey"
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
      outbound_message_logs: {
        Row: {
          attempt: number
          created_at: string
          error: string | null
          error_code: string | null
          id: string
          latency_ms: number | null
          message_id: string
          provider: string | null
          provider_message_id: string | null
          retryable: boolean | null
          status: string
          sub_account_id: string
        }
        Insert: {
          attempt: number
          created_at?: string
          error?: string | null
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          message_id: string
          provider?: string | null
          provider_message_id?: string | null
          retryable?: boolean | null
          status: string
          sub_account_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          error?: string | null
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          message_id?: string
          provider?: string | null
          provider_message_id?: string | null
          retryable?: boolean | null
          status?: string
          sub_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_message_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_message_logs_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_messages: {
        Row: {
          attempts: number
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["outbound_channel"]
          contact_id: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          invoice_id: string | null
          next_attempt_at: string
          provider: string | null
          provider_message_id: string | null
          scheduled_at: string | null
          send_after_quiet_hours: boolean
          sent_at: string | null
          status: Database["public"]["Enums"]["outbound_status"]
          sub_account_id: string
          subject: string | null
          to_address: string
          workflow_id: string | null
        }
        Insert: {
          attempts?: number
          body_html?: string | null
          body_text?: string | null
          channel: Database["public"]["Enums"]["outbound_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          invoice_id?: string | null
          next_attempt_at?: string
          provider?: string | null
          provider_message_id?: string | null
          scheduled_at?: string | null
          send_after_quiet_hours?: boolean
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_status"]
          sub_account_id: string
          subject?: string | null
          to_address: string
          workflow_id?: string | null
        }
        Update: {
          attempts?: number
          body_html?: string | null
          body_text?: string | null
          channel?: Database["public"]["Enums"]["outbound_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          invoice_id?: string | null
          next_attempt_at?: string
          provider?: string | null
          provider_message_id?: string | null
          scheduled_at?: string | null
          send_after_quiet_hours?: boolean
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_status"]
          sub_account_id?: string
          subject?: string | null
          to_address?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_call_flows: {
        Row: {
          created_at: string
          created_by: string | null
          greeting_audio_url: string | null
          greeting_text: string | null
          id: string
          is_default: boolean | null
          menu: Json
          name: string
          ring_agent_ids: string[] | null
          ring_timeout_seconds: number | null
          sub_account_id: string
          twilio_number_id: string | null
          updated_at: string
          voice_gender: string | null
          voice_language: string | null
          voicemail_enabled: boolean | null
          voicemail_prompt: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          greeting_audio_url?: string | null
          greeting_text?: string | null
          id?: string
          is_default?: boolean | null
          menu?: Json
          name: string
          ring_agent_ids?: string[] | null
          ring_timeout_seconds?: number | null
          sub_account_id: string
          twilio_number_id?: string | null
          updated_at?: string
          voice_gender?: string | null
          voice_language?: string | null
          voicemail_enabled?: boolean | null
          voicemail_prompt?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          greeting_audio_url?: string | null
          greeting_text?: string | null
          id?: string
          is_default?: boolean | null
          menu?: Json
          name?: string
          ring_agent_ids?: string[] | null
          ring_timeout_seconds?: number | null
          sub_account_id?: string
          twilio_number_id?: string | null
          updated_at?: string
          voice_gender?: string | null
          voice_language?: string | null
          voicemail_enabled?: boolean | null
          voicemail_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_call_flows_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_call_flows_twilio_number_id_fkey"
            columns: ["twilio_number_id"]
            isOneToOne: false
            referencedRelation: "twilio_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_calls: {
        Row: {
          agent_user_id: string | null
          call_sid: string | null
          contact_id: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          from_number: string | null
          id: string
          outcome: string | null
          outcome_note: string | null
          parent_call_sid: string | null
          price: number | null
          price_currency: string | null
          recording_duration: number | null
          recording_sid: string | null
          recording_url: string | null
          started_at: string | null
          status: string | null
          sub_account_id: string
          to_number: string | null
          transcript: string | null
          transcript_status: string | null
          twilio_number_id: string | null
          updated_at: string
        }
        Insert: {
          agent_user_id?: string | null
          call_sid?: string | null
          contact_id?: string | null
          created_at?: string
          direction: string
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          outcome?: string | null
          outcome_note?: string | null
          parent_call_sid?: string | null
          price?: number | null
          price_currency?: string | null
          recording_duration?: number | null
          recording_sid?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          sub_account_id: string
          to_number?: string | null
          transcript?: string | null
          transcript_status?: string | null
          twilio_number_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_user_id?: string | null
          call_sid?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          outcome?: string | null
          outcome_note?: string | null
          parent_call_sid?: string | null
          price?: number | null
          price_currency?: string | null
          recording_duration?: number | null
          recording_sid?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          sub_account_id?: string
          to_number?: string | null
          transcript?: string | null
          transcript_status?: string | null
          twilio_number_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_calls_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_calls_twilio_number_id_fkey"
            columns: ["twilio_number_id"]
            isOneToOne: false
            referencedRelation: "twilio_numbers"
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
          job_title: string | null
          phone: string | null
          signature: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          signature?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          signature?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          content: string
          created_at: string
          created_by: string
          error: string | null
          external_id: string | null
          id: string
          media_url: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["social_post_status"]
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          error?: string | null
          external_id?: string | null
          id?: string
          media_url?: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"]
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          error?: string | null
          external_id?: string | null
          id?: string
          media_url?: string | null
          platform?: Database["public"]["Enums"]["social_platform"]
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["social_post_status"]
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          environment: string
          event_id: string
          event_type: string
          id: string
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: string
          event_id: string
          event_type: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          event_id?: string
          event_type?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sub_account_integrations: {
        Row: {
          email_config: Json
          email_from_address: string | null
          email_from_name: string | null
          email_provider: string | null
          email_verified_at: string | null
          sms_config: Json
          sms_from_number: string | null
          sms_provider: string | null
          sms_verified_at: string | null
          sub_account_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          email_config?: Json
          email_from_address?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          email_verified_at?: string | null
          sms_config?: Json
          sms_from_number?: string | null
          sms_provider?: string | null
          sms_verified_at?: string | null
          sub_account_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          email_config?: Json
          email_from_address?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          email_verified_at?: string | null
          sms_config?: Json
          sms_from_number?: string | null
          sms_provider?: string | null
          sms_verified_at?: string | null
          sub_account_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_account_integrations_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: true
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      sub_account_module_audit: {
        Row: {
          changed_by: string | null
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          source: string
          sub_account_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          enabled: boolean
          id?: string
          module_key: string
          source?: string
          sub_account_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          source?: string
          sub_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_account_module_audit_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_account_modules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          sub_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          sub_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          sub_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_account_modules_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_account_subscription_audit: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          modules: string[]
          new_plan_id: string | null
          note: string | null
          old_plan_id: string | null
          source: string
          status: string | null
          sub_account_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          modules?: string[]
          new_plan_id?: string | null
          note?: string | null
          old_plan_id?: string | null
          source?: string
          status?: string | null
          sub_account_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          modules?: string[]
          new_plan_id?: string | null
          note?: string | null
          old_plan_id?: string | null
          source?: string
          status?: string | null
          sub_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_account_subscription_audit_new_plan_id_fkey"
            columns: ["new_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_account_subscription_audit_old_plan_id_fkey"
            columns: ["old_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_account_subscription_audit_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_account_subscriptions: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string | null
          rejection_reason: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          sub_account_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          rejection_reason?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          sub_account_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          rejection_reason?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          sub_account_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_account_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_account_subscriptions_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: true
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_accounts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          agency_id: string
          archived_at: string | null
          city: string | null
          company_number: string | null
          country: string | null
          created_at: string
          default_currency: string
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          phone: string | null
          postcode: string | null
          quiet_hours_enabled: boolean
          quiet_hours_end: number
          quiet_hours_start: number
          quiet_hours_timezone: string
          slug: string | null
          support_email: string | null
          timezone: string
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          agency_id: string
          archived_at?: string | null
          city?: string | null
          company_number?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          postcode?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          quiet_hours_timezone?: string
          slug?: string | null
          support_email?: string | null
          timezone?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          agency_id?: string
          archived_at?: string | null
          city?: string | null
          company_number?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postcode?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          quiet_hours_timezone?: string
          slug?: string | null
          support_email?: string | null
          timezone?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
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
      subscription_plans: {
        Row: {
          agency_id: string
          billing_interval: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          is_active: boolean
          modules: string[]
          name: string
          price_cents: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          billing_interval?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          modules?: string[]
          name: string
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          billing_interval?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          modules?: string[]
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_agency_id_fkey"
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
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      trigger_link_clicks: {
        Row: {
          clicked_at: string
          contact_id: string | null
          id: string
          ip_address: string | null
          link_id: string
          sub_account_id: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          contact_id?: string | null
          id?: string
          ip_address?: string | null
          link_id: string
          sub_account_id: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          contact_id?: string | null
          id?: string
          ip_address?: string | null
          link_id?: string
          sub_account_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trigger_link_clicks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "trigger_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_link_clicks_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_links: {
        Row: {
          click_count: number
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          name: string
          slug: string
          sub_account_id: string
          target_url: string
          updated_at: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          name: string
          slug: string
          sub_account_id: string
          target_url: string
          updated_at?: string
        }
        Update: {
          click_count?: number
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          name?: string
          slug?: string
          sub_account_id?: string
          target_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trigger_links_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      twilio_connections: {
        Row: {
          account_sid: string
          api_key_secret: string
          api_key_sid: string
          created_at: string
          created_by: string | null
          friendly_name: string | null
          id: string
          last_verified_at: string | null
          status: string
          sub_account_id: string
          twiml_app_sid: string | null
          updated_at: string
          voice_identity_prefix: string | null
          webhook_token: string
        }
        Insert: {
          account_sid: string
          api_key_secret: string
          api_key_sid: string
          created_at?: string
          created_by?: string | null
          friendly_name?: string | null
          id?: string
          last_verified_at?: string | null
          status?: string
          sub_account_id: string
          twiml_app_sid?: string | null
          updated_at?: string
          voice_identity_prefix?: string | null
          webhook_token?: string
        }
        Update: {
          account_sid?: string
          api_key_secret?: string
          api_key_sid?: string
          created_at?: string
          created_by?: string | null
          friendly_name?: string | null
          id?: string
          last_verified_at?: string | null
          status?: string
          sub_account_id?: string
          twiml_app_sid?: string | null
          updated_at?: string
          voice_identity_prefix?: string | null
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "twilio_connections_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: true
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      twilio_numbers: {
        Row: {
          capabilities: Json
          connection_id: string
          cost_currency: string | null
          created_at: string
          friendly_name: string | null
          id: string
          is_default: boolean
          iso_country: string | null
          monthly_cost: number | null
          phone_number: string
          purchased_at: string
          released_at: string | null
          sms_url: string | null
          status_callback: string | null
          sub_account_id: string
          twilio_sid: string
          updated_at: string
          voice_url: string | null
          whatsapp_enabled: boolean
          whatsapp_sender: string | null
          whatsapp_url: string | null
        }
        Insert: {
          capabilities?: Json
          connection_id: string
          cost_currency?: string | null
          created_at?: string
          friendly_name?: string | null
          id?: string
          is_default?: boolean
          iso_country?: string | null
          monthly_cost?: number | null
          phone_number: string
          purchased_at?: string
          released_at?: string | null
          sms_url?: string | null
          status_callback?: string | null
          sub_account_id: string
          twilio_sid: string
          updated_at?: string
          voice_url?: string | null
          whatsapp_enabled?: boolean
          whatsapp_sender?: string | null
          whatsapp_url?: string | null
        }
        Update: {
          capabilities?: Json
          connection_id?: string
          cost_currency?: string | null
          created_at?: string
          friendly_name?: string | null
          id?: string
          is_default?: boolean
          iso_country?: string | null
          monthly_cost?: number | null
          phone_number?: string
          purchased_at?: string
          released_at?: string | null
          sms_url?: string | null
          status_callback?: string | null
          sub_account_id?: string
          twilio_sid?: string
          updated_at?: string
          voice_url?: string | null
          whatsapp_enabled?: boolean
          whatsapp_sender?: string | null
          whatsapp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twilio_numbers_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "twilio_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twilio_numbers_sub_account_id_fkey"
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
      voicemails: {
        Row: {
          contact_id: string | null
          created_at: string
          duration_seconds: number | null
          from_number: string | null
          id: string
          listened_at: string | null
          listened_by: string | null
          phone_call_id: string | null
          recording_sid: string | null
          recording_url: string
          sub_account_id: string
          transcription: string | null
          transcription_status: string | null
          twilio_number_id: string | null
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          listened_at?: string | null
          listened_by?: string | null
          phone_call_id?: string | null
          recording_sid?: string | null
          recording_url: string
          sub_account_id: string
          transcription?: string | null
          transcription_status?: string | null
          twilio_number_id?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          listened_at?: string | null
          listened_by?: string | null
          phone_call_id?: string | null
          recording_sid?: string | null
          recording_url?: string
          sub_account_id?: string
          transcription?: string | null
          transcription_status?: string | null
          twilio_number_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voicemails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voicemails_phone_call_id_fkey"
            columns: ["phone_call_id"]
            isOneToOne: false
            referencedRelation: "phone_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voicemails_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voicemails_twilio_number_id_fkey"
            columns: ["twilio_number_id"]
            isOneToOne: false
            referencedRelation: "twilio_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      wordpress_webhooks: {
        Row: {
          created_at: string
          created_by: string
          default_tags: string[]
          enabled: boolean
          field_map: Json
          form_id: string
          id: string
          last_error: string | null
          last_received_at: string | null
          lead_source: string
          name: string
          secret: string | null
          sub_account_id: string
          token: string
          total_received: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_tags?: string[]
          enabled?: boolean
          field_map?: Json
          form_id: string
          id?: string
          last_error?: string | null
          last_received_at?: string | null
          lead_source?: string
          name: string
          secret?: string | null
          sub_account_id: string
          token: string
          total_received?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_tags?: string[]
          enabled?: boolean
          field_map?: Json
          form_id?: string
          id?: string
          last_error?: string | null
          last_received_at?: string | null
          lead_source?: string
          name?: string
          secret?: string | null
          sub_account_id?: string
          token?: string
          total_received?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wordpress_webhooks_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "lead_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wordpress_webhooks_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      acquire_billing_reconcile_lease: {
        Args: { _minutes?: number }
        Returns: boolean
      }
      get_invitation_token: { Args: { _id: string }; Returns: string }
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
      in_quiet_hours: { Args: { _at: string; _sub: string }; Returns: boolean }
      is_subaccount_admin: {
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
      list_recycle_bin: {
        Args: { _sub: string }
        Returns: {
          deleted_at: string
          deleted_by: string
          deleted_by_name: string
          entity: string
          id: string
          label: string
        }[]
      }
      list_subscription_signups: {
        Args: never
        Returns: {
          agency_id: string
          agency_name: string
          approval_status: string
          approved_at: string
          approver_name: string
          billing_interval: string
          created_at: string
          currency: string
          plan_id: string
          plan_name: string
          price_cents: number
          rejection_reason: string
          status: string
          sub_account_id: string
          sub_account_name: string
          subscription_id: string
        }[]
      }
      next_send_time: { Args: { _at: string; _sub: string }; Returns: string }
      pause_billing_reconcile: {
        Args: { _minutes: number; _reason: string }
        Returns: undefined
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
      recalc_invoice_totals: { Args: { _invoice: string }; Returns: undefined }
      recycle_bin_purge: {
        Args: { _entity: string; _id: string }
        Returns: undefined
      }
      recycle_bin_restore: {
        Args: { _entity: string; _id: string }
        Returns: undefined
      }
      recycle_bin_soft_delete: {
        Args: { _entity: string; _id: string }
        Returns: undefined
      }
      release_billing_reconcile_lease: {
        Args: { _result?: Json }
        Returns: undefined
      }
      render_merge_tags: { Args: { _ctx: Json; _tpl: string }; Returns: string }
      resume_billing_reconcile: { Args: never; Returns: undefined }
      run_workflows: {
        Args: {
          _payload: Json
          _row_id: string
          _sub: string
          _trigger: Database["public"]["Enums"]["workflow_trigger"]
        }
        Returns: undefined
      }
      scan_time_workflows: { Args: never; Returns: undefined }
      set_subscription_approval: {
        Args: { _reason?: string; _status: string; _sub: string }
        Returns: undefined
      }
      subscription_modules: { Args: { _sub: string }; Returns: string[] }
    }
    Enums: {
      ad_campaign_status: "draft" | "active" | "paused" | "completed"
      ad_platform: "google" | "meta" | "linkedin" | "tiktok" | "other"
      agency_role: "owner" | "admin"
      app_role: "admin" | "user"
      campaign_status: "draft" | "scheduled" | "sending" | "sent" | "failed"
      contact_lifecycle_stage: "lead" | "mql" | "sql" | "customer" | "lost"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "void"
      message_channel:
        | "note"
        | "email"
        | "sms"
        | "whatsapp"
        | "instagram"
        | "messenger"
        | "linkedin"
        | "tiktok"
      message_direction: "inbound" | "outbound"
      message_kind:
        | "note"
        | "email_log"
        | "sms_log"
        | "messenger_log"
        | "instagram_log"
      outbound_channel: "email" | "sms"
      outbound_status: "queued" | "sending" | "sent" | "failed"
      social_platform: "facebook" | "instagram" | "linkedin" | "twitter"
      social_post_status: "draft" | "scheduled" | "published" | "failed"
      sub_account_role: "member" | "client"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "open" | "in_progress" | "done" | "cancelled"
      template_channel: "email" | "sms"
      workflow_trigger:
        | "contact.created"
        | "contact.stage_changed"
        | "deal.stage_changed"
        | "task.completed"
        | "form.submitted"
        | "task.due_soon"
        | "contact.stale"
        | "link.clicked"
        | "deal.created"
        | "deal.signed"
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
      ad_campaign_status: ["draft", "active", "paused", "completed"],
      ad_platform: ["google", "meta", "linkedin", "tiktok", "other"],
      agency_role: ["owner", "admin"],
      app_role: ["admin", "user"],
      campaign_status: ["draft", "scheduled", "sending", "sent", "failed"],
      contact_lifecycle_stage: ["lead", "mql", "sql", "customer", "lost"],
      invoice_status: ["draft", "sent", "paid", "overdue", "void"],
      message_channel: [
        "note",
        "email",
        "sms",
        "whatsapp",
        "instagram",
        "messenger",
        "linkedin",
        "tiktok",
      ],
      message_direction: ["inbound", "outbound"],
      message_kind: [
        "note",
        "email_log",
        "sms_log",
        "messenger_log",
        "instagram_log",
      ],
      outbound_channel: ["email", "sms"],
      outbound_status: ["queued", "sending", "sent", "failed"],
      social_platform: ["facebook", "instagram", "linkedin", "twitter"],
      social_post_status: ["draft", "scheduled", "published", "failed"],
      sub_account_role: ["member", "client"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["open", "in_progress", "done", "cancelled"],
      template_channel: ["email", "sms"],
      workflow_trigger: [
        "contact.created",
        "contact.stage_changed",
        "deal.stage_changed",
        "task.completed",
        "form.submitted",
        "task.due_soon",
        "contact.stale",
        "link.clicked",
        "deal.created",
        "deal.signed",
      ],
    },
  },
} as const
