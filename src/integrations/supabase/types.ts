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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      gift_cards: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          code: string
          created_at: string
          gift_card_type: Database["public"]["Enums"]["gift_card_type"]
          id: string
          points_awarded: number | null
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          code: string
          created_at?: string
          gift_card_type: Database["public"]["Enums"]["gift_card_type"]
          id?: string
          points_awarded?: number | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          created_at?: string
          gift_card_type?: Database["public"]["Enums"]["gift_card_type"]
          id?: string
          points_awarded?: number | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      invite_redemptions: {
        Row: {
          id: string
          invite_id: string
          invitee_id: string
          invitee_points_awarded: number
          inviter_id: string
          inviter_points_awarded: number
          redeemed_at: string
        }
        Insert: {
          id?: string
          invite_id: string
          invitee_id: string
          invitee_points_awarded?: number
          inviter_id: string
          inviter_points_awarded?: number
          redeemed_at?: string
        }
        Update: {
          id?: string
          invite_id?: string
          invitee_id?: string
          invitee_points_awarded?: number
          inviter_id?: string
          inviter_points_awarded?: number
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_redemptions_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_redemptions_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_redemptions_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          current_uses: number
          expires_at: string | null
          id: string
          invite_code: string
          invited_email: string | null
          inviter_id: string
          is_active: boolean
          max_uses: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          invite_code: string
          invited_email?: string | null
          inviter_id: string
          is_active?: boolean
          max_uses?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          invite_code?: string
          invited_email?: string | null
          inviter_id?: string
          is_active?: boolean
          max_uses?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          points: number
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          points?: number
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          points?: number
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          video_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          video_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_unlocks: {
        Row: {
          id: string
          unlocked_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          id?: string
          unlocked_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          id?: string
          unlocked_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unlocks_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          description: string | null
          duration: number | null
          full_video_url: string | null
          id: string
          preview_url: string | null
          reward_points: number
          status: Database["public"]["Enums"]["video_status"]
          thumbnail_url: string | null
          title: string
          unlock_cost: number
          unlock_count: number
          updated_at: string
          uploader_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: number | null
          full_video_url?: string | null
          id?: string
          preview_url?: string | null
          reward_points?: number
          status?: Database["public"]["Enums"]["video_status"]
          thumbnail_url?: string | null
          title: string
          unlock_cost?: number
          unlock_count?: number
          updated_at?: string
          uploader_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: number | null
          full_video_url?: string | null
          id?: string
          preview_url?: string | null
          reward_points?: number
          status?: Database["public"]["Enums"]["video_status"]
          thumbnail_url?: string | null
          title?: string
          unlock_cost?: number
          unlock_count?: number
          updated_at?: string
          uploader_id?: string
          view_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_inviter_public_info: {
        Args: { invite_code_param: string }
        Returns: {
          display_name: string
          username: string
        }[]
      }
      is_admin: {
        Args: { user_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      gift_card_type:
        | "amazon"
        | "google_play"
        | "apple"
        | "steam"
        | "visa"
        | "paypal"
      transaction_type:
        | "purchase"
        | "reward"
        | "unlock"
        | "gift_card"
        | "referral"
        | "admin_adjustment"
      user_role: "user" | "admin" | "moderator"
      video_status: "pending" | "approved" | "rejected"
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
      gift_card_type: [
        "amazon",
        "google_play",
        "apple",
        "steam",
        "visa",
        "paypal",
      ],
      transaction_type: [
        "purchase",
        "reward",
        "unlock",
        "gift_card",
        "referral",
        "admin_adjustment",
      ],
      user_role: ["user", "admin", "moderator"],
      video_status: ["pending", "approved", "rejected"],
    },
  },
} as const
