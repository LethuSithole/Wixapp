# Wix-HubSpot Integration: API Plan

## Overview

This document outlines the APIs used to implement Feature #1 (Bi-Directional Contact Sync) and Feature #2 (Form & Lead Capture Integration).

---

## Feature #1: Bi-Directional Contact Sync

### Goal

Automatically sync contacts between Wix and HubSpot with conflict resolution and infinite loop prevention.

### APIs Used

#### 1. **Wix Contacts API**

- **Purpose**: Read/write contacts in Wix
- **Endpoints**:
  - `GET /contacts/v4/contacts` - List contacts with pagination
  - `GET /contacts/v4/contacts/{contactId}` - Get single contact
  - `POST /contacts/v4/contacts` - Create contact
  - `PATCH /contacts/v4/contacts/{contactId}` - Update contact
- **Authentication**: Wix OAuth token (from installation)
- **Use Case**: Pull contact changes, push updates from HubSpot

#### 2. **Wix Events (Webhooks)**

- **Purpose**: Listen for contact changes in real-time
- **Events**:
  - `contacts/contact.created` - New contact in Wix
  - `contacts/contact.updated` - Contact modified in Wix
  - `contacts/contact.deleted` - Contact removed from Wix
- **Authentication**: Webhook signature validation
- **Use Case**: Trigger sync when Wix contacts change

#### 3. **HubSpot CRM Contacts API**

- **Purpose**: Read/write contacts in HubSpot
- **Endpoints**:
  - `GET /crm/v3/objects/contacts` - List contacts with filtering
  - `GET /crm/v3/objects/contacts/{contactId}` - Get single contact
  - `POST /crm/v3/objects/contacts` - Create contact
  - `PATCH /crm/v3/objects/contacts/{contactId}` - Update contact with properties
  - `POST /crm/v3/objects/contacts/search` - Search by email
- **Authentication**: OAuth access token (user-provided)
- **Use Case**: Pull contact data, push updates from Wix

#### 4. **HubSpot CRM Properties API**

- **Purpose**: Get available contact properties for mapping
- **Endpoints**:
  - `GET /crm/v3/properties/contacts` - List all contact properties
- **Authentication**: OAuth access token
- **Use Case**: Populate property dropdown for field mapping UI

#### 5. **HubSpot Webhooks API**

- **Purpose**: Listen for contact changes in HubSpot
- **Endpoints**:
  - `POST /crm/v3/extensions/webhooks/subscriptions` - Create webhook subscription
  - `GET /crm/v3/extensions/webhooks/subscriptions` - List subscriptions
- **Events**:
  - `contact.creation` - New contact in HubSpot
  - `contact.propertyChange` - Contact property updated in HubSpot
  - `contact.deletion` - Contact deleted from HubSpot
- **Authentication**: OAuth access token
- **Use Case**: Listen for HubSpot changes to sync back to Wix

### Sync Flow (Bi-Directional)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Wix Contact Updated                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
         Check sync_log for external ID mapping
         (WixContactId → HubSpotContactId)
                       │
            ┌──────────┴──────────┐
            │                     │
    Contact exists?      No: Create in HubSpot
         │                       │
         ▼                       ▼
   Update mapping            Map Wix fields
   Apply field mapping       Store correlation ID
   Send to HubSpot           Record sync timestamp
   Store source=wix          Record source=wix
   Store syncId (UUID)       ← Prevents re-processing
   Record timestamp

         ┌──────────────────────────────────┐
         │  HubSpot Webhook: Contact Updated │
         └────────┬─────────────────────────┘
                  │
                  ▼
    Check sync_log: is source=wix?
         │                    │
      Yes: Skip            No: Continue
    (we caused this)
         │                    │
         └────────┬───────────┘
                  │
    Check timestamps for conflict
    (Last-updated-wins or HubSpot-wins rule)
                  │
                  ▼
         Apply field mapping
         Update Wix contact
         Record source=hubspot
         Update sync timestamp
