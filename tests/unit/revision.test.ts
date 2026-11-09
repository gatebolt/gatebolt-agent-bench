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
      "d31c8c07bc431641a3f7843eb5a40a6edf9080dfa8198e9d37e481c2fa6750c7",
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
      revision: "3cfd2941d56c",
      content: "3cfd2941d56c",
      pinned: "3cfd2941d56c",
    });
  });
});
