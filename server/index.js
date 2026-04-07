import express from "express";
import cors from "cors";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createHmac } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const storageFile = path.join(dataDir, "storage.json");
const syncLogFile = path.join(dataDir, "sync_log.json");
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;
const DEFAULT_SITE_ID = "demo-site";
const DEFAULT_MAPPING = {
  email: "email",
  firstName: "firstname",
  lastName: "lastname",
  company: "company",
  customField: "custom_property",
};
const DEDUP_WINDOW_MS = 5000;
const SYNC_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

async function ensureStorageFile() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(storageFile);
  } catch {
    await fs.writeFile(storageFile, JSON.stringify({}, null, 2));
  }

  try {
    await fs.access(syncLogFile);
  } catch {
    await fs.writeFile(syncLogFile, JSON.stringify([], null, 2));
  }
}

async function readStorage() {
  try {
    const contents = await fs.readFile(storageFile, "utf8");
    return JSON.parse(contents || "{}");
  } catch {
    return {};
  }
}

async function writeStorage(store) {
  await fs.writeFile(storageFile, JSON.stringify(store, null, 2));
}

async function readSyncLog() {
  try {
    const contents = await fs.readFile(syncLogFile, "utf8");
    return JSON.parse(contents || "[]");
  } catch {
    return [];
  }
}

async function writeSyncLog(log) {
  const nowMs = Date.now();
  const filtered = log.filter(
    (entry) => nowMs - entry.timestamp < SYNC_LOG_TTL_MS,
  );
  await fs.writeFile(syncLogFile, JSON.stringify(filtered, null, 2));
}

async function addSyncLogEntry(
  siteId,
  contactId,
  externalId,
  source,
  operation,
) {
  const log = await readSyncLog();
  const entry = {
    siteId,
    contactId,
    externalId,
    source,
    operation,
    syncId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    status: "success",
  };
  log.push(entry);
  await writeSyncLog(log);
  return entry;
}

async function findSyncEntry(
  siteId,
  source,
  contactId = null,
  externalId = null,
) {
  const log = await readSyncLog();
  return log.find(
    (entry) =>
      entry.siteId === siteId &&
      entry.source === source &&
      (contactId ? entry.contactId === contactId : true) &&
      (externalId ? entry.externalId === externalId : true),
  );
}

async function loadSiteState(siteId) {
  const store = await readStorage();
  return (
    store[siteId] || {
      oauth: null,
      mapping: DEFAULT_MAPPING,
      forms: { contact: true, newsletter: false, demo: false },
      syncDirection: "bi-directional",
      conflictResolution: "last-updated-wins",
    }
  );
}

async function saveSiteState(siteId, state) {
  const store = await readStorage();
  store[siteId] = { ...(store[siteId] || {}), ...state };
  await writeStorage(store);
}

function getSiteId(req) {
  return String(req.query.siteId || req.body.siteId || DEFAULT_SITE_ID);
}

function hubspotAuthorizeUrl(siteId) {
  const state = encodeURIComponent(siteId);
  const scope = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "forms",
    "automation",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state,
  });

  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

async function exchangeAuthCode(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  }).toString();

  const response = await axios.post(
    "https://api.hubapi.com/oauth/v1/token",
    body,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );

  return response.data;
}

async function refreshAccessToken(siteId, tokenData) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: tokenData.refresh_token,
  }).toString();

  const response = await axios.post(
    "https://api.hubapi.com/oauth/v1/token",
    body,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );

  const refreshed = response.data;
  const expiresAt = Date.now() + refreshed.expires_in * 1000;
  await saveSiteState(siteId, {
    oauth: {
      ...tokenData,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: expiresAt,
      scopes: refreshed.scope?.split(" ") || tokenData.scopes || [],
    },
  });

  return {
    ...tokenData,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: expiresAt,
  };
}

async function getAuthHeaders(siteId) {
  const state = await loadSiteState(siteId);
  const oauth = state.oauth;
  if (!oauth || !oauth.access_token) {
    throw new Error("HubSpot is not connected for this site.");
  }

  if (oauth.expires_at && Date.now() > oauth.expires_at - 60_000) {
    const refreshed = await refreshAccessToken(siteId, oauth);
    return { Authorization: `Bearer ${refreshed.access_token}` };
  }

  return { Authorization: `Bearer ${oauth.access_token}` };
}

