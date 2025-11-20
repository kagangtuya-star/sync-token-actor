# Sync Token Actor

Simple Foundry VTT v13+ module that keeps actors and their prototype tokens in sync while offering a minimal sheet overlay for manual actions.

## Features
- Automatically mirrors actor names to prototype tokens and (optionally) to placed scene tokens.
- Optional portrait-image synchronization so actor portraits always match token artwork.
- Optional ability to disable the token ring during sync so portraits stay fully visible (useful for art-heavy compendia).
- Lightweight sheet overlay that shows the token preview, quick sync action, and chain button for per-actor always-sync.
- Per-actor “always sync” toggle so specific NPCs/creatures keep syncing even if the global auto-sync setting is disabled.
- Token pre-creation hook which guarantees new drops inherit the latest actor name and image.
- Built-in English and Simplified Chinese localization.

## Configuration
1. Open **Configure Settings → Module Settings → Sync Token Actor**.
2. Enable or disable automatic name/image synchronization per your workflow.
3. Decide whether placed tokens on the active scene should be updated when sync happens.
4. Toggle the sheet overlay and pick its position if you prefer a different layout.
5. (Optional) Disable token rings during sync when you want to expose more of the portrait artwork.
6. Use the per-actor “Always sync” link button (chain icon) on the portrait overlay when you need a creature to stay synced regardless of global settings.

## UI Overlay
- Hover the actor portrait to reveal the panel.
- Click the token thumbnail to inspect the full image or open the prototype **Token Configuration** dialog.
- Use the sync button to immediately copy the actor portrait to the prototype token image.
- The chain button toggles “always sync” for that actor; when enabled, this actor keeps syncing even if automatic sync is globally disabled.

## Installation
```
https://raw.githubusercontent.com/kagangtuya-star/sync-token-actor/main/module.json
```

## Localization
- `lang/en.json` – English (default)
- `lang/zh-CN.json` – Simplified Chinese
