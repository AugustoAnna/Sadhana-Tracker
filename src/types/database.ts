export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      participants: {
        Row: {
          created_at: string
          device_id: string
          id: string
          instance_education_shown: boolean
          is_meditator: boolean | null
          name: string
          onboarding_complete: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          instance_education_shown?: boolean
          is_meditator?: boolean | null
          name: string
          onboarding_complete?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          instance_education_shown?: boolean
          is_meditator?: boolean | null
          name?: string
          onboarding_complete?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      practice_instances: {
        Row: {
          added_at: string
          device_id: string
          id: string
          instance_number: number
          order_index: number
          participant_id: string
          practice_id: string
        }
        Insert: {
          added_at?: string
          device_id: string
          id: string
          instance_number: number
          order_index?: number
          participant_id: string
          practice_id: string
        }
        Update: {
          added_at?: string
          device_id?: string
          id?: string
          instance_number?: number
          order_index?: number
          participant_id?: string
          practice_id?: string
        }
        Relationships: []
      }
      practice_logs: {
        Row: {
          created_at: string
          device_id: string
          id: string
          instance_id: string
          logged_at: string
          minutes: number
          participant_id: string
          practice_id: string
          source: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id: string
          instance_id: string
          logged_at: string
          minutes: number
          participant_id: string
          practice_id: string
          source: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          instance_id?: string
          logged_at?: string
          minutes?: number
          participant_id?: string
          practice_id?: string
          source?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          device_id: string
          enabled: boolean
          id: number
          participant_id: string
          time: string
        }
        Insert: {
          device_id: string
          enabled?: boolean
          id: number
          participant_id: string
          time: string
        }
        Update: {
          device_id?: string
          enabled?: boolean
          id?: number
          participant_id?: string
          time?: string
        }
        Relationships: []
      }
      saved_sessions: {
        Row: {
          device_id: string
          id: string
          last_used_at: string
          name: string
          participant_id: string
          practice_instance_ids: string[]
        }
        Insert: {
          device_id: string
          id: string
          last_used_at?: string
          name: string
          participant_id: string
          practice_instance_ids?: string[]
        }
        Update: {
          device_id?: string
          id?: string
          last_used_at?: string
          name?: string
          participant_id?: string
          practice_instance_ids?: string[]
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
