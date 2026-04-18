import type { AgentStatusInfo, AgentDecisionInfo, ControllerMode } from "../../hooks/useAgentSocket";

interface AgentPanelProps {
  mode: ControllerMode;
  connected: boolean;
  agentStatus: AgentStatusInfo | null;
  lastDecision: AgentDecisionInfo | null;
  overrideCount: number;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: ok ? "#2adf90" : "#ff5566", marginRight: 5,
    }} />
  );
}

function StateLabel({ state }: { state: string }) {
  const color = state === "thinking" ? "#ffaa00" : state === "applying" ? "#4488ff" : "#2adf90";
  return <b style={{ color }}>{state}</b>;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function AgentPanel({ mode, connected, agentStatus, lastDecision, overrideCount }: AgentPanelProps) {
  if (mode === "human") return null;

  const status = agentStatus?.agentStatus;

  return (
    <div className="panel" style={{ borderColor: connected ? "#1a4a3a" : "#4a1a1a" }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <StatusDot ok={connected} />
        AI Agent
        <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#556", fontWeight: "normal" }}>
          {mode}
        </span>
      </h3>

      {!connected && (
        <div style={{ color: "#ff5566", fontSize: "0.75rem", padding: "4px 0" }}>
          Not connected to backend (localhost:3001)
        </div>
      )}

      {connected && (
        <>
          <div style={{ fontSize: "0.72rem", color: "#8ecfb0", marginBottom: 4 }}>
            <span style={{ color: "#556" }}>Model: </span>{agentStatus?.model ?? "—"}
            {"  "}
            <span style={{ color: "#556" }}>State: </span>
            <StateLabel state={status?.state ?? "idle"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "2px 8px", fontSize: "0.7rem", marginBottom: 6 }}>
            <span style={{ color: "#556" }}>Decisions</span>
            <span>{status?.decisionsTotal ?? 0}</span>
            <span style={{ color: "#556" }}>Rejections</span>
            <span>{status?.rejectionsTotal ?? 0}</span>
            <span style={{ color: "#556" }}>Overrides</span>
            <span style={{ color: overrideCount > 0 ? "#ff5566" : "inherit" }}>{overrideCount}</span>
            <span style={{ color: "#556" }}>Latency</span>
            <span>{status?.meanLatencyMs ? fmtMs(status.meanLatencyMs) : "—"}</span>
          </div>

          {lastDecision && (
            <div style={{ borderTop: "1px solid #1a4a3a", paddingTop: 6, marginTop: 4 }}>
              <div style={{ fontSize: "0.65rem", color: "#556", marginBottom: 2 }}>Last assessment</div>
              <div style={{ fontSize: "0.72rem", color: "#8ecfb0", lineHeight: 1.45, maxHeight: 72, overflowY: "auto" }}>
                {lastDecision.assessment}
              </div>
              {lastDecision.commands.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: "0.65rem", color: "#556", marginBottom: 2 }}>Commands issued</div>
                  {(lastDecision.commands as Array<{ type: string; callsign?: string; value?: number; runway?: string; reasoning: string }>)
                    .filter(c => c.type !== "noop")
                    .map((c, i) => (
                      <div key={i} style={{ fontSize: "0.68rem", color: "#67b08a", marginBottom: 2 }} title={c.reasoning}>
                        <span style={{ color: "#2adf90" }}>{c.callsign ?? ""}</span>{" "}
                        {c.type}
                        {c.value !== undefined ? ` ${c.value}` : ""}
                        {c.runway !== undefined ? ` ${c.runway}` : ""}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
