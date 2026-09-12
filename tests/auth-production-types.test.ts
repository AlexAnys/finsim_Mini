import { expect, it } from "vitest";
import ts from "typescript";
import { resolve } from "node:path";

it("types the production auth entrypoint without any test importing the JWT module", () => {
  const root = process.cwd();
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram({
    rootNames: [resolve(root, "lib/auth/auth.config.ts"), resolve(root, "lib/types/next-auth.d.ts")],
    options: { ...parsed.options, incremental: false, noEmit: true },
  });
  const errors = ts.getPreEmitDiagnostics(program).map(diagnostic =>
    `${diagnostic.file?.fileName ?? "config"}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
  );
  expect(errors).toEqual([]);
}, 30_000);
