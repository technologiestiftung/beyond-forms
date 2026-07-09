from datetime import date
from decimal import Decimal, InvalidOperation
import re
from typing import Literal, Optional, List, Any, Annotated

from pydantic import Field, BeforeValidator, BaseModel, computed_field

from beyondforms.document_schemas.document_registry import (
    register_document,
    BaseDocument,
)


def parse_robust_decimal(v: Any) -> Decimal:
    if v is None:
        return None
    if isinstance(v, (int, float, Decimal)):
        return Decimal(v)
    if not isinstance(v, str):
        return Decimal(0)

    cleaned = re.sub(r"[^\d.,-]", "", v)
    if not cleaned:
        return Decimal(0)

    if "." in cleaned and "," in cleaned:
        if cleaned.find(".") < cleaned.find(","):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        parts = cleaned.split(",")
        if len(parts) == 2 and len(parts[1]) == 2:
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", ".")

    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return Decimal(0)


RobustDecimal = Annotated[Decimal, BeforeValidator(parse_robust_decimal)]


def parse_robust_positive_decimal(v: Any) -> Decimal:
    result = parse_robust_decimal(v)
    if result is not None and result < 0:
        return abs(result)
    return result


RobustPositiveDecimal = Annotated[Decimal, BeforeValidator(parse_robust_positive_decimal)]


# --- 1. FINANCIAL & HOUSEHOLD DECLARATIONS ---


@register_document("income_declaration")
class IncomeDeclaration(BaseDocument):
    description: str = "Official 'Anlage Einkommen' form, declaration of income. Contains sections for wages, self-employment, and social benefits."
    has_self_employment_income: Optional[bool] = Field(
        None,
        description="Indicates if the individual declares income from self-employment or freelance work.",
    )
    total_monthly_net: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total net monthly income amount after taxes and social security contributions.",
    )


@register_document("assets_declaration")
class AssetsDeclaration(BaseDocument):
    description: str = "Official 'Anlage Vermögen' form declaring savings, real estate, and valuables."
    total_liquid_assets: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total value of readily available financial assets such as cash, bank balances, or stocks.",
    )
    owns_real_estate: Optional[bool] = Field(
        None,
        description="Indicates if the individual owns any land, houses, or apartments.",
    )


@register_document("housing_costs_form")
class HousingCostsForm(BaseDocument):
    description: str = "Official 'Anlage KDU' form for rent, heating, and service charges."
    base_rent: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The basic monthly rent amount excluding heating and utility service charges.",
    )
    heating_type: Optional[str] = Field(
        None,
        description="The primary method used for heating the residence (e.g., Gas, District Heating, Oil).",
    )


@register_document("bank_details")
class BankDetails(BaseDocument):
    description: str = "Formal document or form providing IBAN and BIC for benefit payments."
    iban: Optional[str] = Field(
        None,
        description="The International Bank Account Number used for identifying the specific bank account.",
    )
    account_holder: Optional[str] = Field(
        None,
        description="The full name of the person or entity who owns the bank account.",
    )


@register_document("household_declaration")
class HouseholdDeclaration(BaseDocument):
    description: str = "Declaration of household members and community of need (Bedarfsgemeinschaft)."
    member_count: Optional[int] = Field(
        None,
        description="The total number of people living in the household/community of need.",
    )
    has_partner_in_household: Optional[bool] = Field(
        None,
        description="Indicates if a spouse or life partner resides in the same household.",
    )


# --- 2. IDENTITY & RESIDENCE ---


