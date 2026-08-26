# NEO OS

This repository contains the complete optimized NEO OS build. The root `index.html` is a small launcher for web-based HTML code runners. It fetches NEO OS from jsDelivr and is pinned to payload commit `9152551245a4197009bebe68924676be581d9408`, so CDN branch caching cannot mix versions.

The two buttons let a user open the same app in an `about:blank` tab or ask the browser to enter fullscreen. Fullscreen permission and the browser's exit banner are controlled by the browser itself.

## Included site files

- `neo-os/` - the complete optimized NEO OS build, including wallpapers, Music, and NEO Browser.
- `games/` - the local Geometry Dash dependency used by NEO OS.
- `index.html` - the CDN launcher.

All files are stored in GitHub. jsDelivr's GitHub endpoint may reject individual assets over its file-size limit; those files remain available from the repository itself.
