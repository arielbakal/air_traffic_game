import { useEffect, useRef } from "react";
import { useSimStore } from "../store/useSimStore";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  return target.isContentEditable || target.closest("[contenteditable='true']") !== null;
}

export function useKeyboard(): void {
  const paused = useSimStore((state) => state.paused);
  const setPaused = useSimStore((state) => state.setPaused);
  const setSpeed = useSimStore((state) => state.setSpeed);
  const selectAircraft = useSimStore((state) => state.selectAircraft);

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        setPaused(!pausedRef.current);
      }

      if (event.key === "1") {
        setSpeed(1);
      }

      if (event.key === "2") {
        setSpeed(2);
      }

      if (event.key === "3" || event.key === "4") {
        setSpeed(4);
      }

      if (event.key === "Escape") {
        selectAircraft(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectAircraft, setPaused, setSpeed]);
}
