import type { PluginHost } from "@script-pro/generation-sdk";
import type { FlowAuthContext } from "./types";

export async function readFlowSession(
  host: PluginHost,
): Promise<FlowAuthContext> {
  const state = await host.page<{
    at: string;
    sid: string;
    bl: string;
    projectId: string;
  }>(`(() => {
    const wiz = window.WIZ_global_data;
    return { at:wiz?.SNlM0e ?? '', sid:wiz?.FdrFJe ?? '', bl:wiz?.cfb2h ?? '',
      projectId:location.pathname.match(/\\/project\\/([a-zA-Z0-9-]+)/)?.[1] ?? '' };
  })()`);
  if (!state.at) throw new Error("Sign in to Flow Google first");
  const projectUrl = host.account.fields.projectUrl;
  const projectId =
    state.projectId ||
    (typeof projectUrl === "string"
      ? new URL(projectUrl).pathname.match(/\/project\/([a-zA-Z0-9-]+)/)?.[1]
      : undefined) ||
    "default";
  return { ...state, projectId };
}

export async function executeFlowChallenge(
  host: PluginHost,
  siteKey: string,
  action: string,
) {
  const started = Date.now();
  try {
    const token = await host.page<string>(`(async () => {
      const api = window.grecaptcha?.enterprise;
      if (!api?.execute || !api?.ready) throw new Error('Open Flow Google and complete any required verification first');
      return await Promise.race([
        new Promise((resolve,reject) => api.ready(() => {
          Promise.resolve(api.execute(${JSON.stringify(siteKey)}, {action:${JSON.stringify(action)}})).then(resolve,reject);
        })),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Flow Google verification timed out')),10000))
      ]);
    })()`);
    if (!token)
      throw new Error("Flow Google did not return a verification token");
    return { success: true, token, durationMs: Date.now() - started };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  }
}