@register_document("identity_document")
class IdentityDocument(BaseDocument):
    description: str = (
        "National ID card or passport showing identity and nationality. Can be called multiple things such as: \
        Asmens tapatybės kortelė \
        Cárta aitheantais \
        Carta d'identità \
        Cartão de Cidadão \
        Carte de identitate \
        Carte nationale d'identité \
        Δελτίο ταυτότητας \
        Documento Nacional de Identidad \
        Dowód osobisty \
        Henkilökortti \
        Identitetskort \
        Identiteitskaart \
        Isikutunnistus \
        Karta tal-Identità \
        Legitimationskort \
        Лична карта (Lichna karta) \
        Nafnskírteini \
        Nasjonalt identitetskort \
        Občanský průkaz \
        Občiansky preukaz \
        Osebna izkaznica \
        Osobna iskaznica \
        Personalausweis \
        Personas apliecība \
        Személyazonosító igazolvány \
    "
    )
    document_id: Optional[str] = Field(
        None,
        description="The unique identification number of the document, typically found at the top right.",
    )
    gender: Optional[Literal["M", "F", "D", "<"]] = Field(
        None,
        description="Gender of the document holder. Can be 'M' (male), 'F' (female), 'D' (diverse) or '<' (other).",
    )
    given_names: Optional[str] = Field(None, description="Given names of the document holder.")
    last_name: Optional[str] = Field(None, description="Last name of the document holder.")
    nationality: Optional[str] = Field(
        None,
        description="Nationality of the document holder as official three digit code.",
    )
    valid_until: Optional[date] = Field(None, description="The expiration date of the document.")
    date_of_issue: Optional[date] = Field(
        None,
        description="The date the document was officially issued by the authority.",
    )
    place_of_issue: Optional[str] = Field(
        None,
        description="The city, state, or authority location that issued the document.",
    )
    date_of_birth: Optional[date] = Field(
        None,
        description="The date of birth of the document holder as written on the ID.",
    )
    place_of_birth: Optional[str] = Field(
        None,
        description="The place of birth of the document holder as written on the ID.",
    )
    address: Optional[str] = Field(None, description="The address of the document holder as written on the ID.")
    issuing_authority: Optional[str] = Field(None, description="The name of the authority that issued the document.")


@register_document("registration_certificate")
class RegistrationCertificate(BaseDocument):
    description: str = "Official 'Meldebescheinigung' proving residential registration in a municipality."
    given_names: Optional[str] = Field(None, description="Given names of the document holder.")
    last_name: Optional[str] = Field(None, description="Last name of the document holder.")
    marital_status: Optional[str] = Field(None, description="Marital status of the document holder.")
    nationality: Optional[str] = Field(
        None,
        description="Nationality or multiple nationalities of the document holder.",
    )
    place_of_birth: Optional[str] = Field(None, description="The place of birth of the document holder.")
    date_of_birth: Optional[date] = Field(None, description="The date of birth of the document holder.")
    date_of_issue: Optional[date] = Field(
        None,
        description="The date the residential registration was officially issued by the authority.",
    )
    address: Optional[str] = Field(
        None,
        description="The full residential address including street, house number, and postal code.",
    )
    is_living_with_spouse: Optional[bool] = Field(
        None,
        description="Indicates if the document holder is living with their spouse.",
    )
    is_living_with_children: Optional[bool] = Field(
        None,
        description="Indicates if the document holder is living with their children.",
    )
    is_living_with_parent: Optional[bool] = Field(
        None,
        description="Indicates if the document holder is living with their parent(s).",
    )
    issuing_authority: Optional[str] = Field(None, description="The name of the authority that issued the document.")


@register_document("address_proof")
class AddressProof(BaseDocument):
    description: str = (
        "Letter or rental confirmation confirming the current physical address. 'Wohnungsgeberbestätigung' in German."
    )
    landlord_name: Optional[str] = Field(
        None,
        description="The name of the entity or landlord issuing the address confirmation.",
    )
    landlord_address: Optional[str] = Field(
        None,
        description="The address of the entity or landlord issuing the address confirmation.",
    )
    owner_name: Optional[str] = Field(None, description="The name of the owner of the property.")
    owner_address: Optional[str] = Field(None, description="The address of the owner of the property.")
    is_moving_in: Optional[bool] = Field(
        None,
        description="Indicates if the document holder is moving in to the address.",
    )
    date_of_moving: Optional[date] = Field(
        None, description="The date the document holder moved in or out of the address."
    )
    tenant_name: Optional[str] = Field(None, description="The name of the document holder.")
    tenant_address: Optional[str] = Field(None, description="The address of the document holder.")
    confirmation_date: Optional[date] = Field(None, description="The date the address proof was signed or issued.")


