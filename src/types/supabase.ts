export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      api_keys: {
        Row: {
          id: string
          user_id: string
          service: string
          key: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          service: string
          key: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          service?: string
          key?: string
          created_at?: string
          updated_at?: string
        }
      }
      business_plans: {
        Row: {
          id: string
          project_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string
          skills: string[]
          short_term_mission: string | null
          long_term_mission: string | null
          current_projects: string[] | null
          joined_at: string
          location: string | null
          avatar_url: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email: string
          skills?: string[]
          short_term_mission?: string | null
          long_term_mission?: string | null
          current_projects?: string[] | null
          joined_at?: string
          location?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string
          skills?: string[]
          short_term_mission?: string | null
          long_term_mission?: string | null
          current_projects?: string[] | null
          joined_at?: string
          location?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          title: string
          location: string | null
          property_status: 'owned_land' | 'potential_property'
          values_mission_goals: string | null
          guilds: string[] | null
          team: string[] | null
          zone_0: string | null
          zone_1: string | null
          zone_2: string | null
          zone_3: string | null
          zone_4: string | null
          water: string | null
          soil: string | null
          power: string | null
          structures: string[] | null
          category: string | null
          funding_needs: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          location?: string | null
          property_status: 'owned_land' | 'potential_property'
          values_mission_goals?: string | null
          guilds?: string[] | null
          team?: string[] | null
          zone_0?: string | null
          zone_1?: string | null
          zone_2?: string | null
          zone_3?: string | null
          zone_4?: string | null
          water?: string | null
          soil?: string | null
          power?: string | null
          structures?: string[] | null
          category?: string | null
          funding_needs?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          location?: string | null
          property_status?: 'owned_land' | 'potential_property'
          values_mission_goals?: string | null
          guilds?: string[] | null
          team?: string[] | null
          zone_0?: string | null
          zone_1?: string | null
          zone_2?: string | null
          zone_3?: string | null
          zone_4?: string | null
          water?: string | null
          soil?: string | null
          power?: string | null
          structures?: string[] | null
          category?: string | null
          funding_needs?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'done' | 'blocked'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          due_date: string | null
          is_project_task: boolean
          project_id: string | null
          assigned_to: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done' | 'blocked'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          due_date?: string | null
          is_project_task?: boolean
          project_id?: string | null
          assigned_to?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done' | 'blocked'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          due_date?: string | null
          is_project_task?: boolean
          project_id?: string | null
          assigned_to?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      items: {
        Row: {
          id: string
          title: string
          description: string | null
          item_type: 'needed_supply' | 'owned_resource' | 'borrowed_or_rental'
          fundraiser: boolean
          tags: string[] | null
          quantity_needed: number | null
          quantity_owned: number | null
          quantity_borrowed: number | null
          unit: string | null
          product_link: string | null
          info_link: string | null
          image_url: string | null
          associated_task_id: string | null
          project_id: string | null
          added_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          item_type?: 'needed_supply' | 'owned_resource' | 'borrowed_or_rental'
          fundraiser?: boolean
          tags?: string[] | null
          quantity_needed?: number | null
          quantity_owned?: number | null
          quantity_borrowed?: number | null
          unit?: string | null
          product_link?: string | null
          info_link?: string | null
          image_url?: string | null
          associated_task_id?: string | null
          project_id?: string | null
          added_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          item_type?: 'needed_supply' | 'owned_resource' | 'borrowed_or_rental'
          fundraiser?: boolean
          tags?: string[] | null
          quantity_needed?: number | null
          quantity_owned?: number | null
          quantity_borrowed?: number | null
          unit?: string | null
          product_link?: string | null
          info_link?: string | null
          image_url?: string | null
          associated_task_id?: string | null
          project_id?: string | null
          added_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}