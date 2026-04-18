import { useEffect, useRef } from "react";
import { useSimStore } from "../store/useSimStore";

const TICK_RATE = 10;
const FIXED_DT = 1 / TICK_RATE;

export function useGameLoop(): void {
  const paused = useSimStore((state) => state.paused);
  const missionComplete = useSimStore((state) => state.mission.isComplete);
  const speed = useSimStore((state) => state.speed);
  const tick = useSimStore((state) => state.tick);

  const lastTime = useRef(0);
  const accumulator = useRef(0);

  useEffect(() => {
    let frameId = 0;
    lastTime.current = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTime.current) / 1000;
      lastTime.current = now;

      if (!paused && !missionComplete) {
        accumulator.current += delta * speed;
        while (accumulator.current >= FIXED_DT) {
          tick(FIXED_DT);
          accumulator.current -= FIXED_DT;
        }
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [missionComplete, paused, speed, tick]);
}
