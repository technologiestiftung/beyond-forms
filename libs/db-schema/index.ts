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
      asset_entries: {
        Row: {
          amount: number | null
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          description: string | null
          id: string
          person_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          description?: string | null
          id?: string
          person_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          description?: string | null
          id?: string
          person_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "associated_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      associated_persons: {
        Row: {
          association_type: Database["public"]["Enums"]["association_type"]
          birth_name: string | null
          can_work_at_least_3h_daily: boolean | null
          care_level: Database["public"]["Enums"]["care_level_type"] | null
          commute_distance_km: number | null
          created_at: string
          date_of_birth: string | null
          disability_application_pending: boolean | null
          disability_valid_until: string | null
          displaced_issued_by: string | null
          displaced_issued_on: string | null
          displaced_status:
            | Database["public"]["Enums"]["displaced_status_type"]
            | null
          education_or_study_subject: string | null
          employer_name: string | null
          employment_office_customer_number: string | null
          employment_status: string | null
          first_name: string | null
          has_applied_for_asylum_benefits: boolean | null
          has_applied_for_sgb2_benefits: boolean | null
          has_child_with_substantial_income: boolean | null
          has_custodian: boolean | null
          has_disability_id: boolean | null
          has_guardian: boolean | null
          has_inpatient_facility_accommodation: boolean | null
          has_own_income: boolean | null
          has_permanent_reduction_in_earning_capacity: boolean | null
          has_received_previous_benefits: boolean | null
          have_parents_substantial_joint_income: boolean | null
          health_insurance_provider: string | null
          health_insurance_status:
            | Database["public"]["Enums"]["health_insurance_status_type"]
            | null
          id: string
          id_document_issuing_authority: string | null
          id_document_valid_until: string | null
          inpatient_facility_assigned_from: string | null
          inpatient_facility_assigned_until: string | null
          inpatient_facility_last_residence: string | null
          is_alimony_obligated: boolean | null
          is_care_dependent: boolean | null
          is_german_citizen: boolean | null
          is_student_or_trainee: boolean | null
          last_name: string | null
          legal_gender: Database["public"]["Enums"]["gender_type"] | null
          lives_in_household: boolean
          marital_status:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          merkzeichen:
            | Database["public"]["Enums"]["disability_merkzeichen_type"]
            | null
          monthly_expenses_total: number | null
          monthly_income: number | null
          monthly_pension_income: number | null
          nationality: string | null
          pension_insurance_no: string | null
          pension_insurance_provider: string | null
          place_of_birth: string | null
          previous_benefits_authority: string | null
          previous_benefits_period: string | null
          previous_benefits_ref_no: string | null
          reduced_work_capacity_end_date: string | null
          reduced_work_capacity_is_permanent: boolean | null
          reduced_work_capacity_reason: string | null
          reduced_work_capacity_start_date: string | null
          relationship_to_applicant: string | null
          second_nationality: string | null
          social_security_type:
            | Database["public"]["Enums"]["social_security_type_type"]
            | null
          sort_order: number
          updated_at: string
          user_id: string
          work_scope_and_type: string | null
        }
        Insert: {
          association_type: Database["public"]["Enums"]["association_type"]
          birth_name?: string | null
          can_work_at_least_3h_daily?: boolean | null
          care_level?: Database["public"]["Enums"]["care_level_type"] | null
          commute_distance_km?: number | null
          created_at?: string
          date_of_birth?: string | null
          disability_application_pending?: boolean | null
          disability_valid_until?: string | null
          displaced_issued_by?: string | null
          displaced_issued_on?: string | null
          displaced_status?:
            | Database["public"]["Enums"]["displaced_status_type"]
            | null
          education_or_study_subject?: string | null
          employer_name?: string | null
          employment_office_customer_number?: string | null
          employment_status?: string | null
          first_name?: string | null
          has_applied_for_asylum_benefits?: boolean | null
          has_applied_for_sgb2_benefits?: boolean | null
          has_child_with_substantial_income?: boolean | null
          has_custodian?: boolean | null
          has_disability_id?: boolean | null
          has_guardian?: boolean | null
          has_inpatient_facility_accommodation?: boolean | null
          has_own_income?: boolean | null
          has_permanent_reduction_in_earning_capacity?: boolean | null
          has_received_previous_benefits?: boolean | null
          have_parents_substantial_joint_income?: boolean | null
          health_insurance_provider?: string | null
          health_insurance_status?:
            | Database["public"]["Enums"]["health_insurance_status_type"]
            | null
          id?: string
          id_document_issuing_authority?: string | null
          id_document_valid_until?: string | null
          inpatient_facility_assigned_from?: string | null
          inpatient_facility_assigned_until?: string | null
          inpatient_facility_last_residence?: string | null
          is_alimony_obligated?: boolean | null
          is_care_dependent?: boolean | null
          is_german_citizen?: boolean | null
          is_student_or_trainee?: boolean | null
          last_name?: string | null
          legal_gender?: Database["public"]["Enums"]["gender_type"] | null
          lives_in_household?: boolean
          marital_status?:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          merkzeichen?:
            | Database["public"]["Enums"]["disability_merkzeichen_type"]
            | null
          monthly_expenses_total?: number | null
          monthly_income?: number | null
          monthly_pension_income?: number | null
          nationality?: string | null
          pension_insurance_no?: string | null
          pension_insurance_provider?: string | null
          place_of_birth?: string | null
          previous_benefits_authority?: string | null
          previous_benefits_period?: string | null
          previous_benefits_ref_no?: string | null
          reduced_work_capacity_end_date?: string | null
          reduced_work_capacity_is_permanent?: boolean | null
          reduced_work_capacity_reason?: string | null
          reduced_work_capacity_start_date?: string | null
          relationship_to_applicant?: string | null
          second_nationality?: string | null
          social_security_type?:
            | Database["public"]["Enums"]["social_security_type_type"]
            | null
          sort_order?: number
          updated_at?: string
          user_id: string
          work_scope_and_type?: string | null
        }
        Update: {
          association_type?: Database["public"]["Enums"]["association_type"]
          birth_name?: string | null
          can_work_at_least_3h_daily?: boolean | null
          care_level?: Database["public"]["Enums"]["care_level_type"] | null
          commute_distance_km?: number | null
          created_at?: string
          date_of_birth?: string | null
          disability_application_pending?: boolean | null
          disability_valid_until?: string | null
          displaced_issued_by?: string | null
          displaced_issued_on?: string | null
          displaced_status?:
            | Database["public"]["Enums"]["displaced_status_type"]
            | null
          education_or_study_subject?: string | null
          employer_name?: string | null
          employment_office_customer_number?: string | null
          employment_status?: string | null
          first_name?: string | null
          has_applied_for_asylum_benefits?: boolean | null
          has_applied_for_sgb2_benefits?: boolean | null
          has_child_with_substantial_income?: boolean | null
          has_custodian?: boolean | null
          has_disability_id?: boolean | null
          has_guardian?: boolean | null
          has_inpatient_facility_accommodation?: boolean | null
          has_own_income?: boolean | null
          has_permanent_reduction_in_earning_capacity?: boolean | null
          has_received_previous_benefits?: boolean | null
          have_parents_substantial_joint_income?: boolean | null
          health_insurance_provider?: string | null
          health_insurance_status?:
            | Database["public"]["Enums"]["health_insurance_status_type"]
            | null
          id?: string
          id_document_issuing_authority?: string | null
          id_document_valid_until?: string | null
          inpatient_facility_assigned_from?: string | null
          inpatient_facility_assigned_until?: string | null
          inpatient_facility_last_residence?: string | null
          is_alimony_obligated?: boolean | null
          is_care_dependent?: boolean | null
          is_german_citizen?: boolean | null
          is_student_or_trainee?: boolean | null
          last_name?: string | null
          legal_gender?: Database["public"]["Enums"]["gender_type"] | null
          lives_in_household?: boolean
          marital_status?:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          merkzeichen?:
            | Database["public"]["Enums"]["disability_merkzeichen_type"]
            | null
          monthly_expenses_total?: number | null
          monthly_income?: number | null
          monthly_pension_income?: number | null
          nationality?: string | null
          pension_insurance_no?: string | null
          pension_insurance_provider?: string | null
          place_of_birth?: string | null
          previous_benefits_authority?: string | null
          previous_benefits_period?: string | null
          previous_benefits_ref_no?: string | null
          reduced_work_capacity_end_date?: string | null
          reduced_work_capacity_is_permanent?: boolean | null
          reduced_work_capacity_reason?: string | null
          reduced_work_capacity_start_date?: string | null
          relationship_to_applicant?: string | null
          second_nationality?: string | null
          social_security_type?:
            | Database["public"]["Enums"]["social_security_type_type"]
            | null
          sort_order?: number
          updated_at?: string
          user_id?: string
          work_scope_and_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "associated_persons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_claim_entries: {
        Row: {
          amount: number | null
          benefit_type: string | null
          claim_kind: Database["public"]["Enums"]["benefit_claim_kind"]
          created_at: string
          event_date: string | null
          id: string
          office_reference: string | null
          person_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          benefit_type?: string | null
          claim_kind: Database["public"]["Enums"]["benefit_claim_kind"]
          created_at?: string
          event_date?: string | null
          id?: string
          office_reference?: string | null
          person_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          benefit_type?: string | null
          claim_kind?: Database["public"]["Enums"]["benefit_claim_kind"]
          created_at?: string
          event_date?: string | null
          id?: string
          office_reference?: string | null
          person_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_claim_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "associated_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_claim_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      berlin_addresses: {
        Row: {
          bez_name: string
          hnr: string
          id: number
          plz: string
          street: string
        }
        Insert: {
          bez_name: string
          hnr: string
          id?: number
          plz: string
          street: string
        }
        Update: {
          bez_name?: string
          hnr?: string
          id?: number
          plz?: string
          street?: string
        }
        Relationships: []
      }
      cms_tutorials: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          slug: string
          sort_order: number
          subtitle: Json
          title: Json
          updated_at: string | null
        }
        Insert: {
          content?: Json
          created_at?: string | null
          id?: string
          slug: string
          sort_order?: number
          subtitle?: Json
          title?: Json
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          slug?: string
          sort_order?: number
          subtitle?: Json
          title?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string | null
          created_at: string | null
          fk_conversation_id: string
          id: string
          message_metadata: Json | null
          message_role: Database["public"]["Enums"]["chat_message_role_type"]
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          fk_conversation_id: string
          id?: string
          message_metadata?: Json | null
          message_role: Database["public"]["Enums"]["chat_message_role_type"]
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          fk_conversation_id?: string
          id?: string
          message_metadata?: Json | null
          message_role?: Database["public"]["Enums"]["chat_message_role_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_fk_conversation_id_fkey"
            columns: ["fk_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          application_type: string | null
          created_at: string | null
          fk_user_id: string
          id: string
          status: Database["public"]["Enums"]["conversation_status_type"]
          updated_at: string | null
        }
        Insert: {
          application_type?: string | null
          created_at?: string | null
          fk_user_id: string
          id?: string
          status?: Database["public"]["Enums"]["conversation_status_type"]
          updated_at?: string | null
        }
        Update: {
          application_type?: string | null
          created_at?: string | null
          fk_user_id?: string
          id?: string
          status?: Database["public"]["Enums"]["conversation_status_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_fk_user_id_fkey"
            columns: ["fk_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_entries: {
        Row: {
          created_at: string
          expense_type: Database["public"]["Enums"]["expense_type"]
          id: string
          monthly_amount: number | null
          note: string | null
          person_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expense_type: Database["public"]["Enums"]["expense_type"]
          id?: string
          monthly_amount?: number | null
          note?: string | null
          person_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expense_type?: Database["public"]["Enums"]["expense_type"]
          id?: string
          monthly_amount?: number | null
          note?: string | null
          person_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "associated_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      income_entries: {
        Row: {
          awarding_office: string | null
          created_at: string
          id: string
          income_type: Database["public"]["Enums"]["income_type"]
          monthly_amount: number | null
          person_id: string | null
          reference_no: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          awarding_office?: string | null
          created_at?: string
          id?: string
          income_type: Database["public"]["Enums"]["income_type"]
          monthly_amount?: number | null
          person_id?: string | null
          reference_no?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          awarding_office?: string | null
          created_at?: string
          id?: string
          income_type?: Database["public"]["Enums"]["income_type"]
          monthly_amount?: number | null
          person_id?: string | null
          reference_no?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "associated_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          applied_at: string | null
          filename: string
          id: number
          status: string
        }
        Insert: {
          applied_at?: string | null
          filename: string
          id?: number
          status: string
        }
        Update: {
          applied_at?: string | null
          filename?: string
          id?: number
          status?: string
        }
        Relationships: []
      }
      uploaded_files: {
        Row: {
          bucket_name: string
          created_at: string | null
          id: string
          name: string
          object_name: string
          updated_at: string | null
        }
        Insert: {
          bucket_name: string
          created_at?: string | null
          id?: string
          name: string
          object_name: string
          updated_at?: string | null
        }
        Update: {
          bucket_name?: string
          created_at?: string | null
          id?: string
          name?: string
          object_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_applications: {
        Row: {
          application_id: string
          created_at: string | null
          fk_user_id: string
          form_data: Json | null
          form_type: string
          last_reminded_at: string | null
          status: Database["public"]["Enums"]["status_type"] | null
          updated_at: string | null
        }
        Insert: {
          application_id: string
          created_at?: string | null
          fk_user_id: string
          form_data?: Json | null
          form_type: string
          last_reminded_at?: string | null
          status?: Database["public"]["Enums"]["status_type"] | null
          updated_at?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string | null
          fk_user_id?: string
          form_data?: Json | null
          form_type?: string
          last_reminded_at?: string | null
          status?: Database["public"]["Enums"]["status_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_applications_fk_user_id_fkey"
            columns: ["fk_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_documents: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          document_id: string
          document_type: string
          fk_application_id: string
          fk_file_id: string | null
          fk_user_id: string
          internal_error_log: string | null
          raw_data: Json | null
          status: Database["public"]["Enums"]["document_status_type"]
          updated_at: string | null
          user_error_code: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          document_id?: string
          document_type: string
          fk_application_id: string
          fk_file_id?: string | null
          fk_user_id: string
          internal_error_log?: string | null
          raw_data?: Json | null
          status?: Database["public"]["Enums"]["document_status_type"]
          updated_at?: string | null
          user_error_code?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          document_id?: string
          document_type?: string
          fk_application_id?: string
          fk_file_id?: string | null
          fk_user_id?: string
          internal_error_log?: string | null
          raw_data?: Json | null
          status?: Database["public"]["Enums"]["document_status_type"]
          updated_at?: string | null
          user_error_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_documents_fk_application_id_fkey"
            columns: ["fk_application_id"]
            isOneToOne: false
            referencedRelation: "user_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "user_documents_fk_file_id_fkey"
            columns: ["fk_file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_documents_fk_user_id_fkey"
            columns: ["fk_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tutorial_states: {
        Row: {
          current_step: string | null
          status: Database["public"]["Enums"]["tutorial_status_type"]
          tutorial_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_step?: string | null
          status?: Database["public"]["Enums"]["tutorial_status_type"]
          tutorial_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_step?: string | null
          status?: Database["public"]["Enums"]["tutorial_status_type"]
          tutorial_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tutorial_states_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "cms_tutorials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tutorial_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          ability_to_work:
            | Database["public"]["Enums"]["ability_to_work_type"]
            | null
          accomodation_type:
            | Database["public"]["Enums"]["accomodation_type"]
            | null
          account_holder: string | null
          apartment_floor_location: string | null
          are_one_time_payments_expected: boolean | null
          assets_description: string | null
          assets_exceed_wohngeld_threshold: boolean | null
          authentik_id: string | null
          bank_name: string | null
          benefits_awaiting_decision_application_date: string | null
          benefits_awaiting_decision_office: string | null
          benefits_awaiting_decision_reference: string | null
          benefits_awaiting_decision_type: string | null
          bic: string | null
          birth_name: string | null
          cable_tv_costs: number | null
          can_work_at_least_3h_daily: boolean | null
          care_level: Database["public"]["Enums"]["care_level_type"] | null
          city: string | null
          commercially_used_area_sqm: number | null
          commute_distance_km: number | null
          consents_to_bank_statement_retention: boolean | null
          consents_to_registry_verification: boolean | null
          created_at: string
          date_of_birth: string | null
          demo_seed_fixture_hash: string | null
          disability_application_pending: boolean | null
          disability_valid_until: string | null
          displaced_issued_by: string | null
          displaced_issued_on: string | null
          displaced_status:
            | Database["public"]["Enums"]["displaced_status_type"]
            | null
          district: string | null
          education_or_study_subject: string | null
          email: string | null
          employer_name: string | null
          employment_office_customer_number: string | null
          expects_future_income_change: boolean | null
          expects_rent_change: boolean | null
          fcm_token: string | null
          first_name: string | null
          free_housing_right_holder: string | null
          garage_costs: number | null
          gave_away_assets_last_10_years: boolean | null
          gross_negligence_last_10_years: boolean | null
          has_applied_for_asylum_benefits: boolean | null
          has_applied_for_benefits_awaiting_decision: boolean | null
          has_assets: boolean | null
          has_child_with_substantial_income: boolean | null
          has_childcare_expenses: boolean | null
          has_costly_medical_nutrition: boolean | null
          has_custodian: boolean | null
          has_disability_id: boolean | null
          has_garage_costs: boolean | null
          has_guardian: boolean | null
          has_household_energy_costs: boolean | null
          has_inpatient_facility_accommodation: boolean | null
          has_other_residence: boolean | null
          has_permanent_reduction_in_earning_capacity: boolean | null
          has_received_previous_benefits: boolean | null
          has_secondary_residence: boolean | null
          have_parents_substantial_joint_income: boolean | null
          health_insurance_provider: string | null
          health_insurance_status:
            | Database["public"]["Enums"]["health_insurance_status_type"]
            | null
          heating_costs: number | null
          heating_type: string | null
          hot_water_costs: number | null
          house_number: string | null
          household_energy_costs: number | null
          household_member_died_recently: boolean | null
          household_size_will_change: boolean | null
          iban: string | null
          id: string
          identification_numbers: string | null
          inpatient_facility_assigned_until: string | null
          inpatient_facility_last_residence: string | null
          inpatient_facility_move_in_date: string | null
          is_care_dependent: boolean | null
          is_currently_employed: boolean | null
          is_german_citizen: boolean | null
          is_living_area_used_commercially: boolean | null
          is_resident_in_germany: boolean | null
          is_student_or_trainee: boolean | null
          is_subsidized_housing: boolean | null
          is_victim_of_national_socialist_persecution: boolean | null
          is_wohngeld_first_application: boolean | null
          landlord_address: string | null
          landlord_name: string | null
          last_name: string | null
          legal_gender: Database["public"]["Enums"]["gender_type"] | null
          license_plate: string | null
          living_area: number | null
          main_tenant_name: string | null
          marital_status:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          married_since: string | null
          merkzeichen:
            | Database["public"]["Enums"]["disability_merkzeichen_type"]
            | null
          monthly_expenses_total: number | null
          monthly_income: number | null
          nationality: string | null
          number_of_rooms: number | null
          one_time_payments_expected_amount: number | null
          one_time_payments_expected_date: string | null
          one_time_payments_expected_type: string | null
          pays_child_or_spousal_support: boolean | null
          pension_insurance_no: string | null
          pension_insurance_provider: string | null
          persons_in_household_count: number | null
          phone_number: string | null
          place_of_birth: string | null
          previous_address: string | null
          previous_benefits_authority: string | null
          previous_benefits_period: string | null
          previous_benefits_ref_no: string | null
          professional_expenses: number | null
          receives_other_transfer_benefits: boolean | null
          receives_rent_contribution_from_others: boolean | null
          receives_support_from_others: boolean | null
          receives_wohngeld_for_other_dwelling: boolean | null
          reduced_work_capacity_end_date: string | null
          reduced_work_capacity_reason: string | null
          reduced_work_capacity_start_date: string | null
          related_to_landlord: boolean | null
          rent_arrears_amount: number | null
          rent_arrears_period: string | null
          rent_paid_partly_by_third_party: boolean | null
          rent_paid_until: string | null
          rent_total: number | null
          residence_status: string | null
          resident_in_berlin_since: string | null
          resident_in_district_since: string | null
          second_nationality: string | null
          service_costs_included_in_rent: boolean | null
          social_security_type:
            | Database["public"]["Enums"]["social_security_type_type"]
            | null
          state: string | null
          street: string | null
          sublet_rent_income: number | null
          sublet_room_count: number | null
          sublet_unrentable_reason: string | null
          tax_id: string | null
          tenancy_status:
            | Database["public"]["Enums"]["tenancy_status_type"]
            | null
          tenancy_terminated_on: string | null
          updated_at: string
          vehicle_make: string | null
          vehicle_year: string | null
          wohngeld_payment_to_applicant: boolean | null
          work_scope_and_type: string | null
          zip_code: string | null
        }
        Insert: {
          ability_to_work?:
            | Database["public"]["Enums"]["ability_to_work_type"]
            | null
          accomodation_type?:
            | Database["public"]["Enums"]["accomodation_type"]
            | null
          account_holder?: string | null
          apartment_floor_location?: string | null
          are_one_time_payments_expected?: boolean | null
          assets_description?: string | null
          assets_exceed_wohngeld_threshold?: boolean | null
          authentik_id?: string | null
          bank_name?: string | null
          benefits_awaiting_decision_application_date?: string | null
          benefits_awaiting_decision_office?: string | null
          benefits_awaiting_decision_reference?: string | null
          benefits_awaiting_decision_type?: string | null
          bic?: string | null
          birth_name?: string | null
          cable_tv_costs?: number | null
          can_work_at_least_3h_daily?: boolean | null
          care_level?: Database["public"]["Enums"]["care_level_type"] | null
          city?: string | null
          commercially_used_area_sqm?: number | null
          commute_distance_km?: number | null
          consents_to_bank_statement_retention?: boolean | null
          consents_to_registry_verification?: boolean | null
          created_at?: string
          date_of_birth?: string | null
          demo_seed_fixture_hash?: string | null
          disability_application_pending?: boolean | null
          disability_valid_until?: string | null
          displaced_issued_by?: string | null
          displaced_issued_on?: string | null
          displaced_status?:
            | Database["public"]["Enums"]["displaced_status_type"]
            | null
          district?: string | null
          education_or_study_subject?: string | null
          email?: string | null
          employer_name?: string | null
          employment_office_customer_number?: string | null
          expects_future_income_change?: boolean | null
          expects_rent_change?: boolean | null
          fcm_token?: string | null
          first_name?: string | null
          free_housing_right_holder?: string | null
          garage_costs?: number | null
          gave_away_assets_last_10_years?: boolean | null
          gross_negligence_last_10_years?: boolean | null
          has_applied_for_asylum_benefits?: boolean | null
          has_applied_for_benefits_awaiting_decision?: boolean | null
          has_assets?: boolean | null
          has_child_with_substantial_income?: boolean | null
          has_childcare_expenses?: boolean | null
          has_costly_medical_nutrition?: boolean | null
          has_custodian?: boolean | null
          has_disability_id?: boolean | null
          has_garage_costs?: boolean | null
          has_guardian?: boolean | null
          has_household_energy_costs?: boolean | null
          has_inpatient_facility_accommodation?: boolean | null
          has_other_residence?: boolean | null
          has_permanent_reduction_in_earning_capacity?: boolean | null
          has_received_previous_benefits?: boolean | null
          has_secondary_residence?: boolean | null
          have_parents_substantial_joint_income?: boolean | null
          health_insurance_provider?: string | null
          health_insurance_status?:
            | Database["public"]["Enums"]["health_insurance_status_type"]
            | null
          heating_costs?: number | null
          heating_type?: string | null
          hot_water_costs?: number | null
          house_number?: string | null
          household_energy_costs?: number | null
          household_member_died_recently?: boolean | null
          household_size_will_change?: boolean | null
          iban?: string | null
          id?: string
          identification_numbers?: string | null
          inpatient_facility_assigned_until?: string | null
          inpatient_facility_last_residence?: string | null
          inpatient_facility_move_in_date?: string | null
          is_care_dependent?: boolean | null
          is_currently_employed?: boolean | null
          is_german_citizen?: boolean | null
          is_living_area_used_commercially?: boolean | null
          is_resident_in_germany?: boolean | null
          is_student_or_trainee?: boolean | null
          is_subsidized_housing?: boolean | null
          is_victim_of_national_socialist_persecution?: boolean | null
          is_wohngeld_first_application?: boolean | null
          landlord_address?: string | null
          landlord_name?: string | null
          last_name?: string | null
          legal_gender?: Database["public"]["Enums"]["gender_type"] | null
          license_plate?: string | null
          living_area?: number | null
          main_tenant_name?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          married_since?: string | null
          merkzeichen?:
            | Database["public"]["Enums"]["disability_merkzeichen_type"]
            | null
          monthly_expenses_total?: number | null
          monthly_income?: number | null
          nationality?: string | null
          number_of_rooms?: number | null
          one_time_payments_expected_amount?: number | null
          one_time_payments_expected_date?: string | null
          one_time_payments_expected_type?: string | null
          pays_child_or_spousal_support?: boolean | null
          pension_insurance_no?: string | null
          pension_insurance_provider?: string | null
          persons_in_household_count?: number | null
          phone_number?: string | null
          place_of_birth?: string | null
          previous_address?: string | null
          previous_benefits_authority?: string | null
          previous_benefits_period?: string | null
          previous_benefits_ref_no?: string | null
          professional_expenses?: number | null
          receives_other_transfer_benefits?: boolean | null
          receives_rent_contribution_from_others?: boolean | null
          receives_support_from_others?: boolean | null
          receives_wohngeld_for_other_dwelling?: boolean | null
          reduced_work_capacity_end_date?: string | null
          reduced_work_capacity_reason?: string | null
          reduced_work_capacity_start_date?: string | null
          related_to_landlord?: boolean | null
          rent_arrears_amount?: number | null
          rent_arrears_period?: string | null
          rent_paid_partly_by_third_party?: boolean | null
          rent_paid_until?: string | null
          rent_total?: number | null
          residence_status?: string | null
          resident_in_berlin_since?: string | null
          resident_in_district_since?: string | null
          second_nationality?: string | null
          service_costs_included_in_rent?: boolean | null
          social_security_type?:
            | Database["public"]["Enums"]["social_security_type_type"]
            | null
          state?: string | null
          street?: string | null
          sublet_rent_income?: number | null
          sublet_room_count?: number | null
          sublet_unrentable_reason?: string | null
          tax_id?: string | null
          tenancy_status?:
            | Database["public"]["Enums"]["tenancy_status_type"]
            | null
          tenancy_terminated_on?: string | null
          updated_at?: string
          vehicle_make?: string | null
          vehicle_year?: string | null
          wohngeld_payment_to_applicant?: boolean | null
          work_scope_and_type?: string | null
          zip_code?: string | null
        }
        Update: {
          ability_to_work?:
            | Database["public"]["Enums"]["ability_to_work_type"]
            | null
          accomodation_type?:
            | Database["public"]["Enums"]["accomodation_type"]
            | null
          account_holder?: string | null
          apartment_floor_location?: string | null
          are_one_time_payments_expected?: boolean | null
          assets_description?: string | null
          assets_exceed_wohngeld_threshold?: boolean | null
          authentik_id?: string | null
          bank_name?: string | null
          benefits_awaiting_decision_application_date?: string | null
          benefits_awaiting_decision_office?: string | null
          benefits_awaiting_decision_reference?: string | null
          benefits_awaiting_decision_type?: string | null
          bic?: string | null
          birth_name?: string | null
          cable_tv_costs?: number | null
          can_work_at_least_3h_daily?: boolean | null
          care_level?: Database["public"]["Enums"]["care_level_type"] | null
          city?: string | null
          commercially_used_area_sqm?: number | null
          commute_distance_km?: number | null
          consents_to_bank_statement_retention?: boolean | null
          consents_to_registry_verification?: boolean | null
          created_at?: string
          date_of_birth?: string | null
          demo_seed_fixture_hash?: string | null
          disability_application_pending?: boolean | null
          disability_valid_until?: string | null
          displaced_issued_by?: string | null
          displaced_issued_on?: string | null
          displaced_status?:
            | Database["public"]["Enums"]["displaced_status_type"]
            | null
          district?: string | null
          education_or_study_subject?: string | null
          email?: string | null
          employer_name?: string | null
          employment_office_customer_number?: string | null
          expects_future_income_change?: boolean | null
          expects_rent_change?: boolean | null
          fcm_token?: string | null
          first_name?: string | null
          free_housing_right_holder?: string | null
          garage_costs?: number | null
          gave_away_assets_last_10_years?: boolean | null
          gross_negligence_last_10_years?: boolean | null
          has_applied_for_asylum_benefits?: boolean | null
          has_applied_for_benefits_awaiting_decision?: boolean | null
          has_assets?: boolean | null
          has_child_with_substantial_income?: boolean | null
          has_childcare_expenses?: boolean | null
          has_costly_medical_nutrition?: boolean | null
          has_custodian?: boolean | null
          has_disability_id?: boolean | null
          has_garage_costs?: boolean | null
          has_guardian?: boolean | null
          has_household_energy_costs?: boolean | null
          has_inpatient_facility_accommodation?: boolean | null
          has_other_residence?: boolean | null
          has_permanent_reduction_in_earning_capacity?: boolean | null
          has_received_previous_benefits?: boolean | null
          has_secondary_residence?: boolean | null
          have_parents_substantial_joint_income?: boolean | null
          health_insurance_provider?: string | null
          health_insurance_status?:
            | Database["public"]["Enums"]["health_insurance_status_type"]
            | null
          heating_costs?: number | null
          heating_type?: string | null
          hot_water_costs?: number | null
          house_number?: string | null
          household_energy_costs?: number | null
          household_member_died_recently?: boolean | null
          household_size_will_change?: boolean | null
          iban?: string | null
          id?: string
          identification_numbers?: string | null
          inpatient_facility_assigned_until?: string | null
          inpatient_facility_last_residence?: string | null
          inpatient_facility_move_in_date?: string | null
          is_care_dependent?: boolean | null
          is_currently_employed?: boolean | null
          is_german_citizen?: boolean | null
          is_living_area_used_commercially?: boolean | null
          is_resident_in_germany?: boolean | null
          is_student_or_trainee?: boolean | null
          is_subsidized_housing?: boolean | null
          is_victim_of_national_socialist_persecution?: boolean | null
          is_wohngeld_first_application?: boolean | null
          landlord_address?: string | null
          landlord_name?: string | null
          last_name?: string | null
          legal_gender?: Database["public"]["Enums"]["gender_type"] | null
          license_plate?: string | null
          living_area?: number | null
          main_tenant_name?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          married_since?: string | null
          merkzeichen?:
            | Database["public"]["Enums"]["disability_merkzeichen_type"]
            | null
          monthly_expenses_total?: number | null
          monthly_income?: number | null
          nationality?: string | null
          number_of_rooms?: number | null
          one_time_payments_expected_amount?: number | null
          one_time_payments_expected_date?: string | null
          one_time_payments_expected_type?: string | null
          pays_child_or_spousal_support?: boolean | null
          pension_insurance_no?: string | null
          pension_insurance_provider?: string | null
          persons_in_household_count?: number | null
          phone_number?: string | null
          place_of_birth?: string | null
          previous_address?: string | null
          previous_benefits_authority?: string | null
          previous_benefits_period?: string | null
          previous_benefits_ref_no?: string | null
          professional_expenses?: number | null
          receives_other_transfer_benefits?: boolean | null
          receives_rent_contribution_from_others?: boolean | null
          receives_support_from_others?: boolean | null
          receives_wohngeld_for_other_dwelling?: boolean | null
          reduced_work_capacity_end_date?: string | null
          reduced_work_capacity_reason?: string | null
          reduced_work_capacity_start_date?: string | null
          related_to_landlord?: boolean | null
          rent_arrears_amount?: number | null
          rent_arrears_period?: string | null
          rent_paid_partly_by_third_party?: boolean | null
          rent_paid_until?: string | null
          rent_total?: number | null
          residence_status?: string | null
          resident_in_berlin_since?: string | null
          resident_in_district_since?: string | null
          second_nationality?: string | null
          service_costs_included_in_rent?: boolean | null
          social_security_type?:
            | Database["public"]["Enums"]["social_security_type_type"]
            | null
          state?: string | null
          street?: string | null
          sublet_rent_income?: number | null
          sublet_room_count?: number | null
          sublet_unrentable_reason?: string | null
          tax_id?: string | null
          tenancy_status?:
            | Database["public"]["Enums"]["tenancy_status_type"]
            | null
          tenancy_terminated_on?: string | null
          updated_at?: string
          vehicle_make?: string | null
          vehicle_year?: string | null
          wohngeld_payment_to_applicant?: boolean | null
          work_scope_and_type?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recompute_monthly_expenses_total: {
        Args: { p_person_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      ability_to_work_type:
        | "Fully able"
        | "Temporarily disabled"
        | "Permanently disabled"
      accomodation_type:
        | "Rental Apartment"
        | "Own Home"
        | "Condominium"
        | "Relative"
        | "Shared Household"
      asset_type:
        | "Savings and Cash"
        | "Securities"
        | "Valuables"
        | "Gifted Assets"
        | "Motor Vehicle"
        | "Real Estate"
        | "Subsidised Private Pension"
        | "Transfer Contract Claims"
        | "Other Assets"
      association_type:
        | "Spouse"
        | "Registered Partner"
        | "Cohabiting Partner"
        | "Child"
        | "Parent"
        | "Other Relative"
        | "Other"
      benefit_claim_kind: "Pending Application" | "Expected One-Time Payment"
      care_level_type:
        | "Pflegegrad 1"
        | "Pflegegrad 2"
        | "Pflegegrad 3"
        | "Pflegegrad 4"
        | "Pflegegrad 5"
      chat_message_role_type: "user" | "assistant" | "system" | "tool"
      conversation_status_type: "in_progress" | "closed"
      disability_merkzeichen_type:
        | "G"
        | "aG"
        | "H"
        | "B"
        | "Bl"
        | "Gl"
        | "TBl"
        | "RF"
        | "1 Kl"
        | "EB"
        | "VB"
        | "T"
      displaced_status_type:
        | "Expellee (Resettler)"
        | "Displaced Person (Resettler)"
        | "Late Resettler"
        | "Spouse or Descendant of a Late Resettler"
        | "Soviet Zone Refugee"
      document_status_type:
        | "processing"
        | "completed"
        | "failed"
        | "ready_for_review"
        | "verified"
      expense_type:
        | "Income Tax"
        | "Health Insurance"
        | "Care Insurance"
        | "Unemployment Insurance"
        | "Pension Insurance"
        | "Church Tax"
        | "Accident Insurance"
        | "Retirement Provision"
        | "Household Contents Insurance"
        | "Funeral Insurance"
        | "Life Insurance"
        | "Liability Insurance"
        | "Work Equipment"
        | "Professional Association Fees"
        | "Double Household"
        | "Commute Public Transport"
        | "Commute Car"
        | "Commute Small Car"
        | "Commute Motorcycle"
        | "Commute Moped"
        | "Commute Other"
      gender_type: "Male" | "Female" | "Diverse"
      health_insurance_status_type:
        | "Compulsory Insurance"
        | "Voluntary Insurance"
        | "Family Insurance"
        | "Private Insurance"
        | "Care by Health Funds under § 264 SGB V"
      income_type:
        | "Employment"
        | "Health Insurance Benefits"
        | "Business"
        | "Agriculture and Forestry"
        | "Other Self-Employment"
        | "Rental and Leasing"
        | "Housing Benefit"
        | "Pension"
        | "Social Assistance"
        | "Basic Security Benefits"
        | "Asylum Seeker Benefits"
        | "Federal War Victims Relief"
        | "Equalisation of Burdens"
        | "Employment Agency Benefits"
        | "Child Benefit"
        | "Child Benefit Supplement"
        | "Parental Allowance"
        | "Education Grant"
        | "Alimony"
        | "Alimony Advance"
        | "Private Monetary Claims"
        | "Tax Refund"
        | "Capital Income"
        | "Other Income"
      marital_status_type:
        | "Single"
        | "Married"
        | "Cohabiting"
        | "Permanently Separated"
        | "Registered Civil Partnership"
        | "Divorced"
        | "Widowed"
      social_security_type_type:
        | "None"
        | "Pension Insurance"
        | "Long-term Care Insurance"
      status_type: "in_progress" | "completed" | "submitted"
      tenancy_status_type: "Main Tenant" | "Subtenant"
      tutorial_status_type: "in_progress" | "completed"
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
      ability_to_work_type: [
        "Fully able",
        "Temporarily disabled",
        "Permanently disabled",
      ],
      accomodation_type: [
        "Rental Apartment",
        "Own Home",
        "Condominium",
        "Relative",
        "Shared Household",
      ],
      asset_type: [
        "Savings and Cash",
        "Securities",
        "Valuables",
        "Gifted Assets",
        "Motor Vehicle",
        "Real Estate",
        "Subsidised Private Pension",
        "Transfer Contract Claims",
        "Other Assets",
      ],
      association_type: [
        "Spouse",
        "Registered Partner",
        "Cohabiting Partner",
        "Child",
        "Parent",
        "Other Relative",
        "Other",
      ],
      benefit_claim_kind: ["Pending Application", "Expected One-Time Payment"],
      care_level_type: [
        "Pflegegrad 1",
        "Pflegegrad 2",
        "Pflegegrad 3",
        "Pflegegrad 4",
        "Pflegegrad 5",
      ],
      chat_message_role_type: ["user", "assistant", "system", "tool"],
      conversation_status_type: ["in_progress", "closed"],
      disability_merkzeichen_type: [
        "G",
        "aG",
        "H",
        "B",
        "Bl",
        "Gl",
        "TBl",
        "RF",
        "1 Kl",
        "EB",
        "VB",
        "T",
      ],
      displaced_status_type: [
        "Expellee (Resettler)",
        "Displaced Person (Resettler)",
        "Late Resettler",
        "Spouse or Descendant of a Late Resettler",
        "Soviet Zone Refugee",
      ],
      document_status_type: [
        "processing",
        "completed",
        "failed",
        "ready_for_review",
        "verified",
      ],
      expense_type: [
        "Income Tax",
        "Health Insurance",
        "Care Insurance",
        "Unemployment Insurance",
        "Pension Insurance",
        "Church Tax",
        "Accident Insurance",
        "Retirement Provision",
        "Household Contents Insurance",
        "Funeral Insurance",
        "Life Insurance",
        "Liability Insurance",
        "Work Equipment",
        "Professional Association Fees",
        "Double Household",
        "Commute Public Transport",
        "Commute Car",
        "Commute Small Car",
        "Commute Motorcycle",
        "Commute Moped",
        "Commute Other",
      ],
      gender_type: ["Male", "Female", "Diverse"],
      health_insurance_status_type: [
        "Compulsory Insurance",
        "Voluntary Insurance",
        "Family Insurance",
        "Private Insurance",
        "Care by Health Funds under § 264 SGB V",
      ],
      income_type: [
        "Employment",
        "Health Insurance Benefits",
        "Business",
        "Agriculture and Forestry",
        "Other Self-Employment",
        "Rental and Leasing",
        "Housing Benefit",
        "Pension",
        "Social Assistance",
        "Basic Security Benefits",
        "Asylum Seeker Benefits",
        "Federal War Victims Relief",
        "Equalisation of Burdens",
        "Employment Agency Benefits",
        "Child Benefit",
        "Child Benefit Supplement",
        "Parental Allowance",
        "Education Grant",
        "Alimony",
        "Alimony Advance",
        "Private Monetary Claims",
        "Tax Refund",
        "Capital Income",
        "Other Income",
      ],
      marital_status_type: [
        "Single",
        "Married",
        "Cohabiting",
        "Permanently Separated",
        "Registered Civil Partnership",
        "Divorced",
        "Widowed",
      ],
      social_security_type_type: [
        "None",
        "Pension Insurance",
        "Long-term Care Insurance",
      ],
      status_type: ["in_progress", "completed", "submitted"],
      tenancy_status_type: ["Main Tenant", "Subtenant"],
      tutorial_status_type: ["in_progress", "completed"],
    },
  },
} as const