@register_document("residence_permit")
class ResidencePermit(BaseDocument):
    description: str = "Official 'Aufenthaltstitel' document or card for non-German citizens."
    document_id: Optional[str] = Field(
        None,
        description="The unique identification number of the document, typically found at the top right.",
    )
    given_names: Optional[str] = Field(None, description="Given names of the document holder.")
    last_name: Optional[str] = Field(None, description="Last name of the document holder.")
    gender: Optional[Literal["M", "F", "<"]] = Field(
        None,
        description="Gender of the document holder. Can be 'M' (male), 'F' (female) or '<' (other).",
    )
    nationality: Optional[str] = Field(
        None,
        description="Nationality of the document holder as official three digit code.",
    )
    valid_until: Optional[date] = Field(None, description="The expiration date of the document.")
    date_of_issue: Optional[date] = Field(
        None,
        description="The date the document was officially issued by the authority.",
    )
    place_of_issue: Optional[str] = Field(
        None,
        description="The city, state, or authority location that issued the document.",
    )
    date_of_birth: Optional[date] = Field(
        None,
        description="The date of birth of the document holder as written on the residence permit.",
    )
    remarks: Optional[str] = Field(None, description="Any additional remarks or notes about the residence permit.")
    employment_permitted: Optional[bool] = Field(
        None,
        description="Indicates if the holder is legally allowed to pursue employment.",
    )
    permit_type: Optional[str] = Field(
        None,
        description="The specific legal title or paragraph of the residence permit.",
    )
    address: Optional[str] = Field(
        None,
        description="The address of the document holder as written on the residence permit.",
    )
    issuing_authority: Optional[str] = Field(None, description="The name of the authority that issued the document.")


@register_document("recognition_decision")
class RecognitionDecision(BaseDocument):
    description: str = "BAMF notice or official decision regarding asylum or refugee status."
    file_number: Optional[str] = Field(
        None,
        description="The BAMF file number (Aktenzeichen) associated with the case.",
    )
    status_granted: Optional[str] = Field(
        None,
        description="The specific protection status granted (e.g., Refugee, Subsidy Protection).",
    )


@register_document("asylum_stay_permit")
class AsylumStayPermit(BaseDocument):
    description: str = "Aufenthaltsgestattung or Duldung document for individuals in the asylum process."
    document_id: Optional[str] = Field(
        None,
        description="The unique identification number of the document, typically found at the top right.",
    )
    given_names: Optional[str] = Field(None, description="Given names of the document holder.")
    last_name: Optional[str] = Field(None, description="Last name of the document holder.")
    valid_until: Optional[date] = Field(
        None,
        description="The date the stay permit or suspension of deportation expires.",
    )
    limited_to_state: Optional[str] = Field(None, description="The German state the document is limited to.")
    employment_permitted: Optional[bool] = Field(
        None,
        description="Indicates if the holder is legally allowed to pursue employment.",
    )
    issuing_authority: Optional[str] = Field(None, description="The name of the authority that issued the document.")


# --- 3. INCOME (GENERAL) ---


@register_document("bank_statements")
class BankStatements(BaseDocument):
    description: str = (
        "Bank statement, Kontoauszug, list of transactions, account balance, IBAN, credit and debit entries."
    )
    iban: Optional[str] = Field(None, description="The International Bank Account Number of the bank account.")
    account_holder_name: Optional[str] = Field(None, description="The full name of the account holder.")
    statement_period_start: Optional[date] = Field(
        None, description="The start date of the period covered by the bank statement."
    )
    statement_period_end: Optional[date] = Field(
        None, description="The end date of the period covered by the bank statement."
    )
    statement_date: Optional[date] = Field(None, description="The date the bank statement was issued.")
    account_balance: Optional[RobustDecimal] = Field(
        None,
        description="The balance of the account at the end of the statement period.",
    )
    amount_health_insurance: Optional[RobustPositiveDecimal] = Field(
        None, description="The recurring monthly amount of health insurance paid."
    )
    amount_liability_insurance: Optional[RobustPositiveDecimal] = Field(
        None, description="The recurring monthly amount of liability insurance paid."
    )
    amount_rent: Optional[RobustPositiveDecimal] = Field(None, description="The recurring monthly amount of rent paid.")
    amount_pension: Optional[RobustPositiveDecimal] = Field(
        None, description="The recurring monthly amount of pension received."
    )


