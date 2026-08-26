# NEO BROWSER

NEO BROWSER is a self-contained browser workspace with tabs, bookmarks, privacy controls, page tools, media handling, extensions, and an optional assistant.

## Run

Serve this folder with any static web server and open `index.html`. A local server is recommended because browsers restrict some capabilities for `file://` pages.

All assets required by the core interface are included in this folder. Internet access is still required for external browsing, relay connections, favicons, optional assistant responses, and other explicitly network-backed features.

## Files

- `index.html` — application shell
- `assets/` — interface, runtime, transport, and brand assets
- `NEO-Packager.html` — optional feature-packaging utility
- `THIRD_PARTY_NOTICES.txt` — licenses and required attributions

The interface has one fixed monochrome design. Legacy skins and theme packages are not supported.
