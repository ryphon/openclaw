import { describe, expect, it, vi } from "vitest";
import { applyExtraParamsToAgent } from "./extra-params.js";

describe("applyExtraParamsToAgent", () => {
  describe("GitHub Copilot headers", () => {
    it("adds IDE headers for github-copilot provider", async () => {
      const capturedOptions: Array<{ headers?: Record<string, string> }> = [];
      const mockStreamFn = vi.fn((_model, _context, options) => {
        capturedOptions.push(options ?? {});
        return (async function* () {
          yield { type: "text" as const, text: "test" };
        })();
      });

      const agent = { streamFn: mockStreamFn };
      applyExtraParamsToAgent(agent, undefined, "github-copilot", "gpt-4o");

      // Call the wrapped streamFn
      const gen = agent.streamFn({} as never, {} as never, {});
      // Consume the generator to trigger the call
      for await (const _ of gen) {
        // consume
      }

      expect(capturedOptions.length).toBe(1);
      expect(capturedOptions[0].headers).toMatchObject({
        "User-Agent": "GitHubCopilotChat/0.35.0",
        "Editor-Version": "vscode/1.107.0",
        "Editor-Plugin-Version": "copilot-chat/0.35.0",
        "Copilot-Integration-Id": "vscode-chat",
      });
    });

    it("preserves existing headers when adding Copilot headers", async () => {
      const capturedOptions: Array<{ headers?: Record<string, string> }> = [];
      const mockStreamFn = vi.fn((_model, _context, options) => {
        capturedOptions.push(options ?? {});
        return (async function* () {
          yield { type: "text" as const, text: "test" };
        })();
      });

      const agent = { streamFn: mockStreamFn };
      applyExtraParamsToAgent(agent, undefined, "github-copilot", "gpt-4o");

      // Call with existing headers
      const gen = agent.streamFn({} as never, {} as never, {
        headers: { "X-Custom": "value" },
      });
      for await (const _ of gen) {
        // consume
      }

      expect(capturedOptions[0].headers).toMatchObject({
        "User-Agent": "GitHubCopilotChat/0.35.0",
        "X-Custom": "value",
      });
    });

    it("does not add Copilot headers for other providers", () => {
      const mockStreamFn = vi.fn();
      const agent = { streamFn: mockStreamFn };
      applyExtraParamsToAgent(agent, undefined, "anthropic", "claude-3-opus");

      // streamFn should not be wrapped (no extraParams, not openrouter/github-copilot)
      expect(agent.streamFn).toBe(mockStreamFn);
    });
  });

  describe("OpenRouter headers", () => {
    it("adds app attribution headers for openrouter provider", async () => {
      const capturedOptions: Array<{ headers?: Record<string, string> }> = [];
      const mockStreamFn = vi.fn((_model, _context, options) => {
        capturedOptions.push(options ?? {});
        return (async function* () {
          yield { type: "text" as const, text: "test" };
        })();
      });

      const agent = { streamFn: mockStreamFn };
      applyExtraParamsToAgent(agent, undefined, "openrouter", "anthropic/claude-3-opus");

      const gen = agent.streamFn({} as never, {} as never, {});
      for await (const _ of gen) {
        // consume
      }

      expect(capturedOptions[0].headers).toMatchObject({
        "HTTP-Referer": "https://openclaw.ai",
        "X-Title": "OpenClaw",
      });
    });
  });
});