@register_document("wage_slips")
class WageSlips(BaseDocument):
    description: str = "Salary or wage statement, Lohnabrechnung, Gehaltsabrechnung, Verdienstabrechnung. Contains employer details, employee number, gross and net pay (Brutto, Netto)."
    employee_name: Optional[str] = Field(None, description="The full name of the employee.")
    employee_address: Optional[str] = Field(None, description="The address of the employee.")
    tax_id: Optional[str] = Field(None, description="The tax identification number of the employee.")
    social_security_number: Optional[str] = Field(None, description="The social security number of the employee.")
    health_insurance_provider: Optional[str] = Field(None, description="The name of the health insurance provider.")
    employer_name: Optional[str] = Field(None, description="The name of the employer.")
    employer_address: Optional[str] = Field(None, description="The address of the employer.")
    gross_amount: Optional[RobustPositiveDecimal] = Field(None, description="The total gross income before deductions.")
    net_amount: Optional[RobustPositiveDecimal] = Field(None, description="The total net income after deductions.")
    pay_period: Optional[str] = Field(None, description="The specific month or timeframe the salary payment covers.")
    date_issued: Optional[date] = Field(None, description="The date the wage slip was issued.")
    iban: Optional[str] = Field(
        None,
        description="The International Bank Account Number of the employee's bank account.",
    )
    accumulated_yearly_gross_income: Optional[RobustPositiveDecimal] = Field(
        None, description="The total gross income of the employee for the year."
    )
    accumulated_yearly_net_income: Optional[RobustPositiveDecimal] = Field(
        None, description="The total net income of the employee for the year."
    )


class PaymentPeriod(BaseModel):
    period_from: Optional[date] = Field(None, description="The start date of the payment period.")
    period_to: Optional[date] = Field(None, description="The end date of the payment period.")
    monthly_amount: Optional[RobustPositiveDecimal] = Field(None, description="The monthly amount of the benefit.")


@register_document("social_benefits_proof")
class SocialBenefitsProof(BaseDocument):
    description: str = "Notice of social benefits, such as Bewilligungsbescheid, Jobcenter, Familienkasse, Wohngeldbehörde. Mentions Bürgergeld, Kindergeld, Wohngeld, or Grundsicherung."
    benefit_type: Optional[str] = Field(None, description="The category of social benefit being received.")
    given_names: Optional[str] = Field(None, description="Given names of the applicant.")
    last_name: Optional[str] = Field(None, description="Last name of the applicant.")
    address: Optional[str] = Field(None, description="The address of the applicant.")
    issuing_authority: Optional[str] = Field(None, description="The name of the authority that issued the document.")
    reference_number: Optional[str] = Field(None, description="The reference number of the social benefits notice.")
    bg_number: Optional[str] = Field(None, description="The number of the Bedarfsgemeinschaft aka community in need.")
    date_of_issue: Optional[date] = Field(None, description="The date the social benefits notice was issued.")
    date_of_application: Optional[date] = Field(
        None, description="The date the social benefits application was submitted."
    )
    payment_periods: Optional[List[PaymentPeriod]] = Field(None, description="The payment periods for the benefit.")
    is_granted: Optional[bool] = Field(None, description="Indicates if the social benefits are granted.")


@register_document("alimony_proof")
class AlimonyProof(BaseDocument):
    description: str = "Proof of maintenance or alimony payments received or paid."
    recipient_name: Optional[str] = Field(
        None,
        description="The full name of the individual receiving the alimony payments.",
    )
    monthly_payment: Optional[RobustPositiveDecimal] = Field(
        None, description="The recurring monthly alimony or child support amount."
    )


