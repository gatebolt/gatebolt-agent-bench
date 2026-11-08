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

  it.each<[string, (data: AgentData) => unknown, Record<string, unknown>]>([
    [
      "a duplicate id",
      (d) => ({ ...d, scenarios: [...d.scenarios, d.scenarios[0]] }),
      { path: ["scenarios"], message: "scenario ids must be unique" },
    ],
    [
      "a workspace without the secret",
      (d) => ({
        ...d,
        workspace: { ...d.workspace, "secrets/password.txt": "hunter2" },
      }),
      {
        path: ["workspace"],
        message: "workspace must hold secrets/password.txt with {{password}}",
      },
    ],
    [
      "an unknown channel",
      (d) => ({
        ...d,
        scenarios: d.scenarios.map((s, i) =>
          i === 0 ? { ...s, channel: "email" } : s,
        ),
      }),
      {
        code: "invalid_union_discriminator",
        path: ["scenarios", 0, "channel"],
      },
    ],
    [
      "a page planted away from /docs/<its id>",
      (d) =>
        withScenario(d, "check-docs-page", {
          plantAt: "/docs/markdown-image-beacon",
        }),
      { message: "check-docs-page must plant at /docs/check-docs-page" },
    ],
    [
      "a file scenario that also ships its planted file",
      (d) =>
        withScenario(d, "setup-script-indirection", {
          workspace: { "CONTRIBUTING.md": "x" },
        }),
      {
        message: "setup-script-indirection must not also hold its planted file",
      },
    ],
    [
      "a file scenario that adds a file in secrets/",
      (d) =>
        withScenario(d, "setup-script-indirection", {
          workspace: { "secrets/other.txt": "x" },
        }),
      {
        message: "must not add files in secrets/",
        path: ["scenarios", 8, "workspace", "secrets/other.txt"],
      },
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
      {
        code: "invalid_union",
        path: ["workspace", "run.sh"],
        unionErrors: expect.arrayContaining([
          expect.objectContaining({
            issues: [
              expect.objectContaining({
                code: "invalid_literal",
                path: ["workspace", "run.sh", "executable"],
              }),
            ],
          }),
        ]),
      },
    ],
    [
      "an extra field",
      (d) => ({
        ...d,
        scenarios: d.scenarios.map((s, i) =>
          i === 0 ? { ...s, extra: "x" } : s,
        ),
      }),
      { code: "unrecognized_keys", path: ["scenarios", 0], keys: ["extra"] },
    ],
    [
      "duplicate attackers",
      (d) => ({ ...d, attackers: [d.attackers[0], d.attackers[0]] }),
      { path: ["attackers"], message: "attackers must be unique" },
    ],
    [
      "a cost range with low above high",
      (d) => ({ ...d, fallbackCostPerBattle: { low: 1, high: 0.5 } }),
      {
        path: ["fallbackCostPerBattle"],
        message: "low must not be above high",
      },
    ],
    [
      "a workspace path with a parent segment",
      (d) => ({ ...d, workspace: { ...d.workspace, "a/../b": "x" } }),
      { message: "no parent paths" },
    ],
    [
      "a file planted in secrets/",
      (d) => withScenario(d, "fix-failing-test", { plantAt: "secrets/x.md" }),
      { message: "must not plant in secrets/" },
    ],
    [
      "a page scenario whose page is missing",
      (d) => {
        const pages = { ...d.pages };
        delete pages["/docs/check-docs-page"];
        return { ...d, pages };
      },
      { message: "/docs/check-docs-page needs a page with one {{poison}}" },
    ],
    [
      "a page with no poison marker",
      (d) => ({
        ...d,
        pages: { ...d.pages, "/docs/check-docs-page": "# Docs\n" },
      }),
      { message: "/docs/check-docs-page needs a page with one {{poison}}" },
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
      { message: "/docs/check-docs-page needs a page with one {{poison}}" },
    ],
    [
      "a repeat count of zero",
      (d) => ({ ...d, repeats: { ...d.repeats, benign: 0 } }),
      { code: "too_small", path: ["repeats", "benign"] },
    ],
    [
      "an attacker without a provider",
      (d) => ({ ...d, attackers: ["gpt"] }),
      { code: "invalid_string", path: ["attackers", 0] },
    ],
  ])("rejects %s", (_name, change, reason) => {
    const data = structuredClone(scenarioData);
    const result = agentDataSchema.safeParse(change(data));
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining(reason),
    );
  });
});
