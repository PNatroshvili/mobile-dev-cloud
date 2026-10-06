const services = [
  { name: "GitHub", status: "Ready", detail: "Repository integration" },
  { name: "Workspace", status: "Ready", detail: "Runtime orchestration" },
  { name: "Expo Preview", status: "Planned", detail: "Live React Native Web preview" },
  { name: "Android Emulator", status: "Planned", detail: "Browser-streamed Android" },
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">SKUP / MOBILE DEV CLOUD</div>
          <h1>Build mobile apps from your browser.</h1>
          <p className="subtitle">
            Connect GitHub, start a workspace, and preview React Native / Expo changes live.
          </p>
        </div>
        <div className="connection"><span className="dot" /> Control plane online</div>
      </header>

      <section className="hero-grid">
        <div className="card workspace-card">
          <div className="card-head">
            <div>
              <span className="label">WORKSPACE</span>
              <h2>LUKMA</h2>
            </div>
            <span className="pill">Ready to connect</span>
          </div>
          <div className="repo-row">
            <div className="repo-icon">GH</div>
            <div>
              <strong>PNatroshvili/lukma-mobile</strong>
              <span>React Native · Expo · TypeScript</span>
            </div>
          </div>
          <div className="controls">
            <label>
              Repository
              <select defaultValue="lukma">
                <option value="lukma">PNatroshvili/lukma-mobile</option>
              </select>
            </label>
            <label>
              Branch
              <select defaultValue="feature/home-discovery-foundation">
                <option>feature/home-discovery-foundation</option>
                <option>main</option>
              </select>
            </label>
          </div>
          <button className="primary">Start workspace</button>
        </div>

        <div className="card preview-card">
          <div className="card-head">
            <div>
              <span className="label">LIVE PREVIEW</span>
              <h2>Browser device</h2>
            </div>
            <span className="pill muted">Not started</span>
          </div>
          <div className="device-wrap">
            <div className="phone">
              <div className="notch" />
              <div className="phone-screen">
                <span className="preview-logo">LUKMA</span>
                <span className="preview-copy">Your mobile preview will appear here.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lower-grid">
        <div className="card terminal">
          <div className="card-head">
            <div>
              <span className="label">TERMINAL</span>
              <h2>Workspace console</h2>
            </div>
            <span className="pill muted">Waiting</span>
          </div>
          <pre><code>$ mobile-dev-cloud start lukma
&gt; workspace not started
&gt; select Start workspace to provision runtime</code></pre>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <span className="label">SERVICES</span>
              <h2>Runtime stack</h2>
            </div>
          </div>
          <div className="service-list">
            {services.map((service) => (
              <div className="service" key={service.name}>
                <div><strong>{service.name}</strong><span>{service.detail}</span></div>
                <span className={service.status === "Ready" ? "status ready" : "status planned"}>{service.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}