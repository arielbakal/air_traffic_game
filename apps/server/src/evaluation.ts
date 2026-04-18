import { buildScenarioAircraft, SCENARIOS } from "@atc/core";
import type { Aircraft } from "@atc/core";
import { createServerStore, serverTick, serverIssueCommand } from "./storeState.ts";
import { SYSTEM_PROMPT } from "./prompts.ts";
import { buildSituationReport } from "./situationReport.ts";
import { queryOllama } from "./ollama.ts";
import { validateCommand, deduplicateCommands } from "./validator.ts";
import { applyCommand } from "@atc/core";

interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  runIndex: number;
  success: boolean;
  collisions: number;
  separationViolations: number;
  landings: number;
  departures: number;
  agentDecisions: number;
  commandsIssued: number;
  commandsRejected: number;
  totalLatencyMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  finalScore: number;
  simSeconds: number;
}

const EVAL_SCENARIOS: Array<{ id: string; aircraft: Aircraft[]; maxSimSeconds: number }> = [
  { id: "HEAD_ON_CONFLICT", aircraft: buildScenarioAircraft(SCENARIOS.HEAD_ON_CONFLICT), maxSimSeconds: 120 },
  { id: "VERTICAL_CONFLICT", aircraft: buildScenarioAircraft(SCENARIOS.VERTICAL_CONFLICT), maxSimSeconds: 60 },
  { id: "APPROACH_SABE_13", aircraft: buildScenarioAircraft(SCENARIOS.APPROACH_SABE_13), maxSimSeconds: 180 },
  { id: "HOLDING_TEST", aircraft: buildScenarioAircraft(SCENARIOS.HOLDING_TEST), maxSimSeconds: 120 },
  { id: "RUSH_HOUR", aircraft: buildScenarioAircraft(SCENARIOS.RUSH_HOUR), maxSimSeconds: 300 },
  { id: "DEPARTURE_TEST", aircraft: buildScenarioAircraft(SCENARIOS.DEPARTURE_TEST), maxSimSeconds: 90 },
];

async function runScenario(
  scenarioId: string,
  aircraft: Aircraft[],
  maxSimSeconds: number,
  runIndex: number,
): Promise<ScenarioResult> {
  const store = createServerStore();
  store.game = { ...store.game, aircraft: new Map(aircraft.map(a => [a.id, a])), conflicts: [], events: [] };

  const FIXED_DT = 0.1;
  const AGENT_INTERVAL_SIM = 7;
  let simTime = 0;
  let nextAgentAt = 0;
  let agentDecisions = 0, commandsIssued = 0, commandsRejected = 0;
  let totalLatency = 0, totalIn = 0, totalOut = 0;

  console.log(`[Eval] Running ${scenarioId} run ${runIndex + 1}/${maxSimSeconds}s...`);

  while (simTime < maxSimSeconds && !store.game.mission.isComplete) {
    serverTick(store, FIXED_DT);
    simTime += FIXED_DT;

    if (simTime >= nextAgentAt) {
      nextAgentAt = simTime + AGENT_INTERVAL_SIM;
      try {
        const { response, latencyMs, tokensIn, tokensOut } = await queryOllama(SYSTEM_PROMPT, buildSituationReport(store.game));
        agentDecisions++;
        totalLatency += latencyMs;
        totalIn += tokensIn;
        totalOut += tokensOut;

        const cmds = deduplicateCommands(response.commands, store.game);
        for (const cmd of cmds) {
          if (cmd.type === "noop") continue;
          const valid = validateCommand(cmd, store.game);
          if (!valid.ok) { commandsRejected++; continue; }
          const ac = Array.from(store.game.aircraft.values()).find(a => a.callsign === cmd.callsign);
          if (!ac) continue;
          let ct: Parameters<typeof applyCommand>[1] | null = null;
          if (cmd.type === "heading") ct = { type: "heading", value: cmd.value! };
          else if (cmd.type === "altitude") ct = { type: "altitude", value: cmd.value! };
          else if (cmd.type === "speed") ct = { type: "speed", value: cmd.value! };
          else if (cmd.type === "approach") ct = { type: "approach", runway: cmd.runway! };
          else if (cmd.type === "hold") ct = { type: "hold" };
          else if (cmd.type === "takeoff") ct = { type: "takeoff", runway: cmd.runway! };
          if (ct) { serverIssueCommand(store, cmd.callsign!, ct); commandsIssued++; }
        }
      } catch (err) {
        console.error(`[Eval] Agent error in ${scenarioId}:`, err);
      }
    }
  }

  const { score } = store.game;
  const scenarioName = SCENARIOS[scenarioId as keyof typeof SCENARIOS]?.name ?? scenarioId;
  return {
    scenarioId, scenarioName, runIndex,
    success: score.collisions === 0,
    collisions: score.collisions,
    separationViolations: score.separationViolations,
    landings: score.landings,
    departures: score.departures,
    agentDecisions, commandsIssued, commandsRejected,
    totalLatencyMs: totalLatency,
    totalTokensIn: totalIn, totalTokensOut: totalOut,
    finalScore: Math.round(score.totalScore),
    simSeconds: Math.round(simTime),
  };
}

export async function runEvaluation(runs = 3): Promise<void> {
  const results: ScenarioResult[] = [];

  for (const scenario of EVAL_SCENARIOS) {
    for (let r = 0; r < runs; r++) {
      const result = await runScenario(scenario.id, scenario.aircraft, scenario.maxSimSeconds, r);
      results.push(result);
      console.log(`  [${result.success ? "PASS" : "FAIL"}] ${result.scenarioName} run ${r + 1}: score=${result.finalScore} violations=${result.separationViolations} collisions=${result.collisions}`);
    }
  }

  // Print summary CSV
  const header = "scenario,run,success,collisions,violations,landings,departures,decisions,issued,rejected,latencyMs,tokensIn,tokensOut,score";
  const rows = results.map(r =>
    `${r.scenarioId},${r.runIndex},${r.success ? 1 : 0},${r.collisions},${r.separationViolations},${r.landings},${r.departures},${r.agentDecisions},${r.commandsIssued},${r.commandsRejected},${Math.round(r.totalLatencyMs / Math.max(r.agentDecisions, 1))},${r.totalTokensIn},${r.totalTokensOut},${r.finalScore}`
  );
  const csv = [header, ...rows].join("\n");
  console.log("\n=== EVALUATION RESULTS CSV ===");
  console.log(csv);

  const successes = results.filter(r => r.success).length;
  console.log(`\nOverall: ${successes}/${results.length} passed (${Math.round(100 * successes / results.length)}%)`);
}

// Run directly: tsx src/evaluation.ts [runs]
if (process.argv[1]?.endsWith("evaluation.ts")) {
  const runs = parseInt(process.argv[2] ?? "3");
  runEvaluation(runs).catch(console.error);
}
