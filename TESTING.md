# Testing Guide - Wix HubSpot Integration

## Test Scenarios

### Scenario 1: OAuth Connection Flow

**Steps:**
1. Start backend: `npm run dev:server`
2. Start frontend: `npm run dev` (in another terminal)
3. Visit `http://localhost:5173`
4. Click "Connect HubSpot" button
5. Observe: OAuth redirect URL displays in address bar

**Expected Result:**
- Button changes to "Disconnect"
- Connection status shows "Connected"
- Activity log shows "HubSpot connection established"

**Test with Real HubSpot:**
- Complete the OAuth flow on HubSpot's auth screen
- Grant requested scopes
- Get redirected back with message: "✓ HubSpot Connected"

### Scenario 2: Field Mapping Configuration

**Steps:**
1. With HubSpot connected, navigate to "Sync settings" card
2. In "Field mappings" section, change mapping:
   - Wix "Email" → HubSpot "company"
   - Wix "Company" → HubSpot "email"
3. Click elsewhere or wait 1 second (auto-save)
4. Refresh page

**Expected Result:**
- Mappings persist after refresh
- New mappings are restored from backend
- Activity log shows no errors

### Scenario 3: Form Selection

**Steps:**
1. In "Sync settings" card, select/deselect forms:
   - Check: "Contact Us"
   - Uncheck: "Newsletter Signup"
2. Click "Send sample submission"

**Expected Result:**
- Only checked forms are logged
- Activity shows "Active sync: Contact Us"
- Deselected forms don't appear in logs

### Scenario 4: Contact Sync (Wix → HubSpot)

**Steps:**
1. Verify HubSpot is connected
2. Verify at least one form is selected
3. In "Sync test" card, click "Send sample submission"
4. Watch activity log update in real-time

**Expected Result:**
- Button shows "Syncing…" then resets
- New log entry: "Sample contact synced to HubSpot for form contact"
- Status: SUCCESS (green border)
- Timestamp shows current time

**With Real HubSpot:**
- Log in to HubSpot
- Go to Contacts
- Find contact with email `jane.doe@example.com`
- Verify properties match the mapped fields

### Scenario 5: Form Submission with UTM Tracking

**Steps:**
1. Call backend endpoint directly:
   ```bash
   curl -X POST http://localhost:4000/api/sync/form-submission \
     -H "Content-Type: application/json" \
     -d '{
       "siteId": "demo-site",
       "email": "utm.test@example.com",
       "firstName": "UTM",
       "lastName": "Test",
       "formId": "contact_form",
       "utm": {
         "source": "google",
         "medium": "cpc",
         "campaign": "spring_sale",
         "term": "wix hubspot",
         "content": "video_ad"
       },
       "pageUrl": "https://example.com/contact",
       "referrer": "https://google.com"
     }'
   ```

**Expected Result:**
```json
{
  "success": true,
  "contactId": "601",
  "message": "Form submission captured in HubSpot"
}
```

**Verify in HubSpot:**
- Contact properties include:
  - `utm_source: "google"`
  - `utm_medium: "cpc"`
  - `utm_campaign: "spring_sale"`
  - `wix_page_url: "https://example.com/contact"`

### Scenario 6: Activity Log & Sync History

**Activity Log Display:**
- Shows last 20 sync operations
- Sorted newest first
- Color coded by status: green (success), red (error), yellow (warning)
- Each entry shows timestamp, status, and message

**Endpoint Test:**
```bash
curl http://localhost:4000/api/sync/activity?siteId=demo-site
```

**Expected Response:**
```json
{
  "activity": [
    {
      "siteId": "demo-site",
      "contactId": "jane.doe@example.com",
      "externalId": "601",
      "source": "wix",
      "operation": "create",
      "syncId": "uuid-...",
      "timestamp": 1712347200000,
      "status": "success"
    }
  ]
}
```

### Scenario 7: Loop Prevention

**Test Deduplication Window:**
1. Send sample submission
2. Immediately (within 2 seconds) send another
3. Check activity log

