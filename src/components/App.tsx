import { useMemo } from "react";
import { useGameLoop } from "../hooks/useGameLoop";
import { useKeyboard } from "../hooks/useKeyboard";
import { useSimStore } from "../store/useSimStore";
import { EventLog } from "./HUD/EventLog";
import { StatusBar } from "./HUD/StatusBar";
import { SimMap } from "./Map/SimMap";
import { CommandChatPanel } from "./Panels/CommandChatPanel";
import { OperationsPanel } from "./Panels/OperationsPanel";
import { SimControls } from "./Panels/SimControls";

function App() {
  useGameLoop();
  useKeyboard();

  const aircraftMap = useSimStore((state) => state.aircraft);
  const conflicts = useSimStore((state) => state.conflicts);
  const events = useSimStore((state) => state.events);
  const score = useSimStore((state) => state.score);
  const simTime = useSimStore((state) => state.time);
  const wind = useSimStore((state) => state.wind);
  const activeRunways = useSimStore((state) => state.activeRunways);
  const selectedAircraftId = useSimStore((state) => state.selectedAircraftId);
  const paused = useSimStore((state) => state.paused);
  const speed = useSimStore((state) => state.speed);
  const difficulty = useSimStore((state) => state.difficulty);

  const selectAircraft = useSimStore((state) => state.selectAircraft);
  const issueCommand = useSimStore((state) => state.issueCommand);
  const setPaused = useSimStore((state) => state.setPaused);
  const setSpeed = useSimStore((state) => state.setSpeed);
  const restart = useSimStore((state) => state.restart);
  const setDifficulty = useSimStore((state) => state.setDifficulty);
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
        </section>

        <aside className="sidebar-pane">
          <StatusBar simTime={simTime} wind={wind} activeRunways={activeRunways} />
          <CommandChatPanel
            aircraft={selectedAircraft}
            activeRunways={activeRunways}
            onIssueCommand={issueCommand}
          />
          <SimControls
            paused={paused}
            speed={speed}
            difficulty={difficulty}
            activeRunways={activeRunways}
            onPauseToggle={() => setPaused(!paused)}
            onSpeedChange={setSpeed}
            onRestart={restart}
            onDifficultyChange={setDifficulty}
            onActiveRunwaysChange={setActiveRunways}
          />
          <OperationsPanel
            score={score}
            aircraft={aircraft}
            selectedAircraftId={selectedAircraftId}
            onSelect={selectAircraft}
          />
          <EventLog events={events} />
        </aside>
      </main>
    </div>
  );
}

export default App;
