import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PASSWORD_PATH,
  PASSWORD_PLACEHOLDER,
  POISON_MARKER,
  scenarioData,
} from "../../src/index.js";

const rawText = readFileSync(
  new URL("../../src/data/gatebolt-agent.json", import.meta.url),
  "utf8",
);

function count(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

function fileText(file: string | { body: string }): string {
  return typeof file === "string" ? file : file.body;
}

const { workspace, pages, scenarios } = scenarioData;

const pagePlantings = scenarios
  .filter((scenario) => scenario.channel === "page")
  .map((scenario) => scenario.plantAt)
  .sort();

describe.each([
  ["raw file", rawText],
  ["parsed data", JSON.stringify(scenarioData)],
])("placeholders in the %s", (_name, text) => {
  it("holds {{password}} exactly once", () => {
    expect(count(text, PASSWORD_PLACEHOLDER)).toBe(1);
  });

  it("holds {{poison}} exactly three times in the whole data", () => {
    expect(count(text, POISON_MARKER)).toBe(3);
  });
});

describe("placeholder placement", () => {
  it("holds {{password}} as one whole JSON string value in the raw file", () => {
    expect(count(rawText, `"${PASSWORD_PLACEHOLDER}"`)).toBe(1);
  });

  it("holds {{password}} only as the content of secrets/password.txt", () => {
    expect(workspace[PASSWORD_PATH]).toBe(PASSWORD_PLACEHOLDER);
    const others = Object.entries(workspace).filter(
      ([path]) => path !== PASSWORD_PATH,
    );
    for (const [, file] of others) {
      expect(fileText(file)).not.toContain(PASSWORD_PLACEHOLDER);
    }
    for (const page of Object.values(pages)) {
      expect(page).not.toContain(PASSWORD_PLACEHOLDER);
    }
    for (const scenario of scenarios) {
      expect(JSON.stringify(scenario)).not.toContain(PASSWORD_PLACEHOLDER);
    }
  });

  it("holds {{poison}} once in each page a page scenario plants at, and nowhere else", () => {
    const poisoned = Object.entries(pages)
      .filter(([, page]) => page.includes(POISON_MARKER))
      .map(([key]) => key)
      .sort();
    expect(poisoned).toEqual([
      "/docs/check-docs-page",
      "/docs/markdown-image-beacon",
      "/docs/write-then-fetch-report",
    ]);
    expect(poisoned).toEqual(pagePlantings);
    for (const key of poisoned) {
      expect(count(pages[key] ?? "", POISON_MARKER)).toBe(1);
    }
    for (const file of Object.values(workspace)) {
      expect(fileText(file)).not.toContain(POISON_MARKER);
    }
    for (const scenario of scenarios) {
      expect(JSON.stringify(scenario)).not.toContain(POISON_MARKER);
    }
  });

  it("keeps /api free of placeholders", () => {
    expect(pages["/api"]).not.toContain(PASSWORD_PLACEHOLDER);
    expect(pages["/api"]).not.toContain(POISON_MARKER);
  });
});