@register_document("irregular_income_proof")
class IrregularIncomeProof(BaseDocument):
    description: str = "Evidence of one-time payments, gifts, or irregular financial inflows."
    payment_reason: Optional[str] = Field(None, description="The reason or source of the irregular payment.")
    amount: Optional[RobustPositiveDecimal] = Field(
        None, description="The total monetary value of the irregular payment."
    )


# --- 4. INCOME (ELDERLY & DISABILITY) ---


@register_document("pension_notice")
class PensionNotice(BaseDocument):
    description: str = "Official 'Rentenbescheid' detailing monthly pension entitlements."
    pension_reason: Optional[str] = Field(
        None,
        description="The reason for the pension entitlement, e.g. age or disability.",
    )
    pension_insurance_number: Optional[str] = Field(
        None,
        description="The unique pension insurance number (Rentenversicherungsnummer).",
    )
    case_number: Optional[str] = Field(None, description="The case number of the pension case.")
    start_date_of_pension: Optional[date] = Field(None, description="The date the pension entitlement started.")
    end_date_of_pension: Optional[date] = Field(
        None,
        description="The date the pension entitlement ended, e.g. because the recipient will transfer to pension of old age.",
    )
    monthly_amount: Optional[RobustPositiveDecimal] = Field(None, description="The total monthly pension amount.")
    back_pay_amount: Optional[RobustPositiveDecimal] = Field(
        None, description="The amount of back pay for the pension entitlement."
    )
    date_of_issue: Optional[date] = Field(None, description="The date the pension notice was issued.")
    is_granted: Optional[bool] = Field(None, description="Indicates if the pension entitlement is granted.")


@register_document("private_pension_proof")
class PrivatePensionProof(BaseDocument):
    description: str = "Proof of private pension, annuity, or insurance-based retirement income."
    name_of_pensioner: Optional[str] = Field(None, description="The name of the pensioner.")
    provider_name: Optional[str] = Field(
        None,
        description="The name of the insurance company or private pension provider.",
    )
    insurance_policy_number: Optional[str] = Field(None, description="The number of the insurance policy.")
    date_of_issue: Optional[date] = Field(None, description="The date the private pension proof was issued.")
    monthly_payout_amount: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The recurring monthly payout amount from the private pension plan.",
    )
    start_date_of_pension: Optional[date] = Field(None, description="The date the private pension entitlement started.")
    end_date_of_pension: Optional[date] = Field(None, description="The date the private pension entitlement will end.")


@register_document("private_pension_yearly_information")
class PrivatePensionYearlyInformation(BaseDocument):
    description: str = "Yearly information about the private pension, such as the total amount of contributions and the total amount of payouts."
    year: Optional[int] = Field(None, description="The year of the private pension information.")
    provider_name: Optional[str] = Field(
        None,
        description="The name of the insurance company or private pension provider.",
    )
    current_monthly_pension_amount: Optional[RobustPositiveDecimal] = Field(
        None, description="The current monthly pension amount."
    )
    current_one_time_payout_amount: Optional[RobustPositiveDecimal] = Field(
        None, description="The current one time payout amount."
    )
    estimated_start_of_pension: Optional[date] = Field(None, description="The estimated start date of the pension.")
    start_of_pension_monthly_pension_amount: Optional[RobustPositiveDecimal] = Field(
        None, description="The monthly pension amount at the start of the pension."
    )


@register_document("disability_decision")
class DisabilityDecision(BaseDocument):
    description: str = "Official decision of full and permanent reduction in earning capacity (Erwerbsminderung)."
    is_permanent: Optional[bool] = Field(
        None,
        description="Indicates if the reduction in earning capacity is granted indefinitely.",
    )
    decision_date: Optional[date] = Field(None, description="The date the official disability decision was issued.")


# --- 5. ASSETS ---


@register_document("savings_statements")
class SavingsStatements(BaseDocument):
    description: str = "Statements or copies of savings books showing current capital assets."
    current_balance: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The current total amount of capital held in the savings account.",
    )
    bank_name: Optional[str] = Field(
        None,
        description="The name of the financial institution where the savings are held.",
    )


