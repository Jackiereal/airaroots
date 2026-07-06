// Hand-written stub — replace with `supabase gen types typescript` output once project is live

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string;
          name: string;
          slug: string;
          address: string | null;
          description: string | null;
          platform: string;
          projections_config: Json | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          address?: string | null;
          description?: string | null;
          platform?: string;
          projections_config?: Json | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          address?: string | null;
          description?: string | null;
          platform?: string;
          projections_config?: Json | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      property_owners: {
        Row: {
          id: string;
          property_id: string;
          name: string;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          name?: string;
          user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      property_finance_expenses: {
        Row: {
          id: string;
          property_id: string;
          period_month: string;
          expense_type: string;
          amount: number;
          expense_date: string | null;
          notes: string | null;
          paid_from: string;
          owner_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          period_month: string;
          expense_type: string;
          amount: number;
          expense_date?: string | null;
          notes?: string | null;
          paid_from?: string;
          owner_id?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          period_month?: string;
          expense_type?: string;
          amount?: number;
          expense_date?: string | null;
          notes?: string | null;
          paid_from?: string;
          owner_id?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      property_finance_direct_bookings: {
        Row: {
          id: string;
          property_id: string;
          period_month: string;
          guest_name: string | null;
          amount: number | null;
          guest_count: number | null;
          guest_phone: string | null;
          received_date: string | null;
          check_in: string | null;
          check_out: string | null;
          nights: number | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          period_month: string;
          guest_name?: string | null;
          amount?: number | null;
          guest_count?: number | null;
          guest_phone?: string | null;
          received_date?: string | null;
          check_in?: string | null;
          check_out?: string | null;
          nights?: number | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          period_month?: string;
          guest_name?: string | null;
          amount?: number | null;
          guest_count?: number | null;
          guest_phone?: string | null;
          received_date?: string | null;
          check_in?: string | null;
          check_out?: string | null;
          nights?: number | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      property_finance_airbnb_rows: {
        Row: {
          id: string;
          property_id: string;
          period_month: string;
          row_date: string | null;
          arriving_by_date: string | null;
          row_type: string | null;
          confirmation_code: string | null;
          booking_date: string | null;
          start_date: string | null;
          end_date: string | null;
          nights: number | null;
          guest: string | null;
          listing: string | null;
          details: string | null;
          reference_code: string | null;
          currency: string | null;
          amount: number | null;
          paid_out: number | null;
          service_fee: number | null;
          fast_pay_fee: number | null;
          cleaning_fee: number | null;
          gross_earnings: number | null;
          airbnb_remitted_tax: number | null;
          earnings_year: string | null;
          guest_count: number | null;
          raw: Json | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          period_month: string;
          row_date?: string | null;
          arriving_by_date?: string | null;
          row_type?: string | null;
          confirmation_code?: string | null;
          booking_date?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          nights?: number | null;
          guest?: string | null;
          listing?: string | null;
          details?: string | null;
          reference_code?: string | null;
          currency?: string | null;
          amount?: number | null;
          paid_out?: number | null;
          service_fee?: number | null;
          fast_pay_fee?: number | null;
          cleaning_fee?: number | null;
          gross_earnings?: number | null;
          airbnb_remitted_tax?: number | null;
          earnings_year?: string | null;
          guest_count?: number | null;
          raw?: Json | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          period_month?: string;
          row_date?: string | null;
          arriving_by_date?: string | null;
          row_type?: string | null;
          confirmation_code?: string | null;
          booking_date?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          nights?: number | null;
          guest?: string | null;
          listing?: string | null;
          details?: string | null;
          reference_code?: string | null;
          currency?: string | null;
          amount?: number | null;
          paid_out?: number | null;
          service_fee?: number | null;
          fast_pay_fee?: number | null;
          cleaning_fee?: number | null;
          gross_earnings?: number | null;
          airbnb_remitted_tax?: number | null;
          earnings_year?: string | null;
          guest_count?: number | null;
          raw?: Json | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      property_finance_loans: {
        Row: {
          id: string;
          property_id: string;
          name: string;
          principal: number | null;
          annual_rate: number | null;
          tenure_months: number | null;
          start_date: string | null;
          status: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          principal?: number | null;
          annual_rate?: number | null;
          tenure_months?: number | null;
          start_date?: string | null;
          status?: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          name?: string;
          principal?: number | null;
          annual_rate?: number | null;
          tenure_months?: number | null;
          start_date?: string | null;
          status?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          role: 'admin' | 'client';
          full_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: 'admin' | 'client';
          full_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: 'admin' | 'client';
          full_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      property_access: {
        Row: {
          id: string;
          property_id: string;
          user_id: string;
          granted_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          user_id: string;
          granted_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          user_id?: string;
          granted_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string;
          property_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          before_state: Json | null;
          after_state: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          property_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          property_id?: string | null;
          action?: string;
          resource_type?: string;
          resource_id?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