async function findContactByEmail(accessToken, email) {
  const response = await axios.post(
    "https://api.hubapi.com/crm/v3/objects/contacts/search",
    {
      filterGroups: [
        {
          filters: [{ propertyName: "email", operator: "EQ", value: email }],
        },
      ],
      properties: ["email"],
      limit: 1,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data.results?.[0]?.id || null;
}

function mapPayloadToHubSpotProperties(payload, mapping) {
  return Object.entries(mapping).reduce(
    (properties, [wixField, hubspotField]) => {
      const value = payload[wixField];
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        properties[hubspotField] = String(value);
      }
      return properties;
    },
    {},
  );
}

app.get("/api/hubspot/status", async (req, res) => {
  try {
    const siteId = getSiteId(req);
    const state = await loadSiteState(siteId);
    const connected = Boolean(state.oauth?.access_token);
    res.json({
      connected,
      mapping: state.mapping ?? DEFAULT_MAPPING,
      forms: state.forms,
      hubspotAccount: state.oauth?.hubspotAccount || null,
      expiresAt: state.oauth?.expires_at || null,
    });
  } catch (error) {
    res.status(500).json({ error: "Unable to read HubSpot status." });
  }
});

app.get("/api/hubspot/oauth/start", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res
      .status(500)
      .send(
        "Missing HubSpot OAuth configuration. Add HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, and HUBSPOT_REDIRECT_URI to your environment.",
      );
  }

  const siteId = getSiteId(req);
  res.redirect(hubspotAuthorizeUrl(siteId));
});

app.get("/api/hubspot/oauth/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || DEFAULT_SITE_ID);
  const siteId = state;

  if (!code) {
    return res.status(400).send("Missing HubSpot authorization code.");
  }

  try {
    const tokenData = await exchangeAuthCode(code);
    const expiresAt = Date.now() + tokenData.expires_in * 1000;
    await saveSiteState(siteId, {
      oauth: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        scopes: tokenData.scope?.split(" ") || [],
        hubspotAccount: `Connected with HubSpot scopes: ${tokenData.scope}`,
      },
    });

    res.send(
      `<html><body><h1>HubSpot connected</h1><p>You can now return to the Wix app dashboard.</p></body></html>`,
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to complete HubSpot OAuth flow.");
  }
});

app.post("/api/hubspot/disconnect", async (req, res) => {
  try {
    const siteId = getSiteId(req);
    await saveSiteState(siteId, {
      oauth: null,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not disconnect HubSpot." });
  }
});

app.get("/api/settings/mapping", async (req, res) => {
  try {
    const siteId = getSiteId(req);
    const state = await loadSiteState(siteId);
    res.json({ mapping: state.mapping ?? DEFAULT_MAPPING });
  } catch (error) {
    res.status(500).json({ error: "Unable to load field mapping." });
  }
});

app.post("/api/settings/mapping", async (req, res) => {
  try {
    const siteId = getSiteId(req);
    const mapping = req.body.mapping ?? DEFAULT_MAPPING;
    await saveSiteState(siteId, { mapping });
    res.json({ mapping });
  } catch (error) {
    res.status(500).json({ error: "Unable to save field mapping." });
  }
});

app.get("/api/settings/forms", async (req, res) => {
  try {
    const siteId = getSiteId(req);
    const state = await loadSiteState(siteId);
    res.json({
      forms: state.forms || { contact: true, newsletter: false, demo: false },
    });
  } catch (error) {
    res.status(500).json({ error: "Unable to load form settings." });
  }
});

app.post("/api/settings/forms", async (req, res) => {
  try {
    const siteId = getSiteId(req);
    const forms = req.body.forms || {
      contact: true,
      newsletter: false,
      demo: false,
    };
    await saveSiteState(siteId, { forms });
    res.json({ forms });
  } catch (error) {
    res.status(500).json({ error: "Unable to save form settings." });
  }
});

app.post("/api/sync/contact", async (req, res) => {
  try {
    const siteId = getSiteId(req);
    const { payload, mapping } = req.body;
    const state = await loadSiteState(siteId);

    if (!state.oauth?.access_token) {
      return res
        .status(400)
        .json({ error: "HubSpot is not connected for this site." });
    }

    const hubspotMapping = mapping || state.mapping || DEFAULT_MAPPING;
    const properties = mapPayloadToHubSpotProperties(payload, hubspotMapping);
    const email = properties.email;

    if (!email) {
      return res
        .status(400)
        .json({ error: "Email is required in mapped contact data." });
    }

    const headers = await getAuthHeaders(siteId);
    const contactId = await findContactByEmail(
      headers.Authorization.replace("Bearer ", ""),
      email,
    );

    let result;
    if (contactId) {
      result = await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
        { properties },
        { headers: { ...headers, "Content-Type": "application/json" } },
      );
      await addSyncLogEntry(siteId, email, contactId, "wix", "update");
    } else {
      result = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/contacts",
        { properties },
        { headers: { ...headers, "Content-Type": "application/json" } },
      );
      await addSyncLogEntry(siteId, email, result.data.id, "wix", "create");
    }

    res.json({ success: true, contact: result.data });
  } catch (error) {
    console.error(error?.response?.data || error.message || error);
    res.status(500).json({ error: "Failed to sync contact to HubSpot." });
  }
});

