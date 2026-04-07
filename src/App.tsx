import { useEffect, useMemo, useState } from "react";

type FieldMapping = Record<string, string>;

type SyncLog = {
  id: string;
  timestamp: string;
  status: "success" | "error" | "warning";
  message: string;
};

const SITE_ID = "demo-site";
const defaultMapping: FieldMapping = {
  email: "email",
  firstName: "firstname",
  lastName: "lastname",
  company: "company",
  customField: "custom_property",
};

const availableForms = [
  { id: "contact", label: "Contact Us" },
  { id: "newsletter", label: "Newsletter Signup" },
  { id: "demo", label: "Demo Request" },
];

const hubspotProperties = [
  { id: "email", label: "hubspot.email" },
  { id: "firstname", label: "hubspot.firstname" },
  { id: "lastname", label: "hubspot.lastname" },
  { id: "company", label: "hubspot.company" },
  { id: "custom_property", label: "hubspot.custom_property" },
];

const sampleContact = {
  email: "jane.doe@example.com",
  firstName: "Jane",
  lastName: "Doe",
  company: "Wix App",
  customField: "HubSpot sync demo",
};

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [hubspotAccount, setHubspotAccount] = useState("");
  const [selectedForms, setSelectedForms] = useState<Record<string, boolean>>({
    contact: true,
    newsletter: false,
    demo: false,
  });
  const [fieldMapping, setFieldMapping] =
    useState<FieldMapping>(defaultMapping);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [pending, setPending] = useState(false);
  const [showEmbedCode, setShowEmbedCode] = useState(false);

  useEffect(() => {
    refreshStatus();
  }, []);

  const addLog = (status: SyncLog["status"], message: string) => {
    setSyncLogs((current) => [
      {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        status,
        message,
      },
      ...current,
    ]);
  };

  const refreshStatus = async () => {
    try {
      const response = await fetch(`/api/hubspot/status?siteId=${SITE_ID}`);
      const data = await response.json();

      setIsConnected(data.connected ?? false);
      setHubspotAccount(data.hubspotAccount ?? "HubSpot connected");
      setFieldMapping(data.mapping ?? defaultMapping);
      setSelectedForms(
        data.forms ?? { contact: true, newsletter: false, demo: false },
      );
    } catch {
      addLog(
        "warning",
        "Unable to read backend status. Start the HubSpot server first.",
      );
    }
  };

  const connectHubSpot = () => {
    window.location.href = `/api/hubspot/oauth/start?siteId=${SITE_ID}`;
  };

  const disconnectHubSpot = async () => {
    try {
      await fetch(`/api/hubspot/disconnect?siteId=${SITE_ID}`, {
        method: "POST",
      });
      setIsConnected(false);
      setHubspotAccount("");
      addLog("warning", "HubSpot connection removed.");
    } catch {
      addLog("error", "Failed to disconnect HubSpot.");
    }
  };

  const saveMapping = async (mapping: FieldMapping) => {
    try {
      await fetch(`/api/settings/mapping?siteId=${SITE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: SITE_ID, mapping }),
      });
    } catch {
      addLog("warning", "Unable to persist field mapping to the backend.");
    }
  };

  const saveForms = async (forms: Record<string, boolean>) => {
    try {
      await fetch(`/api/settings/forms?siteId=${SITE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: SITE_ID, forms }),
      });
    } catch {
      addLog("warning", "Unable to persist form settings to the backend.");
    }
  };

  const toggleForm = async (id: string) => {
    const nextForms = { ...selectedForms, [id]: !selectedForms[id] };
    setSelectedForms(nextForms);
    await saveForms(nextForms);
  };

  const updateMapping = async (field: string, value: string) => {
    const nextMapping = { ...fieldMapping, [field]: value };
    setFieldMapping(nextMapping);
    await saveMapping(nextMapping);
  };

  const activeForms = useMemo(
    () =>
      availableForms
        .filter((form) => selectedForms[form.id])
        .map((form) => form.label),
    [selectedForms],
  );

  const handleSampleSubmit = async () => {
    if (!isConnected) {
      addLog("error", "Please connect HubSpot before syncing contacts.");
      return;
    }

    const enabledFormIds = Object.keys(selectedForms).filter(
      (key) => selectedForms[key],
    );
    if (enabledFormIds.length === 0) {
      addLog("warning", "Select at least one Wix form before syncing.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/sync/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: SITE_ID,
          formId: enabledFormIds[0],
          payload: sampleContact,
          mapping: fieldMapping,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        addLog("error", data.error || "Failed to sync sample submission.");
      } else {
        addLog(
          "success",
          `Sample contact synced to HubSpot for form ${enabledFormIds[0]}.`,
        );
      }
    } catch {
      addLog("error", "Network error while syncing sample submission.");
    } finally {
      setPending(false);
    }
  };

  const embedSnippet = useMemo(
    () =>
      `<script src="https://js.hsforms.net/forms/v2.js"></script>\n<script>\n  hbspt.forms.create({\n    portalId: "YOUR_PORTAL_ID",\n    formId: "YOUR_FORM_ID",\n    target: "#hubspot-form-embed"\n  });\n</script>`,
    [],
  );

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Wix + HubSpot sync</p>
          <h1>Build the HubSpot integration dashboard</h1>
          <p className="hero-copy">
            Configure connection, map fields, preview HubSpot embed code, and
            sync contacts from Wix forms into HubSpot.
          </p>
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="card">
          <div className="card-header">
            <div>
              <h2>HubSpot connection</h2>
              <p className="small-copy">OAuth backend is now live.</p>
            </div>
            <button
              className="primary-button"
              onClick={isConnected ? disconnectHubSpot : connectHubSpot}
            >
              {isConnected ? "Disconnect" : "Connect HubSpot"}
            </button>
          </div>

          <div className="status-row">
            <div>
              <p className="label">Connection status</p>
              <p className={isConnected ? "status success" : "status offline"}>
                {isConnected ? "Connected" : "Not connected"}
              </p>
            </div>
            <div>
              <p className="label">HubSpot account</p>
              <p>{isConnected ? hubspotAccount : "No account linked"}</p>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <h2>Sync settings</h2>
              <p className="small-copy">
                Choose which Wix forms should push contacts to HubSpot.
              </p>
            </div>
          </div>

          <div className="form-group">
            <p className="label">Selected Wix forms</p>
            <div className="checkbox-grid">
              {availableForms.map((form) => (
                <label key={form.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedForms[form.id]}
                    onChange={() => toggleForm(form.id)}
                  />
                  {form.label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <p className="label">Field mappings</p>
            <div className="mapping-grid">
              {Object.entries(fieldMapping).map(([field, mapped]) => (
                <div key={field} className="mapping-row">
                  <label>
                    {field === "customField" ? "Custom field" : field}
                  </label>
                  <select
                    value={mapped}
                    onChange={(event) =>
                      updateMapping(field, event.target.value)
                    }
                  >
                    {hubspotProperties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <h2>HubSpot form embed</h2>
              <p className="small-copy">
                Preview the embed snippet you can inject into Wix pages.
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => setShowEmbedCode((current) => !current)}
            >
              {showEmbedCode ? "Hide embed" : "Show embed"}
            </button>
          </div>

          <div className="embed-panel">
            <div className="embed-placeholder" id="hubspot-form-embed">
              <p>HubSpot form preview area</p>
            </div>
            {showEmbedCode && <pre className="code-block">{embedSnippet}</pre>}
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <h2>Sync test</h2>
              <p className="small-copy">
                Send a sample submission to HubSpot using the backend contact
                sync endpoint.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={handleSampleSubmit}
              disabled={pending}
            >
              {pending ? "Syncing…" : "Send sample submission"}
            </button>
          </div>

          <div className="sync-info">
            <p className="label">Active sync</p>
            <p>
              {activeForms.length
                ? activeForms.join(", ")
                : "No forms selected"}
            </p>
          </div>

          <div className="sync-details">
            <p className="label">Mapped email field</p>
            <p>{fieldMapping.email}</p>
          </div>
        </article>

        <article className="card log-panel">
          <div className="card-header">
            <div>
              <h2>Sync activity log</h2>
              <p className="small-copy">
                Latest HubSpot connection and sync events.
              </p>
            </div>
          </div>

          {syncLogs.length === 0 ? (
            <p className="empty-state">
              No activity yet. Run a test sync to generate log entries.
            </p>
          ) : (
            <div className="log-list">
              {syncLogs.map((entry) => (
                <div key={entry.id} className={`log-entry ${entry.status}`}>
                  <div>
                    <span className="log-time">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="log-status">
                      {entry.status.toUpperCase()}
                    </span>
                  </div>
                  <p>{entry.message}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export default App;
