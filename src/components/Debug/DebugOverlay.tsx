import { useEffect, useRef, useState } from "react";
import { useSimStore } from "../../store/useSimStore";
import type { Aircraft } from "../../core/types";

function fmtCmd(entry: { callsign: string; command: { type: string; [k: string]: unknown } }): string {
  const { type, ...rest } = entry.command;
  const extras = Object.values(rest).join(" ");
  return `${entry.callsign} ${type}${extras ? " " + extras : ""}`;
}

function fmtTime(sim: number): string {
  const h = Math.floor(sim / 3600).toString().padStart(2, "0");
  const m = Math.floor((sim % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(sim % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function AircraftDump({ a }: { a: Aircraft }) {
  return (
    <div style={{ marginTop: 6, borderTop: "1px solid #2a4a3a", paddingTop: 4 }}>
      <div style={{ color: "#2adf90", fontWeight: "bold" }}>{a.callsign} ({a.type})</div>
      <div>status: <b>{a.status}</b> | hdg: {a.heading.toFixed(1)}° → {a.targetHeading.toFixed(1)}°</div>
      <div>alt: {Math.round(a.altitude)}ft → {Math.round(a.targetAltitude)}ft | vspd: {Math.round(a.verticalSpeed)}fpm</div>
      <div>spd: {Math.round(a.speed)}kt → {Math.round(a.targetSpeed)}kt</div>
      <div>pos: {a.position.lat.toFixed(4)}, {a.position.lng.toFixed(4)}</div>
      <div>runway: {a.assignedRunway ?? "—"} | onApproach: {String(a.onApproach)} | hold: {a.holdLeg ?? "—"}</div>
      <div>manualUntil: {a.manualRouteUntil?.toFixed(1) ?? "—"} | hdgChanges: {a.headingChanges}</div>
      <div>waypoint: {a.routeWaypointIndex}/{a.routeWaypoints.length} | holdTime: {a.holdTime.toFixed(0)}s</div>
    </div>
  );
}

export function DebugOverlay({ visible }: { visible: boolean }) {
  const aircraft = useSimStore((s) => s.aircraft);
  const conflicts = useSimStore((s) => s.conflicts);
  const simTime = useSimStore((s) => s.time);
  const speed = useSimStore((s) => s.speed);
  const selectedId = useSimStore((s) => s.selectedAircraftId);
  const debugCommands = useSimStore((s) => s.debugCommands);

  const frameCount = useRef(0);
  const lastFpsCheck = useRef(performance.now());
  const [fps, setFps] = useState(0);

  const tickCount = useRef(0);
  const prevSimTime = useRef(simTime);
  const lastTpsCheck = useRef(performance.now());
  const [tps, setTps] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const measure = (now: number) => {
      frameCount.current += 1;
      const elapsed = (now - lastFpsCheck.current) / 1000;
      if (elapsed >= 1) {
        setFps(Math.round(frameCount.current / elapsed));
        frameCount.current = 0;
        lastFpsCheck.current = now;
      }
      rafId = requestAnimationFrame(measure);
    };
    rafId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const deltaSim = simTime - prevSimTime.current;
    prevSimTime.current = simTime;
    if (deltaSim > 0) {
      tickCount.current += deltaSim / 0.1;
    }
    const now = performance.now();
    const elapsed = (now - lastTpsCheck.current) / 1000;
    if (elapsed >= 1) {
      setTps(Math.round(tickCount.current / elapsed));
      tickCount.current = 0;
      lastTpsCheck.current = now;
    }
  }, [simTime]);

  const mem = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
  const aircraftList = Array.from(aircraft.values());
  const selected = selectedId ? aircraft.get(selectedId) : null;

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 9999,
        background: "rgba(0,10,6,0.93)",
        color: "#8ecfb0",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        padding: "10px 14px",
        borderRadius: 6,
        border: "1px solid #1a4a3a",
        minWidth: 300,
        maxWidth: 380,
        maxHeight: "90vh",
        overflowY: "auto",
        pointerEvents: "none",
        lineHeight: 1.55,
      }}
    >
      <div style={{ color: "#2adf90", fontWeight: "bold", marginBottom: 6 }}>
        DEBUG OVERLAY <span style={{ color: "#556", fontWeight: "normal" }}>[` to hide]</span>
      </div>

      <div>FPS: <b style={{ color: fps < 30 ? "#ff5566" : "#2adf90" }}>{fps}</b>
        {"  "}TPS: <b style={{ color: tps < 8 * speed ? "#ffaa00" : "#2adf90" }}>{tps}</b>
        <span style={{ color: "#556" }}> (expect {10 * speed})</span>
      </div>
      <div>Sim time: <b>{fmtTime(simTime)}</b>  Speed: <b>{speed}×</b></div>
      <div>Aircraft: <b>{aircraftList.length}</b>  Conflicts: <b style={{ color: conflicts.length ? "#ff5566" : "#2adf90" }}>{conflicts.length}</b></div>
      {mem && (
        <div>Heap: <b>{Math.round(mem.usedJSHeapSize / 1048576)}MB</b> / {Math.round(mem.totalJSHeapSize / 1048576)}MB</div>
      )}

      {selected && (
        <AircraftDump a={selected} />
      )}
      {!selected && (
        <div style={{ marginTop: 6, color: "#556" }}>No aircraft selected</div>
      )}

      <div style={{ marginTop: 8, borderTop: "1px solid #1a4a3a", paddingTop: 4, color: "#556" }}>
        Last commands
      </div>
      {debugCommands.length === 0 && <div style={{ color: "#334" }}>none yet</div>}
      {debugCommands.map((entry, i) => (
        <div key={i} style={{ color: i === 0 ? "#cde" : "#667" }}>
          [{fmtTime(entry.time)}] {fmtCmd(entry as { callsign: string; command: { type: string; [k: string]: unknown } })}
        </div>
      ))}
    </div>
  );
}