app.post("/api/sync/form-submission", async (req, res) => {
  try {
    const siteId = getSiteId(req);
    const { email, firstName, lastName, formId, utm, pageUrl, referrer } =
      req.body;
    const state = await loadSiteState(siteId);

    if (!state.oauth?.access_token) {
      return res.status(400).json({ error: "HubSpot is not connected." });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const headers = await getAuthHeaders(siteId);
    const accessToken = headers.Authorization.replace("Bearer ", "");
    const contactId = await findContactByEmail(accessToken, email);

    const properties = {
      email,
      firstname: firstName || "",
      lastname: lastName || "",
      hs_lead_source: formId || "wix_form",
      wix_form_id: formId,
      wix_page_url: pageUrl,
      wix_referrer: referrer || "",
      utm_source: utm?.source || "",
      utm_medium: utm?.medium || "",
      utm_campaign: utm?.campaign || "",
      utm_term: utm?.term || "",
      utm_content: utm?.content || "",
    };

    let result;
    if (contactId) {
      result = await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
        { properties },
        { headers: { ...headers, "Content-Type": "application/json" } },
      );
    } else {
      result = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/contacts",
        { properties },
        { headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    await addSyncLogEntry(
      siteId,
      email,
      result.data.id,
      "wix",
      "form_submission",
    );

    res.json({
      success: true,
      contactId: result.data.id,
      message: "Form submission captured in HubSpot",
    });
  } catch (error) {
    console.error(
      "Form submission error:",
      error?.response?.data || error.message,
    );
    res.status(500).json({ error: "Failed to capture form submission." });
  }
});

app.post("/api/webhook/hubspot/contact", async (req, res) => {
  try {
    const siteId = DEFAULT_SITE_ID;
    const event = req.body;

    console.log(`[WEBHOOK] HubSpot contact event: ${event.eventType}`);

    const recentEntry = await findSyncEntry(siteId, "wix");
    if (recentEntry && Date.now() - recentEntry.timestamp < DEDUP_WINDOW_MS) {
      console.log(
        "[WEBHOOK] Skipping - caused by our own write (dedup window)",
      );
      return res.json({ success: true, deduplicated: true });
    }

    await addSyncLogEntry(
      siteId,
      event.objectId,
      event.objectId,
      "hubspot",
      event.eventType,
    );

    console.log("[WEBHOOK] Event logged. Real Wix sync would occur here.");
    res.json({ success: true });
  } catch (error) {
    console.error("[WEBHOOK] Error:", error.message);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

app.get("/api/sync/activity", async (req, res) => {
  try {
    const siteId = getSiteId(req);
    const log = await readSyncLog();
    const siteLog = log
      .filter((entry) => entry.siteId === siteId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    res.json({ activity: siteLog });
  } catch (error) {
    res.status(500).json({ error: "Unable to fetch sync activity." });
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

await ensureStorageFile();

app.listen(PORT, () => {
  console.log(
    `🚀 HubSpot Wix Integration backend running on http://localhost:${PORT}`,
  );
  console.log(`📚 API Plan: See API_PLAN.md`);
  console.log(`📝 Endpoints:`);
  console.log(`   GET  /api/hubspot/status - Check connection status`);
  console.log(`   POST /api/sync/contact - Sync contact to HubSpot`);
  console.log(`   POST /api/sync/form-submission - Capture form with UTM`);
  console.log(`   GET  /api/sync/activity - View sync history`);
});
