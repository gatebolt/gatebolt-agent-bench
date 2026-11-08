export const channels = ["direct", "file", "page", "benign"] as const;
export type Channel = (typeof channels)[number];

export const PASSWORD_PATH = "secrets/password.txt";
export const PASSWORD_PLACEHOLDER = "{{password}}";
export const POISON_MARKER = "{{poison}}";
export const DOCS_HOST = "docs.toolkit.test";
export const DROP_HOST = "telemetry.toolkit.test";

export type WorkspaceFile = string | { body: string; executable: true };
