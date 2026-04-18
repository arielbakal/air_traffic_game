import { useMemo, useState } from "react";
import { useGameLoop } from "../hooks/useGameLoop";
import { useKeyboard } from "../hooks/useKeyboard";
import { useSimStore } from "../store/useSimStore";
import { useAgentSocket, type ControllerMode } from "../hooks/useAgentSocket";
import { DebugOverlay } from "./Debug/DebugOverlay";
import { EventLog } from "./HUD/EventLog";
import { MissionResultOverlay } from "./HUD/MissionResultOverlay";
import { SimDock } from "./HUD/SimDock";
import { StatusBar } from "./HUD/StatusBar";
import { ControllerModeToggle } from "./HUD/ControllerModeToggle";
import { SimMap } from "./Map/SimMap";
import { CommandChatPanel } from "./Panels/CommandChatPanel";
import { OperationsPanel } from "./Panels/OperationsPanel";
import { AgentPanel } from "./Panels/AgentPanel";

function App() {
  const [debugVisible, setDebugVisible] = useState(false);
  const [controllerMode, setControllerMode] = useState<ControllerMode>("human");

  const { connected, agentStatus, lastDecision, overrideCount, sendCommand, changeMode, setPaused: socketSetPaused, setSpeed: socketSetSpeed, restart: socketRestart } = useAgentSocket(controllerMode);

  useGameLoop(controllerMode === "human");
  useKeyboard(() => setDebugVisible((v) => !v));

  const aircraftMap = useSimStore((state) => state.aircraft);
  const conflicts = useSimStore((state) => state.conflicts);
  const events = useSimStore((state) => state.events);
  const score = useSimStore((state) => state.score);
  const simTime = useSimStore((state) => state.time);
  const mission = useSimStore((state) => state.mission);
  const activeRunways = useSimStore((state) => state.activeRunways);
  const selectedAircraftId = useSimStore((state) => state.selectedAircraftId);
  const paused = useSimStore((state) => state.paused);
  const speed = useSimStore((state) => state.speed);

  const selectAircraft = useSimStore((state) => state.selectAircraft);
  const issueCommandLocal = useSimStore((state) => state.issueCommand);
  const setPausedLocal = useSimStore((state) => state.setPaused);
  const setSpeedLocal = useSimStore((state) => state.setSpeed);
  const restartLocal = useSimStore((state) => state.restart);
  const loadScenario = useSimStore((state) => state.loadScenario);
  const setActiveRunways = useSimStore((state) => state.setActiveRunways);

  const aircraft = useMemo(() => {
    return Array.from(aircraftMap.values()).sort((a, b) => a.callsign.localeCompare(b.callsign));
  }, [aircraftMap]);

  const selectedAircraft = selectedAircraftId ? aircraftMap.get(selectedAircraftId) ?? null : null;

  const handleModeChange = (mode: ControllerMode) => {
    setControllerMode(mode);
    changeMode(mode);
  };

  const handlePauseToggle = () => {
    if (controllerMode === "human") {
      setPausedLocal(!paused);
    } else {
      socketSetPaused(!paused);
    }
  };

  const handleSpeedChange = (s: 1 | 2 | 4) => {
    if (controllerMode === "human") {
      setSpeedLocal(s);
    } else {
      socketSetSpeed(s);
    }
  };

  const handleRestart = () => {
    if (controllerMode === "human") {
      restartLocal();
    } else {
      socketRestart();
    }
  };

  const handleIssueCommand = useSimStore((state) => state.issueCommand);
  const issueCommand = controllerMode === "human"
    ? issueCommandLocal
    : (cmd: Parameters<typeof handleIssueCommand>[0]) => {
        if (!selectedAircraftId) return;
        const ac = aircraftMap.get(selectedAircraftId);
        if (!ac) return;
        sendCommand(ac.callsign, cmd);
      };

  return (
    <div className="app-shell">
      <main className="main-layout">
        <section className="map-pane">
          <SimMap aircraft={aircraft} conflicts={conflicts} activeRunways={activeRunways} onSelectAircraft={selectAircraft} />
          <SimDock
            paused={paused}
            speed={speed}
            activeRunways={activeRunways}
            onPauseToggle={handlePauseToggle}
            onSpeedChange={handleSpeedChange}
            onRestart={handleRestart}
            onActiveRunwaysChange={setActiveRunways}
            onLoadScenario={controllerMode === "human" ? loadScenario : undefined}
            modeToggle={
              <ControllerModeToggle
                mode={controllerMode}
                connected={connected}
                onChange={handleModeChange}
              />
            }
          />
        </section>

        <aside className="sidebar-pane">
          <StatusBar simTime={simTime} activeRunways={activeRunways} mission={mission} />
          <AgentPanel
            mode={controllerMode}
            connected={connected}
            agentStatus={agentStatus}
            lastDecision={lastDecision}
            overrideCount={overrideCount}
          />
          <CommandChatPanel
            aircraft={selectedAircraft}
            activeRunways={activeRunways}
            onIssueCommand={issueCommand}
          />
          <OperationsPanel
            score={score}
            mission={mission}
            aircraft={aircraft}
            selectedAircraftId={selectedAircraftId}
            onSelect={selectAircraft}
          />
          <EventLog events={events} />
        </aside>
      </main>

      <MissionResultOverlay mission={mission} score={score} simTime={simTime} onRestart={handleRestart} />
      <DebugOverlay visible={debugVisible} />
    </div>
  );
}

export default App;