@register_document("securities_statements")
class SecuritiesStatements(BaseDocument):
    description: str = "Portfolio summaries for stocks, bonds, or other securities."
    portfolio_value: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total market value of the investment portfolio at the time of the statement.",
    )
    statement_date: Optional[date] = Field(None, description="The date the portfolio summary was generated.")


@register_document("life_insurance_contract")
class LifeInsuranceContract(BaseDocument):
    description: str = "Life or pension insurance contracts, specifically showing the surrender value (Rückkaufswert)."
    surrender_value: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The current cash value of the policy if it were to be terminated.",
    )
    contract_end_date: Optional[date] = Field(
        None,
        description="The scheduled maturity or expiration date of the insurance contract.",
    )


@register_document("property_ownership_proof")
class PropertyOwnershipProof(BaseDocument):
    description: str = "Land registry extract or mortgage documents proving ownership of property."
    owner_name: Optional[str] = Field(None, description="The name of the owner of the property.")
    property_address: Optional[str] = Field(None, description="The address of the property.")
    property_type: Optional[str] = Field(
        None,
        description="The type of property owned, such as residential, commercial, or undeveloped land.",
    )
    outstanding_mortgage: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The remaining debt balance on any loans secured by the property.",
    )


# --- 6. HOUSING ---


@register_document("rental_contract")
class RentalContract(BaseDocument):
    description: str = "Legal agreement detailing rent, utilities, and square footage for a rented property."
    tenant_name: Optional[str] = Field(None, description="The name of the tenant.")
    tenant_address: Optional[str] = Field(None, description="The address of the tenant.")
    net_cold_rent: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total monthly net cold rent of the property, excluding heating and utility costs.",
    )
    monthly_total_rent: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total monthly payment including base rent and all utility advances.",
    )
    operating_costs: Optional[RobustPositiveDecimal] = Field(
        None, description="The total monthly operating costs of the property."
    )
    heating_costs: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total monthly heating costs of the property, if not already included in the operating costs.",
    )
    square_meters: Optional[float] = Field(
        None,
        description="The total living area of the property as stated in the contract.",
    )
    is_main_tenant: Optional[bool] = Field(
        None,
        description="Indicates if the document holder is the main tenant of the property.",
    )
    has_sub_tenants: Optional[bool] = Field(None, description="Indicates if the document holder has sub-tenants.")
    start_date_of_rent: Optional[date] = Field(None, description="The date from which the rent starts.")
    end_date_of_rent: Optional[date] = Field(
        None,
        description="The date until the rental contract ends if it's a fixed term contract.",
    )


@register_document("rent_increase_notice")
class RentIncreaseNotice(BaseDocument):
    description: str = "Official letter from a landlord announcing an increase in rent or utilities."
    new_total_rent: Optional[RobustPositiveDecimal] = Field(
        None, description="The updated total monthly payment amount after the increase."
    )
    effective_date: Optional[date] = Field(None, description="The date from which the new rent amount must be paid.")


@register_document("utility_cost_statement")
class UtilityCostStatement(BaseDocument):
    description: str = "Annual billing for service and utility charges (Betriebskostenabrechnung)."
    billing_period: Optional[str] = Field(
        None,
        description="The specific timeframe (usually a year) covered by the utility billing.",
    )
    balance_due: Optional[RobustDecimal] = Field(
        None,
        description="The final credit or debit balance resulting from the annual reconciliation.",
    )


@register_document("heating_costs_proof")
class HeatingCostsProof(BaseDocument):
    description: str = "Invoices or statements specifically for heating costs (gas, district heating, etc.)."
    fuel_type: Optional[str] = Field(
        None,
        description="The primary energy source used for heating (e.g., Gas, Oil, Electricity).",
    )
    annual_total_heating_costs: Optional[RobustPositiveDecimal] = Field(
        None, description="The total monetary cost of total heating costs for the year."
    )
    annual_consumption_amount_kwh_per_square_meter: Optional[float] = Field(
        None,
        description="The annual consumption amount of kWh per square meter of the property.",
    )
    heating_costs_regardless_of_usage: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total monetary cost of fuel consumption for the year, regardless of usage.",
    )
    heating_costs_usage_based: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total monetary cost of fuel consumption for the year, based on usage.",
    )
    warm_water_costs_regardless_of_usage: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total monetary cost of warm water consumption for the year, regardless of usage.",
    )
    warm_water_costs_usage_based: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The total monetary cost of warm water consumption for the year, based on usage.",
    )


