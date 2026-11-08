import { describe, expect, it } from "vitest";

import {
  type AgentData,
  agentDataSchema,
  scenarioData,
} from "../../src/index.js";

function withScenario(
  data: AgentData,
  id: string,
  change: Record<string, unknown>,
): unknown {
  return {
    ...data,
    scenarios: data.scenarios.map((s) =>
      s.id === id ? { ...s, ...change } : s,
    ),
  };
}

describe("schema", () => {
  it("accepts the shipped data", () => {
    expect(agentDataSchema.safeParse(scenarioData).success).toBe(true);
  });

  it("freezes the data", () => {
    expect(Object.isFrozen(scenarioData)).toBe(true);
    expect(Object.isFrozen(scenarioData.scenarios)).toBe(true);
    expect(Object.isFrozen(scenarioData.scenarios[0])).toBe(true);
    expect(Object.isFrozen(scenarioData.workspace)).toBe(true);
    expect(Object.isFrozen(scenarioData.repeats)).toBe(true);
    expect(() => {
      scenarioData.workspace.x = "y";
    }).toThrow(TypeError);
  });

  it.each<[string, (data: AgentData) => unknown]>([
    [
      "a duplicate id",
      (d) => ({ ...d, scenarios: [...d.scenarios, d.scenarios[0]] }),
    ],
    [
      "a workspace without the secret",
      (d) => ({
        ...d,
        workspace: { ...d.workspace, "secrets/password.txt": "hunter2" },
      }),
    ],
    [
      "an unknown channel",
      (d) => ({
        ...d,
        scenarios: d.scenarios.map((s, i) =>
          i === 0 ? { ...s, channel: "email" } : s,
        ),
      }),
    ],
    [
      "a page planted away from /docs/<its id>",
      (d) =>
        withScenario(d, "check-docs-page", {
          plantAt: "/docs/markdown-image-beacon",
        }),
    ],
    [
      "a file scenario that also ships its planted file",
      (d) =>
        withScenario(d, "setup-script-indirection", {
          workspace: { "CONTRIBUTING.md": "x" },
        }),
    ],
    [
      "a file scenario that adds a file in secrets/",
      (d) =>
        withScenario(d, "setup-script-indirection", {
          workspace: { "secrets/other.txt": "x" },
        }),
    ],
    [
      "a workspace file marked not executable",
      (d) => ({
        ...d,
        workspace: {
          ...d.workspace,
          "run.sh": { body: "", executable: false },
        },
      }),
    ],
    [
      "an extra field",
      (d) => ({
        ...d,
        scenarios: d.scenarios.map((s, i) =>
          i === 0 ? { ...s, extra: "x" } : s,
        ),
      }),
    ],
    [
      "duplicate attackers",
      (d) => ({ ...d, attackers: [d.attackers[0], d.attackers[0]] }),
    ],
    [
      "a cost range with low above high",
      (d) => ({ ...d, fallbackCostPerBattle: { low: 1, high: 0.5 } }),
    ],
    [
      "a workspace path with a parent segment",
      (d) => ({ ...d, workspace: { ...d.workspace, "a/../b": "x" } }),
    ],
    [
      "a file planted in secrets/",
      (d) => withScenario(d, "fix-failing-test", { plantAt: "secrets/x.md" }),
    ],
    [
      "a page scenario whose page is missing",
      (d) => {
        const pages = { ...d.pages };
        delete pages["/docs/check-docs-page"];
        return { ...d, pages };
      },
    ],
    [
      "a page with no poison marker",
      (d) => ({
        ...d,
        pages: { ...d.pages, "/docs/check-docs-page": "# Docs\n" },
      }),
    ],
    [
      "a page with two poison markers",
      (d) => ({
        ...d,
        pages: {
          ...d.pages,
          "/docs/check-docs-page": `${d.pages["/docs/check-docs-page"]}\n{{poison}}`,
        },
      }),
    ],
    [
      "a repeat count of zero",
      (d) => ({ ...d, repeats: { ...d.repeats, benign: 0 } }),
    ],
    ["an attacker without a provider", (d) => ({ ...d, attackers: ["gpt"] })],
  ])("rejects %s", (_name, change) => {
    const data = structuredClone(scenarioData);
    expect(agentDataSchema.safeParse(change(data)).success).toBe(false);
  });
});
