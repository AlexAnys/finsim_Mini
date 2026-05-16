/**
 * Prompt registry contract (PR-1 Candidate E).
 *
 * 每个 feature builder export 一个签名 `(opts) => BuiltPrompt` 的纯函数。
 * `version` 是业务层显式标注的 prompt 契约版本（"v1" / "v2"），与 AiRun.promptHash
 * 的运行时内容指纹互补：promptVersion = "我是谁"，promptHash = "我当前内容是什么"。
 *
 * Prompt 内容改动应手动 bump version（由 snapshot test diff 强制 reviewer 看到）。
 */
export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  version: string;
}

export type PromptBuilder<TOpts> = (opts: TOpts) => BuiltPrompt;
