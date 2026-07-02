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
      booking_pages: {
        Row: {
          advance_days: number
          availability: Json
          buffer_minutes: number
          created_at: string
          description: string | null
          duration_minutes: number
          enabled: boolean
          id: string
          min_notice_minutes: number
          name: string
          owner_user_id: string
          slug: string
          sub_account_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          advance_days?: number
          availability?: Json
          buffer_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          enabled?: boolean
          id?: string
          min_notice_minutes?: number
          name: string
          owner_user_id: string
          slug: string
          sub_account_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          advance_days?: number
          availability?: Json
          buffer_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          enabled?: boolean
          id?: string
          min_notice_minutes?: number
          name?: string
          owner_user_id?: string
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
          channel: Database["public"]["Enums"]["message_channel"]
          contact_id: string
          created_at: string
          external_thread_id: string | null
          id: string
          last_message_at: string | null
          sub_account_id: string
          twilio_number_id: string | null
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
          sub_account_id: string
          twilio_number_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id?: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
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
      sub_accounts: {
        Row: {
          agency_id: string
          archived_at: string | null
          created_at: string
          id: string
          industry: string | null
          name: string
          quiet_hours_enabled: boolean
          quiet_hours_end: number
          quiet_hours_start: number
          quiet_hours_timezone: string
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
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          quiet_hours_timezone?: string
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
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          quiet_hours_timezone?: string
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
      next_send_time: { Args: { _at: string; _sub: string }; Returns: string }
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
      render_merge_tags: { Args: { _ctx: Json; _tpl: string }; Returns: string }
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
    }
    Enums: {
      ad_campaign_status: "draft" | "active" | "paused" | "completed"
      ad_platform: "google" | "meta" | "linkedin" | "tiktok" | "other"
      agency_role: "owner" | "admin"
      app_role: "admin" | "user"
      campaign_status: "draft" | "scheduled" | "sending" | "sent" | "failed"
      contact_lifecycle_stage: "lead" | "mql" | "sql" | "customer" | "lost"
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
      ad_campaign_status: ["draft", "active", "paused", "completed"],
      ad_platform: ["google", "meta", "linkedin", "tiktok", "other"],
      agency_role: ["owner", "admin"],
      app_role: ["admin", "user"],
      campaign_status: ["draft", "scheduled", "sending", "sent", "failed"],
      contact_lifecycle_stage: ["lead", "mql", "sql", "customer", "lost"],
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
      ],
    },
  },
} as const
