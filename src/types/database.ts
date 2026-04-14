/**
 * Tipos de Supabase Database
 * Generados automáticamente por supabase client library
 * 
 * Para regenerar:
 * npx supabase gen types typescript --project-id <project-id>
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          cedula_unica: string;
          cedula_tipo: 'CC' | 'CE' | 'PA' | 'NIT';
          plan_type: 'free' | 'premium' | 'enterprise';
          storage_quota_bytes: number;
          storage_used_bytes: number;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          two_factor_enabled: boolean;
          created_at: string;
          updated_at: string;
          last_login: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          cedula_unica: string;
          cedula_tipo: 'CC' | 'CE' | 'PA' | 'NIT';
          plan_type?: 'free' | 'premium' | 'enterprise';
          storage_quota_bytes?: number;
          storage_used_bytes?: number;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          two_factor_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          cedula_unica?: string;
          cedula_tipo?: 'CC' | 'CE' | 'PA' | 'NIT';
          plan_type?: 'free' | 'premium' | 'enterprise';
          storage_quota_bytes?: number;
          storage_used_bytes?: number;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          two_factor_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
        };
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          icon: string;
          color_code: string;
          sort_order: number;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          icon?: string;
          color_code?: string;
          sort_order?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          icon?: string;
          color_code?: string;
          sort_order?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          file_name: string;
          file_size_bytes: number;
          file_type: string;
          storage_path: string;
          description: string | null;
          expiry_date: string | null;
          tags: string[];
          is_starred: boolean;
          is_archived: boolean;
          access_level: 'private' | 'family' | 'trusted';
          created_at: string;
          updated_at: string;
          last_accessed: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          file_name: string;
          file_size_bytes: number;
          file_type: string;
          storage_path: string;
          description?: string | null;
          expiry_date?: string | null;
          tags?: string[];
          is_starred?: boolean;
          is_archived?: boolean;
          access_level?: 'private' | 'family' | 'trusted';
          created_at?: string;
          updated_at?: string;
          last_accessed?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          file_name?: string;
          file_size_bytes?: number;
          file_type?: string;
          storage_path?: string;
          description?: string | null;
          expiry_date?: string | null;
          tags?: string[];
          is_starred?: boolean;
          is_archived?: boolean;
          access_level?: 'private' | 'family' | 'trusted';
          created_at?: string;
          updated_at?: string;
          last_accessed?: string | null;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_type: 'free' | 'premium' | 'enterprise';
          storage_quota_bytes: number;
          billing_cycle: 'monthly' | 'yearly' | null;
          current_period_start: string;
          current_period_end: string | null;
          is_active: boolean;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_type: 'free' | 'premium' | 'enterprise';
          storage_quota_bytes: number;
          billing_cycle?: 'monthly' | 'yearly' | null;
          current_period_start: string;
          current_period_end?: string | null;
          is_active?: boolean;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_type?: 'free' | 'premium' | 'enterprise';
          storage_quota_bytes?: number;
          billing_cycle?: 'monthly' | 'yearly' | null;
          current_period_start?: string;
          current_period_end?: string | null;
          is_active?: boolean;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          document_name: string;
          expiry_date: string;
          alert_days_before: number;
          alert_sent: boolean;
          alert_sent_at: string | null;
          is_dismissed: boolean;
          dismissed_at: string | null;
          notify_email: boolean;
          notify_push: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id: string;
          document_name: string;
          expiry_date: string;
          alert_days_before?: number;
          alert_sent?: boolean;
          alert_sent_at?: string | null;
          is_dismissed?: boolean;
          dismissed_at?: string | null;
          notify_email?: boolean;
          notify_push?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_id?: string;
          document_name?: string;
          expiry_date?: string;
          alert_days_before?: number;
          alert_sent?: boolean;
          alert_sent_at?: string | null;
          is_dismissed?: boolean;
          dismissed_at?: string | null;
          notify_email?: boolean;
          notify_push?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_webhooks: {
        Row: {
          id: string;
          user_id: string | null;
          transaction_id: string;
          payment_gateway: 'wompi' | 'epayco';
          amount: number;
          currency: string;
          status: 'pending' | 'approved' | 'failed' | 'refunded';
          plan_type: 'free' | 'premium' | 'enterprise' | null;
          webhook_payload: Json;
          webhook_signature: string;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          transaction_id: string;
          payment_gateway: 'wompi' | 'epayco';
          amount: number;
          currency?: string;
          status: 'pending' | 'approved' | 'failed' | 'refunded';
          plan_type?: 'free' | 'premium' | 'enterprise' | null;
          webhook_payload?: Json;
          webhook_signature: string;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          transaction_id?: string;
          payment_gateway?: 'wompi' | 'epayco';
          amount?: number;
          currency?: string;
          status?: 'pending' | 'approved' | 'failed' | 'refunded';
          plan_type?: 'free' | 'premium' | 'enterprise' | null;
          webhook_payload?: Json;
          webhook_signature?: string;
          created_at?: string;
          processed_at?: string | null;
        };
      };
      fraud_detection: {
        Row: {
          id: string;
          cedula_unica: string;
          ip_address: string | null;
          fingerprint_hash: string | null;
          registration_attempts: number;
          last_attempt_at: string;
          is_flagged: boolean;
          flag_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cedula_unica: string;
          ip_address?: string | null;
          fingerprint_hash?: string | null;
          registration_attempts?: number;
          last_attempt_at?: string;
          is_flagged?: boolean;
          flag_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cedula_unica?: string;
          ip_address?: string | null;
          fingerprint_hash?: string | null;
          registration_attempts?: number;
          last_attempt_at?: string;
          is_flagged?: boolean;
          flag_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          details: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          resource_type?: string;
          resource_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      check_storage_quota: {
        Args: {
          p_user_id: string;
          p_file_size_bytes: number;
        };
        Returns: boolean;
      };
      update_storage_used: {
        Args: {
          p_user_id: string;
          p_file_size_bytes: number;
        };
        Returns: undefined;
      };
      free_storage: {
        Args: {
          p_user_id: string;
          p_file_size_bytes: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      plan_type: 'free' | 'premium' | 'enterprise';
      cedula_tipo: 'CC' | 'CE' | 'PA' | 'NIT';
      access_level: 'private' | 'family' | 'trusted';
      payment_status: 'pending' | 'approved' | 'failed' | 'refunded';
    };
  };
}