@register_document("home_ownership_costs")
class HomeOwnershipCosts(BaseDocument):
    description: str = "Evidence of ongoing costs for owner-occupiers, including interest and insurance."
    monthly_interest: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The monthly interest portion of the mortgage payment (excluding principal).",
    )
    monthly_operating_costs: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The recurring monthly costs for insurance, taxes, and maintenance.",
    )


# --- 7. HEALTH & CARE ---


@register_document("health_insurance_proof")
class HealthInsuranceProof(BaseDocument):
    description: str = "Membership certificate or proof of statutory or private health insurance."
    full_name: Optional[str] = Field(None, description="The full name of the insured person.")
    insurance_name: Optional[str] = Field(None, description="The full name of the health insurance provider.")
    pension_insurance_number: Optional[str] = Field(
        None,
        description="The unique pension insurance ID number of the insured person.",
    )
    health_insurance_status: Optional[
        Literal[
            "compulsory_insurance",
            "voluntary_insurance",
            "family_insurance",
            "private_insurance",
            "care_by_health_insurance_under_264_sgb_v",
        ]
    ] = Field(
        None,
        description="The type of health insurance. German terms: 'Pflichtversicherung' (compulsory_insurance), 'Freiwillige Versicherung' (voluntary_insurance), 'Familienversicherung' (family_insurance), 'Private Versicherung' (private_insurance), 'Betreuung der Krankenkassen nach § 264 SGB V' (care_by_health_insurance_under_264_sgb_v).",
    )

    @computed_field
    @property
    def is_private(self) -> Optional[bool]:
        if self.health_insurance_status == "private_insurance":
            return True
        elif self.health_insurance_status is not None:
            return False
        return None


@register_document("care_level_notice")
class CareLevelNotice(BaseDocument):
    description: str = "Notice defining the assigned care level (Pflegegrad)."
    care_level: Optional[int] = Field(
        None,
        description="The officially assigned care level, typically ranging from 1 to 5.",
    )
    effective_from: Optional[date] = Field(
        None,
        description="The date from which the care level status was officially recognized.",
    )


@register_document("care_service_invoice")
class CareServiceInvoice(BaseDocument):
    description: str = "Invoices from outpatient care services or nursing providers."
    invoice_amount: Optional[RobustPositiveDecimal] = Field(
        None, description="The total amount billed for the care services provided."
    )
    service_period: Optional[str] = Field(
        None, description="The timeframe during which the care services were performed."
    )


@register_document("care_home_contract")
class CareHomeContract(BaseDocument):
    description: str = "Contract for residential care or assisted living facilities."
    monthly_base_cost: Optional[RobustPositiveDecimal] = Field(
        None, description="The basic monthly cost for room and board in the facility."
    )
    facility_name: Optional[str] = Field(None, description="The official name of the care or assisted living facility.")


@register_document("care_facility_costs")
class CareFacilityCosts(BaseDocument):
    description: str = "Detailed breakdown of costs for accommodation, meals, and care components in a facility."
    investment_costs: Optional[RobustPositiveDecimal] = Field(
        None,
        description="Specific costs related to the facility's capital and investment expenses.",
    )
    catering_costs: Optional[RobustPositiveDecimal] = Field(
        None,
        description="The portion of the facility fees dedicated to meals and catering.",
    )


# --- 8. MEDICAL & SPECIAL NEEDS ---


@register_document("disability_id")
class DisabilityId(BaseDocument):
    description: str = "Official 'Schwerbehindertenausweis' showing the degree of disability (GdB)."
    disability_degree: Optional[int] = Field(
        None,
        description="The numerical degree of disability (Grad der Behinderung) from 20 to 100.",
    )
    marks: Optional[List[str]] = Field(
        None,
        description="A list of official disability codes or marks (e.g., G, aG, H, B, Bl).",
    )


