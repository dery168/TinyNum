"use client";

import { FormEvent, useMemo, useState } from "react";
import "./page.css";

type Mode = "create" | "retrieve";

type Retrieved = {
  type: "text" | "url";
  value: string;
  expiresInMs: number;
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("create");
  const [value, setValue] = useState("");
  const [createKey, setCreateKey] = useState<number | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  const [lookupKey, setLookupKey] = useState("");
  const [retrieveBusy, setRetrieveBusy] = useState(false);
  const [retrieved, setRetrieved] = useState<Retrieved | null>(null);
  const [retrieveState, setRetrieveState] = useState<"idle" | "missing" | "error">("idle");

  const ttlText = useMemo(() => {
    if (!retrieved) {
      return "";
    }

    const minutes = Math.max(0, Math.ceil(retrieved.expiresInMs / 60000));
    return `${minutes} min left`;
  }, [retrieved]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateKey(null);

    const payload = value.trim();
    if (!payload) {
      setCreateError("Please add text or URL.");
      return;
    }

    setCreateBusy(true);

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: payload }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setCreateError(result.error ?? "Failed to create key.");
        return;
      }

      const result = (await response.json()) as { key: number };
      setCreateKey(result.key);
    } catch {
      setCreateError("Network error while creating key.");
    } finally {
      setCreateBusy(false);
    }
  }

  async function onRetrieve(e: FormEvent) {
    e.preventDefault();
    setRetrieveState("idle");
    setRetrieved(null);

    const key = Number(lookupKey);
    if (!Number.isInteger(key) || key <= 0) {
      setRetrieveState("missing");
      return;
    }

    setRetrieveBusy(true);

    try {
      const response = await fetch(`/api/entries/${key}`);

      if (response.status === 404) {
        setRetrieveState("missing");
        return;
      }

      if (!response.ok) {
        setRetrieveState("error");
        return;
      }

      const result = (await response.json()) as Retrieved;
      setRetrieved(result);
    } catch {
      setRetrieveState("error");
    } finally {
      setRetrieveBusy(false);
    }
  }

  return (
    <div className="grain" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px 16px" }}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-wrap">
            <div className="logo">#</div>
            <div>
              <div className="brand">TinyNum</div>
              <div className="hint">share by number</div>
            </div>
          </div>
          <div className="row">
            <a className="btn secondary" href="/docs" target="_blank" rel="noreferrer">
              API Docs
            </a>
            <div className="meta">TTL: 10 min | public content</div>
          </div>
        </header>

        <div className="layout">
          <main className="main">
            <h1 className="title">Drop text or URL. Get a tiny integer key.</h1>
            <p className="subtitle">
              Save public text or links for quick sharing. Expired keys disappear silently after 10 minutes and can be reused.
            </p>

            <div className="tabs" aria-label="Mode switch">
              <button className={`tab ${mode === "create" ? "active" : ""}`} onClick={() => setMode("create")}>
                Create
              </button>
              <button className={`tab ${mode === "retrieve" ? "active" : ""}`} onClick={() => setMode("retrieve")}>
                Retrieve
              </button>
            </div>

            {mode === "create" ? (
              <section className="card">
                <form className="form" onSubmit={onCreate}>
                  <div className="user-notes" role="note" aria-label="Important notes">
                    <p>1. Only put the public information because everyone can see it.</p>
                    <p>2. Information will expired in 10 minutes and vanish forever.</p>
                  </div>

                  <div>
                    <label htmlFor="payload">Text or URL</label>
                    <textarea
                      id="payload"
                      maxLength={10000}
                      placeholder="Paste text or https://example.com"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </div>

                  <div className="row">
                    <button className="btn primary" type="submit" disabled={createBusy}>
                      {createBusy ? "Creating..." : "Create Key"}
                    </button>
                    <span className="hint">Max 10,000 chars</span>
                  </div>

                  {createError ? <p className="error">{createError}</p> : null}

                  {createKey ? (
                    <div className="result visible">
                      <div>
                        <div className="hint">Your key</div>
                        <div className="key">{createKey}</div>
                      </div>
                    </div>
                  ) : null}
                </form>
              </section>
            ) : (
              <section className="card">
                <form className="form" onSubmit={onRetrieve}>
                  <div>
                    <label htmlFor="lookup">Key</label>
                    <input
                      id="lookup"
                      type="number"
                      min={1}
                      placeholder="Enter a positive integer"
                      value={lookupKey}
                      onChange={(e) => setLookupKey(e.target.value)}
                    />
                  </div>

                  <div className="row">
                    <button className="btn primary" type="submit" disabled={retrieveBusy}>
                      {retrieveBusy ? "Resolving..." : "Resolve Key"}
                    </button>
                    <span className="hint">Missing or expired returns nothing</span>
                  </div>

                  {retrieveState === "missing" ? <p className="hint">No data found for this key.</p> : null}
                  {retrieveState === "error" ? <p className="error">Unable to retrieve data.</p> : null}

                  {retrieved?.type === "text" ? (
                    <div className="stack">
                      <h3>Stored Text</h3>
                      <p>{retrieved.value}</p>
                      <span className="pill ok">{ttlText}</span>
                    </div>
                  ) : null}

                  {retrieved?.type === "url" ? (
                    <div className="stack">
                      <h3>Stored URL</h3>
                      <p>{retrieved.value}</p>
                      <div className="row" style={{ marginTop: "10px" }}>
                        <a className="btn secondary" href={retrieved.value} target="_blank" rel="noreferrer">
                          Open URL
                        </a>
                        <span className="pill ok">{ttlText}</span>
                      </div>
                    </div>
                  ) : null}
                </form>
              </section>
            )}
          </main>

          <aside className="aside">
            <div className="stack">
              <h3>System Snapshot</h3>
              <p>
                Allocator returns smallest available positive integer. Expired keys are released and reused before new key growth.
              </p>
            </div>

            <div className="stack">
              <h3>Behavior Tags</h3>
              <div className="row">
                <span className="pill ok">auto-detect URL</span>
                <span className="pill ok">600s TTL</span>
                <span className="pill warn">silent miss</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
