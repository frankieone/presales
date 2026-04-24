sequenceDiagram
    actor Customer
    participant UI as ACME Portal
    participant API as Next.js API
    participant F1 as FrankieOne API

    rect rgb(240, 248, 255)
        Note over Customer, F1: Step 1 — Business Search
        Customer->>UI: Enter ABN / ACN / Business Name
        UI->>API: POST /api/business/search
        API->>F1: v2 organizations/lookup
        F1-->>API: matchedOrganizations[]
        API-->>UI: Search results list
        UI-->>Customer: Display matching businesses
    end

    rect rgb(245, 255, 245)
        Note over Customer, F1: Step 2 — Company Selection & ABR Lookup
        Customer->>UI: Select company from results
        UI->>API: POST /api/business/profile
        API->>F1: v2 organizations/{token}/profile
        F1-->>API: Organization profile (directors, shareholders, PSCs)
        API-->>UI: BusinessProfile
    end

    rect rgb(255, 248, 240)
        Note over Customer, F1: Step 3 — Ownership & UBO Discovery
        UI->>API: POST /api/business/ownership
        API->>F1: v2 organizations/{token}/workflows/execute<br/>(GLB-Organization-Ownership)
        F1-->>API: Ownership structure, UBOs,<br/>blocking entities, shareholders
        API-->>UI: Ownership tree + UBO list + blocking entities
        UI-->>Customer: Display ownership tree & identified UBOs
    end

    rect rgb(255, 245, 255)
        Note over Customer, F1: Step 4 — UBO Contact Details & Review
        Customer->>UI: Review individuals (directors, UBOs)
        Customer->>UI: Edit / add missing details<br/>(name, DOB, address)
        Customer->>UI: Optionally add manual UBOs
        opt Blocking Entities (e.g. Trusts)
            UI-->>Customer: Show blocking entities requiring docs
            Customer->>UI: Upload trust deed / supporting docs
            UI->>API: POST /api/documents/upload + /analyze
            API->>F1: Document analysis
            F1-->>API: Extracted trust details
        end
        Customer->>UI: Confirm & proceed to KYC
    end

    rect rgb(248, 248, 255)
        Note over Customer, F1: Step 5 — KYC Verification
        loop For each individual (UBO / Director)
            Customer->>UI: Click "Verify" on individual
            UI->>API: POST /api/kyc/verify<br/>(name, DOB, address)
            API->>F1: v2 individuals (create or update)
            API->>F1: Link individual to organization
            API->>F1: v2 individuals/{id}/workflows/execute
            F1-->>API: Workflow result<br/>(PASS / FAIL / REFER)
            API-->>UI: KycResult (overall result,<br/>risk level, check details)
            UI-->>Customer: Show verification result<br/>(pass/fail/refer badge)
        end
    end

    rect rgb(255, 255, 240)
        Note over Customer, F1: Step 6 — Business AML Screening
        UI->>API: POST /api/business/aml-status
        API->>F1: v2 organizations/{id}/serviceprofiles<br/>/workflows/execution
        F1-->>API: AML/sanctions result + risk level
        API-->>UI: Business AML status
    end

    rect rgb(240, 255, 240)
        Note over Customer, F1: Step 7 — Results Dashboard
        UI-->>Customer: Full onboarding summary:<br/>- Business profile<br/>- Ownership structure<br/>- Individual KYC results (pass/fail/refer)<br/>- Business AML status<br/>- Risk assessment
    end
