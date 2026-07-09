# Recommended Privacy Policy Template

> [!IMPORTANT]
> **OPEN SOURCE TEMPLATE & RECOMMENDATION**
> This document serves as a template and recommendation for the BeyondForms open-source project. It outlines the typical data collection, storage, and processing mechanisms of the application based on the default codebase.
>
> **Any actual deployment of this application MUST derive its own actual Privacy Policy from this template, tailoring it to their specific deployment configuration, hosting providers, and legal jurisdiction.**

> [!WARNING]
> **LEGAL DISCLAIMER**
> **This is not a legally binding Privacy Policy and has not been reviewed by legal counsel.**
> Before publishing your privacy policy, deploying this application to production, or collecting actual user data, **your derived Privacy Policy must be reviewed, amended, and approved by qualified legal counsel** to ensure full compliance with GDPR and other applicable data protection laws in your jurisdiction.

This document provides an audit of data collection points, persisted data, storage solutions, and third-party data sharing across the **BeyondForms** project (referred to as "The Application" in this policy).

## 1. Executive Summary

The Application is designed to assist users in completing complex social benefit applications (e.g., in Germany). Consequently, the system collects, processes, and persists **Highly Sensitive Personal Information (SPI)**, including financial records, health/disability status, government identifiers, and bank details.

The architecture relies on a central orchestration middleware that persists data in PostgreSQL and stores uploaded documents in Google Cloud Storage (GCS). Document processing is offloaded to a specialized service that utilizes **Google Gemini (via Vertex AI/LiteLLM)** for OCR and data extraction, meaning **full document contents are shared with third-party AI APIs**.

## 2. Collection & Data Categorization

The Application collects and processes the following data categories:

- **Identifiers (System Metadata):** Internal and external system tokens used solely for technical operations, including the database UUID, Authentik auth ID, and Firebase push notification tokens (`fcm_token`).
- **User Provided Information:** Any data manually entered by the user, including name, address, contact info, family status, bank details, housing costs, and official government numbers (Tax ID, Pension Number).
- **Document Uploads:** Raw files (PDFs, images of IDs, paystubs, rental contracts) uploaded by the user and stored in GCS, containing dense, unredacted personal and financial records.
- **Derived Data:** Information automatically calculated or extracted by the system, such as AI-extracted details from uploaded documents (used to pre-fill the profile), calculated age/retirement eligibility, and application progress states.
- **Technical Data (Cookies & Connection Logs):** Standard web server logs (temporary processing of IP addresses, browser type, and access times) and strictly necessary session cookies (managed via Authentik) required to maintain secure sessions, manage authentication, and prevent system abuse.

## 3. Persistence & External Systems

The Application relies on the following infrastructure and third-party services.

> [!NOTE]
> **Note to Deployer:** The hosting locations below must be updated to reflect your actual deployment configuration (e.g., specific Google Cloud regions).

