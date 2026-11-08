import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { AGENT_DATA_REVISION, scenarioData } from "../../src/index.js";

function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

describe("revision", () => {
  it("ships the data file byte for byte", () => {
    const raw = readFileSync(
      new URL("../../src/data/gatebolt-agent.json", import.meta.url),
    );
    expect(sha256(raw)).toBe(
      "e2ec8a6022e3bc079765c3dd1b4fd48f6445c259556d992fe01d3c64729a4647",
    );
  });

  it("pins the data revision to the content hash", () => {
    const { revision, scenarios, ...rest } = scenarioData;
    const content = sha256(
      JSON.stringify({
        ...rest,
        scenarios: scenarios.map(
          ({ title: _title, summary: _summary, ...played }) => played,
        ),
      }),
    ).slice(0, 12);
    expect({ revision, content, pinned: AGENT_DATA_REVISION }).toEqual({
      revision: "3f312aad4f89",
      content: "3f312aad4f89",
      pinned: "3f312aad4f89",
    });
  });
});
