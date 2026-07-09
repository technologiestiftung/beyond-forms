```mermaid
flowchart TD
    step_eligibility_nationality["Nationality & Residence Status"]
    step_eligibility_residence["Place of Residence"]
    step_eligibility_dob["Date of Birth"]
    step_eligibility_pension["Pension Status"]
    step_eligibility_income["Income Assessment"]
    step_eligibility_assets["Asset Assessment"]
    step_applicant_basics["Personal Details"]
    step_marital_status["Marital Status"]
    step_marital_status_since["Since when does this marital status exist?"]
    step_citizenship["Citizenship"]
    step_personal_documents["ID Documents"]
    step_applicant_legal_support["Legal Support & Guardianship"]
    step_applicant_displaced_status["Displaced Status"]
    step_applicant_displaced_details["Displaced Status Details"]
    step_applicant_severely_disabled["Severely Disabled Pass"]
    step_applicant_severely_disabled_details["Severely Disabled Pass Details"]
    step_applicant_insurance["Insurance Details"]
    step_previous_benefits["Have you received benefits before?"]
    step_previous_benefits_details["Previous Benefits Details"]
    step_partner_check["Do you live with a partner in the same household?"]
    step_partner_basics["Partner's Personal Details"]
    step_partner_citizenship["Partner's Citizenship"]
    step_partner_documents["Partner's ID Documents"]
    step_partner_legal_support["Partner's Legal Support & Guardianship"]
    step_partner_displaced_status["Partner's Displaced Status"]
    step_partner_displaced_details["Partner's Displaced Status Details"]
    step_partner_severely_disabled["Partner's Severely Disabled Pass"]
    step_partner_severely_disabled_details["Partner's Severely Disabled Pass Details"]
    step_partner_insurance["Partner's Insurance Details"]
    step_partner_previous_benefits["Has your partner received benefits before?"]
    step_partner_previous_benefits_details["Partner's Previous Benefits Details"]
    step_applicant_employment["Are you currently employed?"]
    step_applicant_employment_details["Employment Details"]
    step_applicant_work_capacity["Work Capacity"]
    step_applicant_work_capacity_reason["Reason for Reduced Work Capacity"]
    step_applicant_reduced_earnings["Completely Reduced Earnings Capacity"]
    step_applicant_reduced_earnings_permanent["Is the reduced earnings capacity permanent?"]
    step_applicant_reduced_earnings_period["Period of Reduced Earnings Capacity"]
    step_applicant_care_dependency["Care Dependency"]
    step_applicant_care_dependency_level["Care Dependency Level"]
    step_applicant_education["Education / Training"]
    step_applicant_education_details["Education / Training Details"]
    step_applicant_stationary_facility["Stationary Facility"]
    step_applicant_stationary_facility_dates["Stationary Facility Dates"]
    step_applicant_sgb2["SGB II Benefits"]
    step_partner_employment["Is your partner currently employed?"]
    step_partner_employment_details["Partner's Employment Details"]
    step_partner_work_capacity["Partner's Work Capacity"]
    step_partner_work_capacity_reason["Reason for Partner's Reduced Work Capacity"]
    step_partner_reduced_earnings["Partner's Completely Reduced Earnings Capacity"]
    step_partner_reduced_earnings_permanent["Is the partner's reduced earnings capacity permanent?"]
    step_partner_reduced_earnings_period["Period of Partner's Reduced Earnings Capacity"]
    step_partner_care_dependency["Partner's Care Dependency"]
    step_partner_care_dependency_level["Partner's Care Dependency Level"]
    step_partner_education["Partner's Education / Training"]
    step_partner_education_details["Partner's Education / Training Details"]
    step_partner_stationary_facility["Partner's Stationary Facility"]
    step_partner_stationary_facility_dates["Partner's Stationary Facility Dates"]
    step_partner_sgb2["Partner's SGB II Benefits"]
    step_applicant_bank_details["Bank Details"]
    step_applicant_residence["Current Residence"]
    step_applicant_accommodation_type["Accommodation Type"]
    step_applicant_rental_details["Rental Details"]
    step_applicant_accommodation_costs["Accommodation Costs"]
    step_applicant_accommodation_details["Accommodation Details"]
    step_applicant_heating["Heating Type"]
    step_applicant_sublet["Subletting"]
    step_applicant_sublet_details["Sublet Details"]
    step_applicant_sublet_impossible_reason["Reason Subletting is Not Possible"]
    step_applicant_accommodation_issues["Accommodation Issues"]
    step_other_people_in_household["Other People in Household"]
    step_household_members_count["Number of Other Household Members"]
    step_household_member_1["Person 3"]
    step_household_member_2["Person 4"]
    step_household_member_3["Person 5"]
    step_household_member_4["Person 6"]
    step_household_member_5["Person 7"]
    step_household_member_6["Person 8"]
    step_household_member_7["Person 9"]
    step_household_member_8["Person 10"]
    step_household_member_9["Person 11"]
    step_household_member_10["Person 12"]
    step_alimony_liable_people["Relatives Liable for Alimony"]
    step_alimony_liable_details["Alimony Details"]
    step_applicant_income_work["Income from Work"]
    step_applicant_income_benefits["Income from Benefits & Pensions"]
    step_applicant_income_other["Other Income"]
    step_applicant_benefits_awaiting_decision["Pending Benefits"]
    step_applicant_benefits_awaiting_decision_details["Pending Benefits Details"]
    step_applicant_expected_payments["Expected One-Time Payments"]
    step_applicant_expected_payments_details["Expected Payment Details"]
    step_applicant_assets_savings["Savings & Valuables"]
    step_applicant_assets_vehicles["Vehicles"]
    step_applicant_assets_vehicles_details["Vehicle Details"]
    step_applicant_assets_property_and_other["Property & Other Assets"]
    step_partner_income_work["Partner's Income from Work"]
    step_partner_income_benefits["Partner's Income from Benefits & Pensions"]
    step_partner_income_other["Partner's Other Income"]
    step_partner_benefits_awaiting_decision["Partner's Pending Benefits"]
    step_partner_benefits_awaiting_decision_details["Partner's Pending Benefits Details"]
    step_partner_expected_payments["Partner's Expected One-Time Payments"]
    step_partner_expected_payments_details["Partner's Expected Payment Details"]
    step_partner_assets_savings["Partner's Savings & Valuables"]
    step_partner_assets_vehicles["Partner's Vehicles"]
    step_partner_assets_vehicles_details["Partner's Vehicle Details"]
    step_partner_assets_property_and_other["Partner's Property & Other Assets"]
    step_special_needs_pregnancy["Pregnancy"]
    step_special_needs_pregnancy_details["Pregnancy Details"]
    step_special_needs_disability["Disability Benefits for Work Life"]
    step_special_needs_disability_details["Disability Details"]
    step_special_needs_nutrition["Costly Nutrition"]
    step_special_needs_nutrition_details["Costly Nutrition Details"]
    step_other_information["Other Information"]
    step_eligibility_nationality --> step_eligibility_residence
    step_eligibility_residence --> step_eligibility_dob
    step_eligibility_dob --> step_eligibility_pension
    step_eligibility_pension --> step_eligibility_income
    step_eligibility_income --> step_eligibility_assets
    step_eligibility_assets --> step_applicant_basics
    step_applicant_basics --> step_marital_status
    step_marital_status -- "applicant_information.applicant_marital_status in ['married', 'permanently_separated', 'divorced', 'widowed', 'registered_civil_partnership']" --> step_marital_status_since
    step_marital_status --> step_citizenship
    step_marital_status_since --> step_citizenship
    step_citizenship --> step_personal_documents
    step_personal_documents --> step_previous_benefits
    step_applicant_legal_support --> step_applicant_displaced_status
    step_applicant_displaced_status -- "$exists(applicant_information.applicant_displaced_status)" --> step_applicant_displaced_details
    step_applicant_displaced_status --> step_applicant_severely_disabled
    step_applicant_displaced_details --> step_applicant_severely_disabled
    step_applicant_severely_disabled -- "$exists(applicant_information.applicant_pass_for_severely_disabled_valid_until) or applicant_information.applicant_pass_for_severely_disabled_applied = true" --> step_applicant_severely_disabled_details
    step_applicant_severely_disabled --> step_applicant_insurance
    step_applicant_severely_disabled_details --> step_applicant_insurance
    step_applicant_insurance --> step_partner_check
    step_previous_benefits -- "applicant_information.has_applicant_received_benefits_before = true" --> step_previous_benefits_details
    step_previous_benefits --> step_applicant_legal_support
    step_previous_benefits_details --> step_applicant_legal_support
    step_partner_check -- "partner_information.is_partner_living_in_same_household = true" --> step_partner_basics
    step_partner_check --> step_applicant_employment
    step_partner_basics --> step_partner_citizenship
    step_partner_citizenship --> step_partner_documents
    step_partner_documents --> step_partner_previous_benefits
    step_partner_legal_support --> step_partner_displaced_status
    step_partner_displaced_status -- "$exists(partner_information.partner_displaced_status)" --> step_partner_displaced_details
    step_partner_displaced_status --> step_partner_severely_disabled
    step_partner_displaced_details --> step_partner_severely_disabled
    step_partner_severely_disabled -- "$exists(partner_information.partner_pass_for_severely_disabled_valid_until) or partner_information.partner_pass_for_severely_disabled_applied = true" --> step_partner_severely_disabled_details
    step_partner_severely_disabled --> step_partner_insurance
    step_partner_severely_disabled_details --> step_partner_insurance
    step_partner_insurance --> step_applicant_employment
    step_partner_previous_benefits -- "partner_information.has_partner_received_benefits_before = true" --> step_partner_previous_benefits_details
    step_partner_previous_benefits --> step_partner_legal_support
    step_partner_previous_benefits_details --> step_partner_legal_support
    step_applicant_employment -- "applicant_earning_capacity.is_applicant_employed = true" --> step_applicant_employment_details
    step_applicant_employment --> step_applicant_work_capacity
    step_applicant_employment_details --> step_applicant_work_capacity
    step_applicant_work_capacity -- "applicant_earning_capacity.applicant_work_capacity_at_least_3h_daily = false" --> step_applicant_work_capacity_reason
    step_applicant_work_capacity --> step_applicant_reduced_earnings
    step_applicant_work_capacity_reason --> step_applicant_reduced_earnings
    step_applicant_reduced_earnings -- "applicant_earning_capacity.has_applicant_completely_reduced_earnings_capacity = true" --> step_applicant_reduced_earnings_permanent
    step_applicant_reduced_earnings --> step_applicant_care_dependency
    step_applicant_reduced_earnings_permanent -- "applicant_earning_capacity.is_applicants_completely_reduced_earnings_capacity_permanent = false" --> step_applicant_reduced_earnings_period
    step_applicant_reduced_earnings_permanent --> step_applicant_care_dependency
    step_applicant_reduced_earnings_period --> step_applicant_care_dependency
    step_applicant_care_dependency -- "applicant_earning_capacity.is_applicant_care_dependent = true" --> step_applicant_care_dependency_level
    step_applicant_care_dependency --> step_applicant_education
    step_applicant_care_dependency_level --> step_applicant_education
    step_applicant_education -- "applicant_earning_capacity.is_applicant_a_student_or_trainee = true" --> step_applicant_education_details
    step_applicant_education --> step_applicant_stationary_facility
    step_applicant_education_details --> step_applicant_stationary_facility
    step_applicant_stationary_facility -- "applicant_earning_capacity.is_applicant_living_in_a_stationary_facility = true" --> step_applicant_stationary_facility_dates
    step_applicant_stationary_facility --> step_applicant_sgb2
    step_applicant_stationary_facility_dates --> step_applicant_sgb2
    step_applicant_sgb2 -- "partner_information.is_partner_living_in_same_household = false or applicant_information.applicant_marital_status in ['single', 'divorced', 'widowed', 'permanently_separated']" --> step_applicant_bank_details
    step_applicant_sgb2 --> step_partner_employment
    step_partner_employment -- "partner_earning_capacity.is_partner_employed = true" --> step_partner_employment_details
    step_partner_employment --> step_partner_work_capacity
    step_partner_employment_details --> step_partner_work_capacity
    step_partner_work_capacity -- "partner_earning_capacity.partner_work_capacity_at_least_3h_daily = false" --> step_partner_work_capacity_reason
    step_partner_work_capacity --> step_partner_reduced_earnings
    step_partner_work_capacity_reason --> step_partner_reduced_earnings
    step_partner_reduced_earnings -- "partner_earning_capacity.has_partner_completely_reduced_earnings_capacity = true" --> step_partner_reduced_earnings_permanent
    step_partner_reduced_earnings --> step_partner_care_dependency
    step_partner_reduced_earnings_permanent -- "partner_earning_capacity.is_partners_completely_reduced_earnings_capacity_permanent = false" --> step_partner_reduced_earnings_period
    step_partner_reduced_earnings_permanent --> step_partner_care_dependency
    step_partner_reduced_earnings_period --> step_partner_care_dependency
    step_partner_care_dependency -- "partner_earning_capacity.is_partner_care_dependent = true" --> step_partner_care_dependency_level
    step_partner_care_dependency --> step_partner_education
    step_partner_care_dependency_level --> step_partner_education
    step_partner_education -- "partner_earning_capacity.is_partner_a_student_or_trainee = true" --> step_partner_education_details
    step_partner_education --> step_partner_stationary_facility
    step_partner_education_details --> step_partner_stationary_facility
    step_partner_stationary_facility -- "partner_earning_capacity.is_partner_living_in_a_stationary_facility = true" --> step_partner_stationary_facility_dates
    step_partner_stationary_facility --> step_partner_sgb2
    step_partner_stationary_facility_dates --> step_partner_sgb2
    step_partner_sgb2 --> step_applicant_bank_details
    step_applicant_bank_details --> step_applicant_residence
    step_applicant_residence --> step_applicant_accommodation_type
    step_applicant_accommodation_type -- "applicant_accommodation.applicant_accommodation_type = 'rental_appartment'" --> step_applicant_rental_details
    step_applicant_accommodation_type -- "applicant_accommodation.applicant_accommodation_type in ['home_owner', 'flat_owner']" --> step_applicant_accommodation_details
    step_applicant_accommodation_type --> step_applicant_accommodation_costs
    step_applicant_rental_details --> step_applicant_accommodation_costs
    step_applicant_accommodation_costs --> step_applicant_accommodation_details
    step_applicant_accommodation_details --> step_applicant_heating
    step_applicant_heating --> step_applicant_sublet
    step_applicant_sublet -- "applicant_accommodation.is_applicant_accommodation_sublet = true" --> step_applicant_sublet_details
    step_applicant_sublet -- "applicant_accommodation.is_applicant_accommodation_sublet_possible = false" --> step_applicant_sublet_impossible_reason
    step_applicant_sublet --> step_applicant_accommodation_issues
    step_applicant_sublet_details --> step_applicant_accommodation_issues
    step_applicant_sublet_impossible_reason --> step_applicant_accommodation_issues
    step_applicant_accommodation_issues --> step_other_people_in_household
    step_other_people_in_household -- "other_people_living_in_same_household_as_applicant.are_other_people_living_in_same_household_as_applicant = true" --> step_household_members_count
    step_other_people_in_household --> step_alimony_liable_people
    step_household_members_count -- "other_people_living_in_same_household_as_applicant.household_members_count >= 1" --> step_household_member_1
    step_household_members_count --> step_alimony_liable_people
    step_household_member_1 -- "other_people_living_in_same_household_as_applicant.household_members_count >= 2" --> step_household_member_2
    step_household_member_1 --> step_alimony_liable_people
    step_household_member_2 -- "other_people_living_in_same_household_as_applicant.household_members_count >= 3" --> step_household_member_3
    step_household_member_2 --> step_alimony_liable_people
    step_household_member_3 -- "other_people_living_in_same_household_as_applicant.household_members_count >= 4" --> step_household_member_4
    step_household_member_3 --> step_alimony_liable_people
    step_household_member_4 -- "other_people_living_in_same_household_as_applicant.household_members_count >= 5" --> step_household_member_5
    step_household_member_4 --> step_alimony_liable_people
    step_household_member_5 -- "other_people_living_in_same_household_as_applicant.household_members_count >= 6" --> step_household_member_6
    step_household_member_5 --> step_alimony_liable_people
    step_household_member_6 -- "other_people_living_in_same_household_as_applicant.household_members_count >= 7" --> step_household_member_7
    step_household_member_6 --> step_alimony_liable_people
    step_household_member_7 -- "other_people_living_in_same_household_as_applicant.household_members_count >= 8" --> step_household_member_8
    step_household_member_7 --> step_alimony_liable_people
    step_household_member_8 -- "other_people_living_in_same_household_as_applicant.household_members_count >= 9" --> step_household_member_9
    step_household_member_8 --> step_alimony_liable_people
    step_household_member_9 -- "other_people_living_in_same_household_as_applicant.household_members_count >= 10" --> step_household_member_10
    step_household_member_9 --> step_alimony_liable_people
    step_household_member_10 --> step_alimony_liable_people
    step_alimony_liable_people -- "other_people_liable_for_alimony_not_living_in_same_household_as_applicant.are_other_people_liable_for_alimony_not_living_in_same_household_as_applicant = true" --> step_alimony_liable_details
    step_alimony_liable_people --> step_applicant_income_work
    step_alimony_liable_details --> step_applicant_income_work
    step_applicant_income_work --> step_applicant_income_benefits
    step_applicant_income_benefits --> step_applicant_income_other
    step_applicant_income_other --> step_applicant_benefits_awaiting_decision
    step_applicant_benefits_awaiting_decision -- "income_information.benefits_awaiting_decision_details_applicant.has_applied_for_benefits_awaiting_decision = true" --> step_applicant_benefits_awaiting_decision_details
    step_applicant_benefits_awaiting_decision --> step_applicant_expected_payments
    step_applicant_benefits_awaiting_decision_details --> step_applicant_expected_payments
    step_applicant_expected_payments -- "income_information['one-time_payments_expected_details_applicant']['are_one-time_payments_expected'] = true" --> step_applicant_expected_payments_details
    step_applicant_expected_payments --> step_applicant_assets_savings
    step_applicant_expected_payments_details --> step_applicant_assets_savings
    step_applicant_assets_savings --> step_applicant_assets_vehicles
    step_applicant_assets_vehicles -- "assets_information.applicant_assets.applicant_assets_details.does_person_have_a_vehicle = true" --> step_applicant_assets_vehicles_details
    step_applicant_assets_vehicles --> step_applicant_assets_property_and_other
    step_applicant_assets_vehicles_details --> step_applicant_assets_property_and_other
    step_applicant_assets_property_and_other -- "partner_information.is_partner_living_in_same_household = false or applicant_information.applicant_marital_status in ['single', 'divorced', 'widowed', 'permanently_separated']" --> step_special_needs_pregnancy
    step_applicant_assets_property_and_other --> step_partner_income_work
    step_partner_income_work --> step_partner_income_benefits
    step_partner_income_benefits --> step_partner_income_other
    step_partner_income_other --> step_partner_benefits_awaiting_decision
    step_partner_benefits_awaiting_decision -- "income_information.benefits_awaiting_decision_details_partner.has_applied_for_benefits_awaiting_decision = true" --> step_partner_benefits_awaiting_decision_details
    step_partner_benefits_awaiting_decision --> step_partner_expected_payments
    step_partner_benefits_awaiting_decision_details --> step_partner_expected_payments
    step_partner_expected_payments -- "income_information['one-time_payments_expected_details_partner']['are_one-time_payments_expected'] = true" --> step_partner_expected_payments_details
    step_partner_expected_payments --> step_partner_assets_savings
    step_partner_expected_payments_details --> step_partner_assets_savings
    step_partner_assets_savings --> step_partner_assets_vehicles
    step_partner_assets_vehicles -- "assets_information.partner_assets.partner_assets_details.does_person_have_a_vehicle = true" --> step_partner_assets_vehicles_details
    step_partner_assets_vehicles --> step_partner_assets_property_and_other
    step_partner_assets_vehicles_details --> step_partner_assets_property_and_other
    step_partner_assets_property_and_other --> step_special_needs_pregnancy
    step_special_needs_pregnancy -- "benefits_for_special_additional_needs.does_household_have_expecting_mother_after_12th_week_of_pregnancy = true" --> step_special_needs_pregnancy_details
    step_special_needs_pregnancy --> step_special_needs_disability
    step_special_needs_pregnancy_details --> step_special_needs_disability
    step_special_needs_disability -- "benefits_for_special_additional_needs.does_household_have_severely_disabled_person_older_than_15_receiving_benefits_for_pariticipating_in_work_life = true" --> step_special_needs_disability_details
    step_special_needs_disability --> step_special_needs_nutrition
    step_special_needs_disability_details --> step_special_needs_nutrition
    step_special_needs_nutrition -- "benefits_for_special_additional_needs.does_household_have_costly_nutrition_for_medical_reasons = true" --> step_special_needs_nutrition_details
    step_special_needs_nutrition --> step_other_information
    step_special_needs_nutrition_details --> step_other_information
    step_other_information --> END
    subgraph eligibility_check["Eligibility Check"]
        step_eligibility_nationality
        step_eligibility_residence
        step_eligibility_dob
        step_eligibility_pension
        step_eligibility_income
        step_eligibility_assets
    end
    subgraph applicant_information["Applicant Information"]
        step_applicant_basics
        step_marital_status
        step_marital_status_since
        step_citizenship
        step_personal_documents
        step_previous_benefits
        step_previous_benefits_details
        step_applicant_legal_support
        step_applicant_displaced_status
        step_applicant_displaced_details
        step_applicant_severely_disabled
        step_applicant_severely_disabled_details
        step_applicant_insurance
    end
    subgraph partner_information["Partner Information"]
        step_partner_check
        step_partner_basics
        step_partner_citizenship
        step_partner_documents
        step_partner_previous_benefits
        step_partner_previous_benefits_details
        step_partner_legal_support
        step_partner_displaced_status
        step_partner_displaced_details
        step_partner_severely_disabled
        step_partner_severely_disabled_details
        step_partner_insurance
    end
    subgraph applicant_earning_capacity["Earning Capacity"]
        step_applicant_employment
        step_applicant_employment_details
        step_applicant_work_capacity
        step_applicant_work_capacity_reason
        step_applicant_reduced_earnings
        step_applicant_reduced_earnings_permanent
        step_applicant_reduced_earnings_period
        step_applicant_care_dependency
        step_applicant_care_dependency_level
        step_applicant_education
        step_applicant_education_details
        step_applicant_stationary_facility
        step_applicant_stationary_facility_dates
        step_applicant_sgb2
    end
    subgraph partner_earning_capacity["Partner Earning Capacity"]
        step_partner_employment
        step_partner_employment_details
        step_partner_work_capacity
        step_partner_work_capacity_reason
        step_partner_reduced_earnings
        step_partner_reduced_earnings_permanent
        step_partner_reduced_earnings_period
        step_partner_care_dependency
        step_partner_care_dependency_level
        step_partner_education
        step_partner_education_details
        step_partner_stationary_facility
        step_partner_stationary_facility_dates
        step_partner_sgb2
    end
    subgraph bank_details["Bank Details"]
        step_applicant_bank_details
    end
    subgraph residence_and_accommodation["Residence & Accommodation"]
        step_applicant_residence
        step_applicant_accommodation_type
        step_applicant_rental_details
        step_applicant_accommodation_costs
        step_applicant_accommodation_details
        step_applicant_heating
        step_applicant_sublet
        step_applicant_sublet_details
        step_applicant_sublet_impossible_reason
        step_applicant_accommodation_issues
    end
    subgraph household_and_alimony["Household & Alimony"]
        step_other_people_in_household
        step_household_members_count
        step_household_member_1
        step_household_member_2
        step_household_member_3
        step_household_member_4
        step_household_member_5
        step_household_member_6
        step_household_member_7
        step_household_member_8
        step_household_member_9
        step_household_member_10
        step_alimony_liable_people
        step_alimony_liable_details
    end
    subgraph applicant_financial_situation["Income & Assets"]
        step_applicant_income_work
        step_applicant_income_benefits
        step_applicant_income_other
        step_applicant_benefits_awaiting_decision
        step_applicant_benefits_awaiting_decision_details
        step_applicant_expected_payments
        step_applicant_expected_payments_details
        step_applicant_assets_savings
        step_applicant_assets_vehicles
        step_applicant_assets_vehicles_details
        step_applicant_assets_property_and_other
    end
    subgraph partner_financial_situation["Partner Income & Assets"]
        step_partner_income_work
        step_partner_income_benefits
        step_partner_income_other
        step_partner_benefits_awaiting_decision
        step_partner_benefits_awaiting_decision_details
        step_partner_expected_payments
        step_partner_expected_payments_details
        step_partner_assets_savings
        step_partner_assets_vehicles
        step_partner_assets_vehicles_details
        step_partner_assets_property_and_other
    end
    subgraph special_needs["Special Additional Needs"]
        step_special_needs_pregnancy
        step_special_needs_pregnancy_details
        step_special_needs_disability
        step_special_needs_disability_details
        step_special_needs_nutrition
        step_special_needs_nutrition_details
    end
    subgraph other_information["Other Information"]
        step_other_information
    end
```