**Expected Result:**
- First sync succeeds
- Second sync completes but note indicates "deduplicated" or skipped

**Backend Test:**
```bash
curl -X POST http://localhost:4000/api/webhook/hubspot/contact \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "contact.propertyChange",
    "objectId": "601"
  }'
```

**Expected Log:**
```
[WEBHOOK] HubSpot contact event: contact.propertyChange
[WEBHOOK] Skipping - caused by our own write (dedup window)
```

### Scenario 8: Disconnect & Reconnect

**Steps:**
1. Click "Disconnect HubSpot"
2. Verify status changes to "Not connected"
3. Activity log shows "HubSpot connection removed"
4. Try to send sample submission

**Expected Result:**
- Error: "Please connect HubSpot before syncing contacts"
- Can reconnect by clicking "Connect HubSpot" again

### Scenario 9: Backend Status Endpoint

**Test:**
```bash
curl http://localhost:4000/api/hubspot/status?siteId=demo-site
```

**Expected Response (Connected):**
```json
{
  "connected": true,
  "mapping": {
    "email": "email",
    "firstName": "firstname",
    ...
  },
  "forms": {
    "contact": true,
    "newsletter": false,
    "demo": false
  },
  "syncDirection": "bi-directional",
  "conflictResolution": "last-updated-wins",
  "hubspotAccount": "Connected with HubSpot",
  "expiresAt": 1712517600000
}
```

## Known Limitations (MVP)

1. **No Real Wix Integration** - Uses mock sample contact
2. **No Webhook Registration** - Webhook endpoint is placeholder
3. **No Database** - Uses JSON file storage (not production-ready)
4. **No Queue System** - Sync is synchronous (not reliable for retries)
5. **Mock Wix API** - Real app would integrate Wix Contacts API

## Test Credentials

### Demo Site ID
```
SITE_ID = "demo-site"
```

### Sample Contact Data
```json
{
  "email": "jane.doe@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "company": "Wix App",
  "customField": "HubSpot sync demo"
}
```

### HubSpot OAuth Scopes Required
- `crm.objects.contacts.read` - Read contacts from HubSpot
- `crm.objects.contacts.write` - Create/update contacts
- `forms` - Access HubSpot forms
- `automation` - Trigger automations

## Troubleshooting

### Issue: "Cannot sync: HubSpot is not connected"
**Solution:** Click "Connect HubSpot" and complete OAuth flow

### Issue: Backend returns 500 error
**Check:**
1. Backend is running: `npm run dev:server`
2. `.env` has valid PORT (default 4000)
3. Check terminal for error message

### Issue: OAuth flow redirects to error page
**Check:**
1. `HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET` are correct
2. `HUBSPOT_REDIRECT_URI` matches app settings: `http://localhost:4000/api/hubspot/oauth/callback`
3. Login to HubSpot account before initiating OAuth

### Issue: Form submission succeeds but contact not in HubSpot
**Check:**
1. Email field is mapped to `email` property (required)
2. HubSpot contact was created with that email
3. Check sync log timestamp vs contact creation time

## Performance Notes

- Sync operations: ~500ms-2s depending on HubSpot API latency
- Sync log retention: 30 days
- Activity log display: Last 20 entries (sorted by date)
- Deduplication window: 5 seconds

## Manual Integration Test

Without automated test suite, follow these steps to verify core features:

1. **Connection** ✓
   - OAuth flow works
   - Token stored securely
   - Status endpoint returns connected

2. **Sync** ✓
   - Sample contact sends to HubSpot
   - Contact ID is captured
   - Activity log records operation

3. **Field Mapping** ✓
   - User can modify mappings
   - Changes persist across page reload
   - Mappings are used in sync operations

4. **Loop Prevention** ✓
   - Webhook dedup window prevents re-processing
   - Source tracking prevents duplicate updates
   - Idempotency prevents unnecessary writes

5. **Error Handling** ✓
   - 401 errors trigger token refresh
   - Network errors are logged
   - UI shows user-friendly error messages