| Partner / Service              | Data Shared                                       | Purpose                         | Hosting / Processing Location                                        | Privacy Policy / Terms                                                                             |
| :----------------------------- | :------------------------------------------------ | :------------------------------ | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **PostgreSQL**                 | All user profile data, derived data, and metadata | Core database                   | `[Insert Hosting Location, e.g., Self-hosted in EU / AWS Frankfurt]` | N/A (Internal)                                                                                     |
| **Authentik**                  | Email, username, session tokens                   | User authentication             | `[Insert Hosting Location, e.g., Self-hosted in EU]`                 | [Authentik Privacy Policy](https://goauthentik.io/legal/privacy-policy/)                           |
| **Twilio**                     | Phone number (if used)                            | SMS notifications / 2FA         | `[Insert Location, e.g., Global / US]`                               | [Twilio Privacy Notice](https://www.twilio.com/en-us/legal/privacy)                                |
| **Google Cloud Storage (GCS)** | Uploaded documents (PDFs, images)                 | Document storage                | `[Insert GCP Region, e.g., europe-west3 (Frankfurt)]`                | [Google Cloud Privacy Notice](https://cloud.google.com/terms/cloud-privacy-notice)                 |
| **Google Cloud Pub/Sub**       | Technical event triggers                          | Asynchronous task orchestration | `[Insert GCP Region, e.g., europe-west3]`                            | [Google Cloud Privacy Notice](https://cloud.google.com/terms/cloud-privacy-notice)                 |
| **Google Gemini (Vertex AI)**  | Document contents (for OCR/extraction)            | AI-assisted data extraction     | `[Insert GCP Region, e.g., europe-west3]`                            | [Vertex AI Data Governance](https://cloud.google.com/vertex-ai/docs/generative-ai/data-governance) |

> [!TIP]
> By default, this application is configured to use **Google Vertex AI** for Gemini API calls. Vertex AI enterprise terms guarantee that customer data (including uploaded documents) is **not used to train Google's foundation models** and remains strictly confidential within your project boundary.

## 4. Use & Processing

All personal and sensitive data collected by the application is processed **solely for the purpose of assisting users in populating and completing social benefit applications**. The data is used to:

- Pre-fill official application forms.
- Provide AI-assisted guidance and verification of documents.
- Evaluate eligibility criteria via the internal rules engine.

### Data Access & Minimization

- **No Commercial Use:** User data will never be sold, rented, or used for marketing, profiling (beyond benefit eligibility), or any commercial purposes.
- **Internal Access (Debugging):** Access to production data by the development and engineering teams is strictly restricted. Developers may only access user data for **debugging and troubleshooting purposes, and only when there is a valid, documented business justification** (e.g., resolving a critical system error blocking an application). Any such access must be logged, audit-trailed, and remains subject to strict confidentiality controls.

## 5. Retention & Deletion

The application is designed with data minimization in mind. The following recommended default retention periods are suggested for the standard deployment:

> [!NOTE]
> **Note to Deployer:** You must implement automated rules (e.g., GCS Lifecycle policies, database cron jobs) to enforce these retention periods in your deployment.

- **Identifiers (System Metadata):** **Application Lifetime**
  - System metadata (database UUIDs, Authentik IDs, session tokens) is necessary to maintain application security, manage active sessions, and prevent abuse. Because these identifiers do not contain direct personal details, retaining them long-term is justifiable under "legitimate interest" (GDPR Art. 6(1)(f)) for security auditing, provided they are decoupled from any personal data upon account deletion.
- **User Provided Information:** **30 days after submission** OR **90 days of inactivity** (Recommended)
  - This highly sensitive data (PII, financial records, health/disability status, tax IDs) is collected solely to help the user complete their benefit application. Once the application is submitted, or if the user abandons the draft, the primary purpose of processing is fulfilled.
- **Document Uploads (Raw Files in GCS):** **14 days after successful submission** (Recommended)
  - Uploaded documents (PDFs, images of IDs, paystubs, rental contracts) serve a dual purpose: they are used as inputs for AI data extraction, and they are mandatory proof attachments that must be transmitted to the social benefit authority during the final submission. Once the application is successfully submitted to and accepted by the authority, the system has no further legal basis to retain these sensitive files.
- **Derived Data (AI Extractions, Eligibility Status):** **30 days after submission** OR **90 days of inactivity** (Recommended)
  - Derived data (the JSON extracted from documents, eligibility flags from the rules engine) is generated by the system to run the core application logic. While it is system-generated, it is directly derived from the user's sensitive inputs. Therefore, its lifetime and risk profile are tied to the user's active session and application.

## 6. User Data Rights

Depending on the jurisdiction of the deployment (such as under the GDPR in the European Union), users may have various rights regarding their personal data. The default application architecture supports the technical execution of these rights (e.g., data export and account deletion).

Typically, these rights include:

- **Access & Portability (Extraction):** The right to request a copy of all personal data, uploaded documents, and application states in a structured, machine-readable format.
- **Erasure (Deletion):** The right to request the permanent deletion of the user profile, uploaded documents, and all derived data from the system.
- **Correction & Objection:** The right to correct inaccurate data or object to certain processing activities.

To exercise any of these rights, users should contact the **Data Controller** using the contact details provided in the **Contact & Responsibility** section.

## 7. Changes to This Privacy Policy

Registered users will be notified of updates to this Privacy Policy by posting the new version on this page and, where appropriate, via notification within the application.

## 8. Contact & Responsibility

> [!NOTE]
> **Note to Deployer:** Fill in the details below to identify the legal entity responsible for data processing (the Data Controller) and how users can contact you or your Data Protection Officer.

### Data Controller

The entity responsible for the processing of data in this deployment is:

```
[Insert Legal Name of Organization/Entity, e.g., Technologiestiftung Berlin]
[Insert Physical Address, e.g., Tempelhofer Damm 2, 12101 Berlin, Germany]
[Insert Phone Number - Optional]
[Insert General Email Address]
```

### Contact for Data Rights

If you have questions about this policy, or would like to exercise your data rights, please contact:

- **Email:** `[Insert Dedicated Privacy Email, e.g., privacy@citylab-berlin.org]`

### Data Protection Officer (DPO)

`[If applicable, insert DPO contact information. If not required, this section can be removed.]`

- **DPO Contact:** `[Insert DPO Email/Address]`