```

### Loop Prevention Strategy

1. **Sync Correlation ID**
   - Every sync operation generates a UUID (`syncId`)
   - Stored in both sync_log and contact metadata
   - When webhook fires, check if syncId matches recent write

2. **Source Tracking**
   - Track which system initiated the change (wix|hubspot)
   - Ignore webhook events that originated from our own writes

3. **Deduplication Window**
   - 5-second window after a write before processing related events
   - If same field changes within window, skip

4. **Idempotency**
   - Before updating, compare values; skip if identical
   - Use external ID mapping to find contact uniquely

5. **Sync State Log**
   - Table: `sync_log` (contactId, externalId, source, syncId, timestamp, status)
   - Allows replay detection and debugging

---

## Feature #2: Form & Lead Capture Integration

### Goal

Capture form submissions (Wix or HubSpot) with UTM/attribution and sync to HubSpot as leads/contacts.

### APIs Used

#### 1. **Wix Forms API**

- **Purpose**: Capture form submissions
- **Endpoints**:
  - `GET /forms/v4/forms` - List forms
  - `POST /forms/v4/submissions` - Create submission programmatically (if needed)
- **Webhooks**:
  - `forms/form.submission.created` - New form submission
- **Authentication**: Wix OAuth token
- **Use Case**: Listen for Wix form submissions, extract data

#### 2. **Wix Tracking API** (Optional)

- **Purpose**: Capture UTM parameters and page context
- **Endpoints**:
  - Client-side: Extract `utm_*` from URL query params
  - Track via custom properties
- **Use Case**: Store attribution in Wix form data

#### 3. **HubSpot CRM Contacts/Deals API**

- **Purpose**: Create/update contact and link to deal/lead
- **Endpoints**:
  - `POST /crm/v3/objects/contacts` - Create lead as contact
  - `POST /crm/v3/objects/deals` - Create associated deal
  - `PUT /crm/v3/objects/contacts/{contactId}/associations` - Link contact to deal
- **Authentication**: OAuth access token
- **Use Case**: Push form submission as HubSpot contact with source/UTM properties

#### 4. **HubSpot Custom Properties API** (Related to #3)

- **Purpose**: Store custom attribution fields
- **Property Examples**:
  - `hs_lead_source` (from Wix form)
  - `utm_source`, `utm_medium`, `utm_campaign`, etc.
  - `wix_form_id`, `wix_page_url`
  - `wix_referrer`, `submission_timestamp`
- **Use Case**: Preserve full context in HubSpot for reporting

### Form Capture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│            User Submits Wix Form                               │
│      (email, name, custom fields)                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
         Extract UTM parameters from URL:
         utm_source, utm_medium, utm_campaign, utm_term, utm_content
                       │
         Extract page context:
         current_url, referrer, timestamp
                       │
                       ▼
      Build HubSpot contact payload:
      {
        properties: {
          email: "user@example.com",
          firstname: "John",
          lastname: "Doe",
          hs_lead_source: "wix_form",
          wix_form_id: "contact_form",
          wix_page_url: "https://example.com/contact",
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: "summer_sale",
          custom_field: "value"
        }
      }
                       │
                       ▼
       Call HubSpot Create/Update:
       POST /crm/v3/objects/contacts
       (or PATCH if email exists)
                       │
                       ▼
    ┌─ Store submission event in sync_log
    │  (for audit trail)
    │
    ▼
   Success: Log in activity feed
   Error: Retry with exponential backoff
```

---

## Security & Authentication

### OAuth 2.0 Flow

1. **User clicks "Connect HubSpot"** → Redirected to HubSpot OAuth
2. **HubSpot returns auth code** → Backend exchanges for tokens
3. **Tokens stored securely**:
   - Access token (short-lived, ~5 min)
   - Refresh token (long-lived, ~1 year)
   - Store in encrypted Secret Manager per site
4. **Token refresh**: Backend automatically refreshes before expiry
5. **Wix OAuth**: Already handled by Wix App SDK (implicit)

### Scopes Required

**HubSpot OAuth Scopes:**

- `crm.objects.contacts.read` - Read contacts
- `crm.objects.contacts.write` - Create/update contacts
- `crm.objects.deals.read` - Read deals (for linking)
- `crm.objects.deals.write` - Create deals
- `crm.schemas.contacts.read` - Read contact properties
- `crm.schemas.contacts.write` - Create custom properties (if needed)
- `crm.objects.contacts.write` - Required for all writes

### Endpoint Authentication

All sync endpoints require:

- `Authorization: Bearer <wix_oauth_token>` (app-level)
- `siteId` parameter (multi-tenant)
- Request signature validation (for webhooks)

---

## Data Storage Schema

### Table: `sync_config`

```
{
  siteId: string,
  hubspotAccessToken: string (encrypted),
  hubspotRefreshToken: string (encrypted),
  hubspotTokenExpiresAt: number,
  fieldMapping: {
    "wix_field": "hubspot_property"
  },
  syncDirection: "bi-directional" | "wix-to-hubspot" | "hubspot-to-wix",
  conflictResolution: "last-updated-wins" | "hubspot-wins" | "wix-wins",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Table: `sync_log`

```
{
  siteId: string,
  contactId: string (Wix contactId),
  externalId: string (HubSpot contactId),
  source: "wix" | "hubspot",
  syncId: string (UUID),
  operation: "create" | "update" | "delete",
  status: "success" | "error" | "pending",
  errorMessage?: string,
  timestamp: number,
  expiresAt: number (TTL: 30 days)
}
```

### Table: `submission_log`

```
{
  siteId: string,
  formId: string,
  email: string,
  hubspotContactId?: string,
  utm: {
    source, medium, campaign, term, content
  },
  pageUrl: string,
  referrer?: string,
  timestamp: number,
  expiresAt: number (TTL: 90 days)
}
```

---

## Error Handling & Retries

- **Network errors**: Exponential backoff (1s → 2s → 4s → 8s), max 3 retries
- **Rate limits (429)**: Wait for `Retry-After` header
- **Invalid token (401)**: Refresh token; if fails, mark app disconnected
- **Conflict (409)**: Log event; apply conflict resolution rule
- **Other errors**: Log and alert via dashboard; allow manual retry

---

## Deliverable Checklist

- [x] OAuth connect/disconnect via dashboard
- [x] Field-mapping table UI + persistence
- [ ] Bi-directional contact sync with loop prevention
- [ ] Wix form → HubSpot lead capture with UTM/source context
- [x] Secure token storage
- [x] API endpoints documented
- [ ] Webhook handlers implemented
- [ ] Sync state tracking in database
- [ ] Error logging and retry logic
