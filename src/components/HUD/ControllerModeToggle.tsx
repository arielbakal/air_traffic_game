import type { ControllerMode } from "../../hooks/useAgentSocket";

interface ControllerModeToggleProps {
  mode: ControllerMode;
  connected: boolean;
  onChange: (mode: ControllerMode) => void;
}

const MODES: { value: ControllerMode; label: string; title: string }[] = [
  { value: "human", label: "Human", title: "You issue all commands" },
  { value: "ai", label: "AI", title: "Agent issues all commands — observe only" },
  { value: "collaborative", label: "Collab", title: "Agent suggests, you approve" },
];

export function ControllerModeToggle({ mode, connected, onChange }: ControllerModeToggleProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {mode !== "human" && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: connected ? "#2adf90" : "#ff5566",
          display: "inline-block", flexShrink: 0,
        }} />
      )}
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #2a3a2a" }}>
        {MODES.map(({ value, label, title }) => (
          <button
            key={value}
            title={title}
            onClick={() => onChange(value)}
            style={{
              padding: "3px 9px",
              fontSize: "0.68rem",
              fontFamily: "inherit",
              border: "none",
              borderRight: value !== "collaborative" ? "1px solid #2a3a2a" : "none",
              cursor: "pointer",
              background: mode === value ? "#1a4a2a" : "#0d1a0d",
              color: mode === value ? "#2adf90" : "#556",
              fontWeight: mode === value ? 600 : 400,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
