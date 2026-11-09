import raw from "./data/gatebolt-agent.json" with { type: "json" };
import { type AgentData, agentDataSchema } from "./schema.js";

export const AGENT_DATA_REVISION = "3cfd2941d56c";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const scenarioData: AgentData = deepFreeze(agentDataSchema.parse(raw));
