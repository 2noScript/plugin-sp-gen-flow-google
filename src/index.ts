import {
  definePlugin,
  defineProvider,
  pluginManifestSchema,
} from "@script-pro/generation-sdk";
import { FlowGoogleService } from "./provider";
import { runProvider } from "./adapter";
import { connectionFromHost } from "./connection";
import manifest from "../manifest.json";
import { readFlowSession, executeFlowChallenge } from "./session";

const packageManifest = pluginManifestSchema.parse(manifest);

const provider = defineProvider({
  manifest: packageManifest.providers[0],
  async checkConnection(host) {
    try {
      await readFlowSession(host);
      return { status: "CONNECTED" };
    } catch {
      return {
        status: "AUTH_REQUIRED",
        message: "Sign in to Flow Google to continue",
      };
    }
  },
  async generate(request, host) {
    const profile = connectionFromHost(host);
    const provider = new FlowGoogleService(
      {
        getFlowAuthContext: () => readFlowSession(host),
        solveRecaptcha: (_profile, key, action) =>
          executeFlowChallenge(host, key ?? "", action ?? ""),
      },
      (url, options) =>
        host.request<string>({
          url,
          transport: "BROWSER",
          proxy: options.proxy,
          method: options.method,
          headers: options.headers,
          body:
            typeof options.body === "string"
              ? options.body
              : JSON.stringify(options.body),
          responseType: "TEXT",
        }),
    );
    return { ok: true, media: await runProvider(provider, profile, request) };
  },
});

export default definePlugin({
  manifest: packageManifest,
  providers: [provider],
});
