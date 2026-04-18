import { useMemo } from "react";
import { useGameLoop } from "../hooks/useGameLoop";
import { useKeyboard } from "../hooks/useKeyboard";
import { useSimStore } from "../store/useSimStore";
import { EventLog } from "./HUD/EventLog";
import { MissionResultOverlay } from "./HUD/MissionResultOverlay";
import { SimDock } from "./HUD/SimDock";
import { StatusBar } from "./HUD/StatusBar";
import { SimMap } from "./Map/SimMap";
import { CommandChatPanel } from "./Panels/CommandChatPanel";
import { OperationsPanel } from "./Panels/OperationsPanel";

function App() {
  useGameLoop();
  useKeyboard();

  const aircraftMap = useSimStore((state) => state.aircraft);
  const conflicts = useSimStore((state) => state.conflicts);
  const events = useSimStore((state) => state.events);
  const score = useSimStore((state) => state.score);
  const simTime = useSimStore((state) => state.time);
  const mission = useSimStore((state) => state.mission);
  const wind = useSimStore((state) => state.wind);
  const activeRunways = useSimStore((state) => state.activeRunways);
  const selectedAircraftId = useSimStore((state) => state.selectedAircraftId);
  const paused = useSimStore((state) => state.paused);
  const speed = useSimStore((state) => state.speed);

  const selectAircraft = useSimStore((state) => state.selectAircraft);
  const issueCommand = useSimStore((state) => state.issueCommand);
  const setPaused = useSimStore((state) => state.setPaused);
  const setSpeed = useSimStore((state) => state.setSpeed);
  const restart = useSimStore((state) => state.restart);
  const setActiveRunways = useSimStore((state) => state.setActiveRunways);

  const aircraft = useMemo(() => {
    return Array.from(aircraftMap.values()).sort((a, b) => a.callsign.localeCompare(b.callsign));
  }, [aircraftMap]);

  const selectedAircraft = selectedAircraftId ? aircraftMap.get(selectedAircraftId) ?? null : null;

  return (
    <div className="app-shell">
      <main className="main-layout">
        <section className="map-pane">
          <SimMap aircraft={aircraft} conflicts={conflicts} onSelectAircraft={selectAircraft} />
          <SimDock
            paused={paused}
            speed={speed}
            activeRunways={activeRunways}
            onPauseToggle={() => setPaused(!paused)}
            onSpeedChange={setSpeed}
            onRestart={restart}
            onActiveRunwaysChange={setActiveRunways}
          />
        </section>

        <aside className="sidebar-pane">
          <StatusBar simTime={simTime} wind={wind} activeRunways={activeRunways} mission={mission} />
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

      <MissionResultOverlay mission={mission} score={score} simTime={simTime} onRestart={restart} />
    </div>
  );
}

export default App;