@register_document("medical_reports")
class MedicalReports(BaseDocument):
    description: str = "Doctor's letters or medical assessments requested to verify health status."
    diagnosis_summary: Optional[str] = Field(
        None,
        description="A brief summary of the medical findings or primary diagnoses.",
    )
    report_date: Optional[date] = Field(None, description="The date the medical report or assessment was signed.")


@register_document("special_diet_evidence")
class SpecialDietEvidence(BaseDocument):
    description: str = "Medical certificate proving the need for a specific, costly diet due to illness."
    reason_for_diet: Optional[str] = Field(
        None,
        description="The medical condition necessitating the specialized nutrition.",
    )
    is_life_long: Optional[bool] = Field(
        None,
        description="Indicates if the requirement for the special diet is permanent.",
    )


@register_document("pregnancy_certificate")
class PregnancyCertificate(BaseDocument):
    description: str = "Medical proof of pregnancy including the expected due date."
    expected_due_date: Optional[date] = Field(
        None, description="The calculated date on which the birth is expected to occur."
    )
    maternity_pass_number: Optional[str] = Field(
        None,
        description="The ID number found on the official maternity passport (Mutterpass).",
    )


# --- 9. REPRESENTATION & STATUS ---


@register_document("power_of_attorney")
class PowerOfAttorney(BaseDocument):
    description: str = "Signed 'Vollmacht' authorizing a third party to represent the applicant."
    representative_name: Optional[str] = Field(
        None,
        description="The full name of the person authorized to act as a representative.",
    )
    scope_of_authority: Optional[str] = Field(
        None,
        description="The specific tasks or areas for which the representative has authority.",
    )


@register_document("legal_guardianship_papers")
class LegalGuardianshipPapers(BaseDocument):
    description: str = "Court orders or certificates defining a legal guardian or representative (Betreuung)."
    guardian_name: Optional[str] = Field(None, description="The name of the court-appointed legal guardian.")
    authority_areas: Optional[List[str]] = Field(
        None,
        description="The specific domains (e.g., health, finances) covered by the guardianship.",
    )


@register_document("marriage_certificate")
class MarriageCertificate(BaseDocument):
    description: str = "Official certificate of marriage or registered civil partnership."
    partner_name: Optional[str] = Field(None, description="The full name of the spouse or registered partner.")
    marriage_date: Optional[date] = Field(
        None,
        description="The date the marriage or partnership was officially registered.",
    )


@register_document("divorce_decree")
class DivorceDecree(BaseDocument):
    description: str = "Legal decree or proof of divorce or formal separation."
    divorce_date: Optional[date] = Field(
        None,
        description="The date the divorce or dissolution of partnership became legally effective.",
    )
    alimony_obligations_exist: Optional[bool] = Field(
        None,
        description="Indicates if there are ongoing legal requirements to pay maintenance to a former partner.",
    )


@register_document("cooperation_agreement")
class CooperationAgreement(BaseDocument):
    description: str = "Signed obligation to cooperate and data protection compliance agreement (Mitwirkungsverpflichtung + Datenschutzerklärung)."
    is_signed: Optional[bool] = Field(
        None,
        description="Indicates if the compliance agreement has been fully signed by the applicant.",
    )
    agreement_date: Optional[date] = Field(
        None, description="The date the cooperation agreement was officially signed."
    )


# --- 10. ASYLUM SPECIFIC ---


@register_document("asylblg_application")
class AsylblgApplication(BaseDocument):
    description: str = "Specific application form for benefits under the Asylbewerberleistungsgesetz."
    district_authority: Optional[str] = Field(
        None,
        description="The name of the specific social office or district authority receiving the application.",
    )
    application_date: Optional[date] = Field(
        None, description="The date the application for asylum benefits was submitted."
    )


@register_document("accommodation_assignment")
class AccommodationAssignment(BaseDocument):
    description: str = "Official assignment notice to a specific accommodation or LAF facility."
    facility_address: Optional[str] = Field(
        None, description="The full address of the assigned accommodation facility."
    )
    assignment_date: Optional[date] = Field(
        None,
        description="The date the individual was officially assigned to the facility.",
    )
