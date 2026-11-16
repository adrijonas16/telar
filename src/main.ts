import "./ui/styles/tokens.css";
import "./ui/styles/assistant.css";
import "./ui/components/telar-app.ts";
import { setAssistantOpen } from "./ui/assistant/assistant.ts";

document.querySelector("[data-close-assistant]")?.addEventListener("click", () => setAssistantOpen(false));
