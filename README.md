# Flow Google generation plugin

Downloadable Script-Pro provider package, version 0.1.1 (preview).

Install from **Settings → Plugins → Generation** in Script-Pro. Sign in with your own provider account and configure its project URL. Flow Google supports Google browser accounts; Vibes supports Meta browser accounts. Existing service sessions can be reused without copying cookies. Service sign-in and consent remain subject to the provider.

This repository distributes the compiled package and its manifest. The archive contains only `manifest.json` and `plugin.js`. Script-Pro verifies the signed catalog and archive digest before running it in a sandbox.

- Provider ID: `FLOW_GOOGLE`
- Contract: 1
- SHA-256: `313a2fd7061dfd9240cf97dd8d7f30b74fb005f264914580e996e0f1f8108106`
- [SDK](https://github.com/2noScript/script-pro-generation-sdk)
- [Catalog](https://github.com/2noScript/sp-gen-plugins)

Runtime installation, isolation, and shared browser session behavior have automated integration coverage. Live generation with provider accounts is pending verification. No credentials or browser sessions are included.
