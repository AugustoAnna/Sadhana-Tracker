export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      participants: {
        Row: {
          id: string;
          auth_user_id: string;
          email: string | null;
          name: string;
          platform: string | null;
          installed_standalone: boolean;
          notification_permission: string | null;
          timezone: string | null;
          segment: string | null;
          environment: string;
          created_at: string;
          onboarding_completed_at: string | null;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          email?: string | null;
          name: string;
          platform?: string | null;
          installed_standalone?: boolean;
          notification_permission?: string | null;
          timezone?: string | null;
          segment?: string | null;
          environment: string;
          created_at?: string;
          onboarding_completed_at?: string | null;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          email?: string | null;
          name?: string;
          platform?: string | null;
          installed_standalone?: boolean;
          notification_permission?: string | null;
          timezone?: string | null;
          segment?: string | null;
          environment?: string;
          created_at?: string;
          onboarding_completed_at?: string | null;
        };
        Relationships: [];
      };
      practices: {
        Row: {
          id: string;
          name: string;
          kind: string;
          default_minutes: number | null;
          illustration: string;
          audio_path: string | null;
          allows_second_instance: boolean;
          sort_order: number;
        };
        Insert: {
          id: string;
          name: string;
          kind: string;
          default_minutes?: number | null;
          illustration: string;
          audio_path?: string | null;
          allows_second_instance?: boolean;
          sort_order: number;
        };
        Update: Partial<Database['public']['Tables']['practices']['Insert']>;
        Relationships: [];
      };
      participant_practices: {
        Row: {
          id: string;
          participant_id: string;
          practice_id: string;
          instance: number;
          environment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          practice_id: string;
          instance?: number;
          environment: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['participant_practices']['Insert']>;
        Relationships: [];
      };
      practice_completed: {
        Row: {
          id: string;
          participant_id: string;
          practice_id: string;
          instance: number;
          minutes: number;
          mode: string;
          was_offline: boolean;
          local_date: string;
          occurred_at: string;
          environment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          practice_id: string;
          instance?: number;
          minutes: number;
          mode: string;
          was_offline?: boolean;
          local_date: string;
          occurred_at?: string;
          environment: string;
          created_at?: string;
          // Backtracking columns (backend B3). Sent only when SYNC_BACKTRACK_COLUMNS is on.
          backtrack?: boolean;
          route?: 'switcher' | 'sheet' | 'push' | null;
        };
        Update: Partial<Database['public']['Tables']['practice_completed']['Insert']>;
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          participant_id: string;
          kind: string;
          slot: number | null;
          practice_id: string | null;
          time_local: string;
          enabled: boolean;
          environment: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          kind: string;
          slot?: number | null;
          practice_id?: string | null;
          time_local: string;
          enabled?: boolean;
          environment: string;
        };
        Update: Partial<Database['public']['Tables']['reminders']['Insert']>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          participant_id: string;
          name: string;
          properties: Json;
          occurred_at: string;
          local_date: string;
          environment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          name: string;
          properties?: Json;
          occurred_at?: string;
          local_date: string;
          environment: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          participant_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          environment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          environment: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>;
        Relationships: [];
      };
      banner_targets: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['banner_targets']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
