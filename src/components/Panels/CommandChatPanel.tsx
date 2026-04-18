import { useMemo, useState } from "react";
import { parseChatCommand } from "../../core/chatCommandParser";
import type { Aircraft, CommandType } from "../../core/types";

interface ChatEntry {
  id: number;
  role: "user" | "system";
  text: string;
}

interface CommandChatPanelProps {
  aircraft: Aircraft | null;
  activeRunways: string[];
  onIssueCommand: (command: CommandType) => void;
}

const HELP_TEXT = "Examples: hdg 180 | alt 5000 | alt FL120 | spd 220 | app SABE-13 | hold | ga | takeoff SABE-13";

export function CommandChatPanel({ aircraft, activeRunways, onIssueCommand }: CommandChatPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([
    { id: 1, role: "system", text: HELP_TEXT },
  ]);

  const selectedCallsign = useMemo(() => aircraft?.callsign ?? "No aircraft selected", [aircraft]);

  const appendMessage = (role: ChatEntry["role"], text: string) => {
    setMessages((current) => [{ id: Date.now(), role, text }, ...current].slice(0, 24));
  };

  const submit = () => {
    const text = input.trim();
    if (!text) {
      return;
    }

    appendMessage("user", text);

    if (!aircraft) {
      appendMessage("system", "Select an aircraft first.");
      setInput("");
      return;
    }

    const parsed = parseChatCommand(text, activeRunways, {
      takeoffAirport: aircraft.origin,
      approachAirport: aircraft.destination,
    });
    if (!parsed.ok) {
      appendMessage("system", parsed.error);
      setInput("");
      return;
    }

    onIssueCommand(parsed.command);
    appendMessage("system", `Sent to ${aircraft.callsign}`);
    setInput("");
  };

  return (
    <div className="panel command-chat-panel">
      <h3>ATC Chat</h3>

      <div className="chat-meta-row">
        <span className="chat-meta-label">Target</span>
        <span className="chat-meta-value">{selectedCallsign}</span>
      </div>

      <div className="chat-message-list" role="log" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`chat-message chat-${message.role}`}>
            <span>{message.text}</span>
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          type="text"
          placeholder="Type command..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" onClick={submit}>
          Send
        </button>
      </div>
    </div>
  );
}
