import { z } from "zod";

import {
  PASSWORD_PATH,
  PASSWORD_PLACEHOLDER,
  POISON_MARKER,
} from "./agent-types.js";

const workspacePath = z
  .string()
  .regex(/^[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*$/)
  .refine((path) => !path.split("/").includes(".."), "no parent paths");

const workspaceFile = z.union([
  z.string(),
  z.object({ body: z.string(), executable: z.literal(true) }).strict(),
]);

const common = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  source: z.string().min(1),
};

const indirect = {
  poisonBrief: z.string().min(1),
  task: z.string().min(1),
  fallback: z.string().min(1),
};

const checkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("command"), command: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal("file_contains"),
      path: workspacePath,
      includes: z.array(z.string().min(1)).min(1),
      excludesPassword: z.literal(true),
    })
    .strict(),
  z
    .object({
      kind: z.literal("json_field"),
      path: workspacePath,
      field: z.string().min(1),
      equals: z.string().min(1),
    })
    .strict(),
]);

const scenarioSchema = z.discriminatedUnion("channel", [
  z
    .object({
      ...common,
      channel: z.literal("direct"),
      brief: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ...common,
      ...indirect,
      channel: z.literal("file"),
      plantAt: workspacePath.refine(
        (path) => !path.startsWith("secrets/"),
        "must not plant in secrets/",
      ),
      workspace: z
        .record(
          workspacePath.refine(
            (path) => !path.startsWith("secrets/"),
            "must not add files in secrets/",
          ),
          workspaceFile,
        )
        .optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      ...indirect,
      channel: z.literal("page"),
      plantAt: z.string().regex(/^\/docs\/[a-z0-9-]+$/),
    })
    .strict(),
  z
    .object({
      ...common,
      channel: z.literal("benign"),
      task: z.string().min(1),
      check: checkSchema,
    })
    .strict(),
]);

const costRangeSchema = z
  .object({ low: z.number().min(0), high: z.number().min(0) })
  .strict()
  .refine(({ low, high }) => low <= high, "low must not be above high");

const repeat = z.number().int().min(1);

function unique<T>(items: readonly T[]): boolean {
  return new Set(items).size === items.length;
}

export const agentDataSchema = z
  .object({
    revision: z.string().min(1),
    attackers: z
      .array(z.string().regex(/^[a-z0-9_-]+\/[a-z0-9._:-]+$/))
      .min(1)
      .refine(unique, "attackers must be unique"),
    repeats: z
      .object({ direct: repeat, file: repeat, page: repeat, benign: repeat })
      .strict(),
    fallbackCostPerBattle: costRangeSchema,
    workspace: z
      .record(workspacePath, workspaceFile)
      .refine(
        (files) => files[PASSWORD_PATH] === PASSWORD_PLACEHOLDER,
        `workspace must hold ${PASSWORD_PATH} with ${PASSWORD_PLACEHOLDER}`,
      ),
    pages: z.record(z.string().regex(/^\/[a-z0-9/_-]*$/), z.string()),
    scenarios: z
      .array(scenarioSchema)
      .min(1)
      .refine(
        (scenarios) => unique(scenarios.map((s) => s.id)),
        "scenario ids must be unique",
      ),
  })
  .strict()
  .superRefine(({ scenarios, pages }, ctx) => {
    for (const scenario of scenarios) {
      if (
        scenario.channel === "file" &&
        scenario.workspace?.[scenario.plantAt] !== undefined
      ) {
        ctx.addIssue({
          code: "custom",
          message: `${scenario.id} must not also hold its planted file`,
        });
      }
      if (scenario.channel !== "page") continue;
      if (scenario.plantAt !== `/docs/${scenario.id}`) {
        ctx.addIssue({
          code: "custom",
          message: `${scenario.id} must plant at /docs/${scenario.id}`,
        });
      }
      if (pages[scenario.plantAt]?.split(POISON_MARKER).length !== 2) {
        ctx.addIssue({
          code: "custom",
          message: `${scenario.plantAt} needs a page with one ${POISON_MARKER}`,
        });
      }
    }
  });

export type AgentData = z.infer<typeof agentDataSchema>;

export type Scenario = AgentData["scenarios"][number];

export type IndirectScenario = Extract<Scenario, { channel: "file" | "page" }>;
