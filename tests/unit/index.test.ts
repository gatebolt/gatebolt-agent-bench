import { expect, it } from "vitest";

import { PACKAGE_NAME } from "../../src/index.js";

it("names the package", () => {
  expect(PACKAGE_NAME).toBe("gatebolt-agent-bench");
});
