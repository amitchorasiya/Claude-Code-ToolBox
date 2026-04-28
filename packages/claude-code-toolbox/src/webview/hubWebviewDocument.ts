/** Inline HTML document for MCP & skills hub (CSP: inline style + script only). */
export function getHubWebviewHtml(csp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --pad: 10px;
      --r-lg: 12px;
      --r-sm: 8px;
      --border: color-mix(in srgb, var(--vscode-widget-border) 75%, transparent);
      --card: color-mix(in srgb, var(--vscode-editor-background) 82%, var(--vscode-sideBar-background));
      --card-hover: color-mix(in srgb, var(--vscode-editor-background) 70%, var(--vscode-sideBar-background));
      --accent: var(--vscode-button-background);
      --muted: var(--vscode-descriptionForeground);
      --ok: var(--vscode-testing-iconPassed, var(--vscode-charts-green));
      --warn: var(--vscode-list-warningForeground, var(--vscode-editorWarning-foreground));
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      display: flex;
      flex-direction: column;
      font-family: var(--vscode-font-family);
      font-size: 12.5px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: var(--pad);
      padding-bottom: 0;
      width: 100%;
      /* Full width of tool window / webview — do not max-width center (looks pillarboxed on wide panels). */
      /* Sidebar webviews sometimes give the iframe no explicit height; 100% collapses and flex:1 scroll area goes to 0px. */
      min-height: 100vh;
      box-sizing: border-box;
    }
    .hub-header { flex-shrink: 0; margin-bottom: 6px; }
    .hub-tabs-hint {
      margin: 0 0 8px;
      font-size: 11px;
      line-height: 1.4;
      color: var(--muted);
      font-weight: 500;
    }
    .pages {
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: var(--r-lg);
      background: color-mix(in srgb, var(--vscode-sideBar-background) 88%, var(--vscode-widget-border));
      border: 1px solid var(--border);
      box-shadow: inset 0 1px 2px color-mix(in srgb, var(--vscode-widget-shadow) 22%, transparent);
      margin-bottom: 6px;
    }
    .page-btn {
      flex: 1;
      min-width: 0;
      border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 75%, var(--vscode-sideBar-background));
      border-radius: var(--r-sm);
      padding: 8px 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.01em;
      cursor: pointer;
      background: color-mix(in srgb, var(--vscode-editor-background) 50%, var(--vscode-sideBar-background));
      color: var(--vscode-foreground);
      box-shadow: 0 1px 0 color-mix(in srgb, var(--vscode-widget-shadow) 18%, transparent);
      transition: background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, color 0.12s ease;
    }
    .page-btn:hover {
      background: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 65%, var(--vscode-sideBar-background));
      border-color: color-mix(in srgb, var(--vscode-focusBorder) 40%, var(--border));
    }
    .page-btn:focus-visible {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 1px;
      z-index: 1;
    }
    /* Per-tab tint (inactive + hover); emojis in label — aria-label = plain name for screen readers */
    .page-btn[data-page="intel"]:not(.active) {
      border-color: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 50%, var(--border));
      background: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 16%, var(--vscode-sideBar-background));
    }
    .page-btn[data-page="intel"]:hover:not(.active) {
      background: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 28%, var(--vscode-sideBar-background));
      border-color: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 62%, var(--border));
    }
    .page-btn[data-page="mcp"]:not(.active) {
      border-color: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 48%, var(--border));
      background: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 14%, var(--vscode-sideBar-background));
    }
    .page-btn[data-page="mcp"]:hover:not(.active) {
      background: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 26%, var(--vscode-sideBar-background));
      border-color: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 58%, var(--border));
    }
    .page-btn[data-page="skills"]:not(.active) {
      border-color: color-mix(in srgb, var(--vscode-charts-green, #22c55e) 48%, var(--border));
      background: color-mix(in srgb, var(--vscode-charts-green, #22c55e) 14%, var(--vscode-sideBar-background));
    }
    .page-btn[data-page="skills"]:hover:not(.active) {
      background: color-mix(in srgb, var(--vscode-charts-green, #22c55e) 26%, var(--vscode-sideBar-background));
      border-color: color-mix(in srgb, var(--vscode-charts-green, #22c55e) 58%, var(--border));
    }
    .page-btn[data-page="workspace"]:not(.active) {
      border-color: color-mix(in srgb, var(--vscode-charts-yellow, #eab308) 45%, var(--border));
      background: color-mix(in srgb, var(--vscode-charts-yellow, #eab308) 14%, var(--vscode-sideBar-background));
    }
    .page-btn[data-page="workspace"]:hover:not(.active) {
      background: color-mix(in srgb, var(--vscode-charts-yellow, #eab308) 26%, var(--vscode-sideBar-background));
      border-color: color-mix(in srgb, var(--vscode-charts-yellow, #eab308) 55%, var(--border));
    }
    .page-btn[data-page="agentteams"]:not(.active) {
      border-color: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 48%, var(--border));
      background: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 14%, var(--vscode-sideBar-background));
    }
    .page-btn[data-page="agentteams"]:hover:not(.active) {
      background: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 26%, var(--vscode-sideBar-background));
      border-color: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 58%, var(--border));
    }
    .page-btn.active {
      color: var(--vscode-button-foreground);
      box-shadow:
        0 1px 2px color-mix(in srgb, var(--vscode-widget-shadow) 35%, transparent),
        inset 0 1px 0 color-mix(in srgb, var(--vscode-button-foreground) 12%, transparent);
    }
    .page-btn[data-page="intel"].active {
      background: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 72%, var(--vscode-button-background));
      border-color: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 55%, var(--border));
    }
    .page-btn[data-page="mcp"].active {
      background: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 68%, var(--vscode-button-background));
      border-color: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 52%, var(--border));
    }
    .page-btn[data-page="skills"].active {
      background: color-mix(in srgb, var(--vscode-charts-green, #22c55e) 65%, var(--vscode-button-background));
      border-color: color-mix(in srgb, var(--vscode-charts-green, #22c55e) 50%, var(--border));
    }
    .page-btn[data-page="workspace"].active {
      background: color-mix(in srgb, var(--vscode-charts-yellow, #eab308) 58%, var(--vscode-button-background));
      border-color: color-mix(in srgb, var(--vscode-charts-yellow, #eab308) 48%, var(--border));
    }
    .page-btn[data-page="agentteams"].active {
      background: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 62%, var(--vscode-button-background));
      border-color: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 50%, var(--border));
    }
    .subpages {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }
    .sub-btn {
      padding: 6px 14px;
      min-height: 28px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--card);
      color: inherit;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.07);
    }
    .sub-btn:hover {
      border-color: color-mix(in srgb, var(--vscode-focusBorder) 50%, var(--border));
      background: var(--card-hover);
    }
    .sub-btn.active {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 18%, var(--card));
    }
    .search-wrap { margin-bottom: 8px; }
    .search {
      width: 100%;
      padding: 8px 10px;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font: inherit;
    }
    .search::placeholder { color: var(--muted); }
    .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .chip {
      padding: 6px 11px;
      min-height: 28px;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: var(--card);
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      color: inherit;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }
    .chip:hover { border-color: var(--vscode-focusBorder); background: var(--card-hover); }
    #scroll {
      flex: 1;
      min-height: 120px;
      overflow-y: auto;
      padding-bottom: 12px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin: 16px 0 10px;
    }
    .section-title:first-child { margin-top: 4px; }
    .callout {
      border-radius: var(--r-lg);
      border: 1px solid var(--border);
      padding: 12px 14px;
      background: var(--card);
      margin-bottom: 10px;
      border-left: 4px solid var(--vscode-focusBorder);
    }
    .callout h4 { margin: 0 0 6px; font-size: 13px; font-weight: 600; }
    .callout p { margin: 0 0 10px; font-size: 11px; line-height: 1.45; color: var(--muted); }
    .mcp-card, .skill-card, .kit-card {
      border-radius: var(--r-lg);
      border: 1px solid var(--border);
      background: var(--card);
      padding: 10px 12px;
      margin-bottom: 8px;
      transition: border-color 0.12s ease, background 0.12s ease;
    }
    .mcp-card:hover, .skill-card:hover, .kit-card:hover {
      border-color: color-mix(in srgb, var(--vscode-focusBorder) 65%, var(--border));
      background: var(--card-hover);
    }
    .mcp-card, .skill-card { border-left: 3px solid var(--vscode-focusBorder); }
    .mcp-card--disabled, .skill-card--disabled { opacity: 0.9; border-left-color: var(--vscode-descriptionForeground); }
    .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .card-top h3 { margin: 0; font-size: 13px; font-weight: 600; line-height: 1.25; }
    .badge {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 7px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 22%, transparent);
      color: var(--vscode-button-foreground);
      white-space: nowrap;
    }
    .meta { font-size: 10px; color: var(--muted); margin-top: 4px; word-break: break-all; }
    .desc { font-size: 11px; line-height: 1.4; margin-top: 8px; opacity: 0.95; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .btn {
      padding: 6px 12px;
      min-height: 28px;
      font-size: 11px;
      font-weight: 600;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-foreground);
      cursor: pointer;
      font-family: inherit;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    }
    .btn:hover {
      border-color: color-mix(in srgb, var(--vscode-focusBorder) 45%, var(--border));
      filter: brightness(0.98);
    }
    .btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: color-mix(in srgb, var(--vscode-button-background) 72%, #000000);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
    }
    .btn.primary:hover {
      filter: brightness(1.06);
      border-color: color-mix(in srgb, var(--vscode-button-background) 55%, #000000);
    }
    .hero {
      border-radius: var(--r-lg);
      border: 1px solid var(--border);
      padding: 14px 14px 12px;
      margin-bottom: 12px;
      background: var(--card);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }
    .hero .ic { font-size: 22px; margin-bottom: 6px; }
    .hero h3 { margin: 0 0 6px; font-size: 13px; font-weight: 600; letter-spacing: 0.01em; }
    .hero p { margin: 0 0 12px; font-size: 11.5px; color: var(--muted); line-height: 1.5; }
    details.tool-block {
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      margin-bottom: 8px;
      background: color-mix(in srgb, var(--card) 50%, transparent);
      overflow: hidden;
    }
    details.tool-block summary {
      padding: 10px 12px;
      cursor: pointer;
      font-weight: 600;
      font-size: 11px;
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    details.tool-block summary::-webkit-details-marker { display: none; }
    details.tool-block summary::after { content: "▸"; font-size: 10px; opacity: 0.5; }
    details.tool-block[open] summary::after { content: "▾"; }
    .tile-grid { padding: 0 8px 10px; display: flex; flex-direction: column; gap: 6px; }
    button.tile {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      width: 100%;
      text-align: left;
      padding: 10px 10px;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: var(--card);
      cursor: pointer;
      font: inherit;
      color: inherit;
    }
    button.tile:hover { border-color: var(--vscode-focusBorder); background: var(--card-hover); }
    button.tile .ic { font-size: 17px; line-height: 1.2; flex-shrink: 0; }
    button.tile .body .t { font-weight: 600; font-size: 12px; }
    button.tile .body .d { font-size: 10px; color: var(--muted); margin-top: 3px; line-height: 1.35; }
    .kit-card .status {
      width: 8px; height: 8px; border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;
    }
    .kit-card .status.ok { background: var(--ok); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ok) 35%, transparent); }
    .kit-card .status.miss { background: var(--muted); opacity: 0.45; }
    .kit-inner { display: flex; gap: 10px; align-items: flex-start; }
    .kit-body { flex: 1; min-width: 0; }
    .kit-body .t { font-weight: 600; font-size: 12px; }
    .kit-body .p { font-size: 10px; color: var(--muted); margin-top: 3px; word-break: break-all; }
    .empty { font-size: 11px; color: var(--muted); padding: 10px 0; line-height: 1.4; }
    .intel-foot-scan {
      flex-shrink: 0;
      margin-top: 4px;
      margin-bottom: 0;
      border-radius: var(--r-sm) var(--r-sm) 0 0;
      padding: 10px 12px;
    }
    .catalog-card { border-left-color: color-mix(in srgb, var(--vscode-charts-purple, var(--vscode-symbolIcon-classForeground)) 55%, var(--vscode-focusBorder)); }
    .intel-auto-scan {
      display: none;
      margin-bottom: 6px;
      margin-top: 0;
      padding: 4px 6px 8px;
      border-radius: var(--r-sm);
      border: none;
      background: transparent;
    }
    .intel-auto-scan .auto-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .intel-auto-label {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 11px;
      line-height: 1.35;
      flex: 1;
      min-width: 140px;
      cursor: pointer;
      color: var(--vscode-foreground);
    }
    .intel-auto-label input { margin-top: 2px; flex-shrink: 0; }
    .one-click-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 10px;
      margin-top: 0;
      padding: 12px 14px 12px 12px;
      border-radius: var(--r-lg);
      border: 1px solid color-mix(in srgb, var(--vscode-textLink-foreground) 40%, var(--border));
      border-left: 4px solid var(--vscode-textLink-foreground);
      background: linear-gradient(
        165deg,
        color-mix(in srgb, var(--vscode-textLink-foreground) 14%, var(--vscode-sideBar-background)) 0%,
        color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background)) 50%,
        color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-textLink-foreground)) 10%, var(--vscode-sideBar-background)) 100%
      );
      box-shadow:
        0 1px 0 color-mix(in srgb, var(--vscode-widget-shadow) 22%, transparent),
        0 0 26px color-mix(in srgb, var(--vscode-textLink-foreground) 10%, transparent);
    }
    .ocs-cb-slot {
      flex-shrink: 0;
      width: 25px;
      min-height: 1px;
      align-self: flex-start;
    }
    .ocs-glyph {
      position: relative;
      flex-shrink: 0;
      width: 46px;
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: -2px 0 0 -2px;
    }
    .ocs-glyph-main {
      font-size: 34px;
      line-height: 1;
      user-select: none;
      filter: drop-shadow(0 0 14px color-mix(in srgb, var(--vscode-textLink-foreground) 70%, transparent));
      animation: ocs-glyph-pulse 2.4s ease-in-out infinite;
    }
    .ocs-glyph-spark {
      position: absolute;
      right: -4px;
      top: -2px;
      font-size: 15px;
      line-height: 1;
      user-select: none;
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--vscode-charts-yellow, #cca700) 80%, transparent));
      animation: ocs-glyph-spark 1.5s ease-in-out infinite;
    }
    @keyframes ocs-glyph-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }
    @keyframes ocs-glyph-spark {
      0%, 100% { transform: rotate(-10deg) scale(1); opacity: 1; }
      50% { transform: rotate(8deg) scale(1.12); opacity: 0.9; }
    }
    .ocs-content {
      flex: 1;
      min-width: 160px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    button.btn.primary.ocs-pill-btn {
      align-self: flex-start;
      margin-top: 3px;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-family: inherit;
      border: 1px solid color-mix(in srgb, var(--vscode-textLink-foreground) 55%, var(--vscode-button-foreground));
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--vscode-textLink-foreground) 22%, transparent),
        0 0 18px color-mix(in srgb, var(--vscode-textLink-foreground) 18%, transparent);
    }
    .ocs-desc {
      margin: 0;
      font-size: 11px;
      line-height: 1.45;
      color: var(--muted);
    }
    .ocs-desc strong { color: color-mix(in srgb, var(--vscode-foreground) 85%, var(--muted)); }
    button.btn.icon-gear.ocs-gear {
      align-self: flex-start;
      margin-top: 2px;
      border-color: color-mix(in srgb, var(--vscode-textLink-foreground) 45%, var(--border));
      background: color-mix(in srgb, var(--vscode-textLink-foreground) 12%, var(--card));
    }
    button.btn.icon-gear.ocs-gear:hover {
      border-color: var(--vscode-textLink-foreground);
      background: color-mix(in srgb, var(--vscode-textLink-foreground) 22%, var(--card-hover));
    }
    @media (prefers-reduced-motion: reduce) {
      .ocs-glyph-main,
      .ocs-glyph-spark {
        animation: none;
      }
    }
    .thinking-machine-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 10px;
      margin-top: 10px;
      padding: 12px 14px 12px 12px;
      border-radius: var(--r-lg);
      border: 1px solid color-mix(in srgb, var(--vscode-button-background) 38%, var(--border));
      border-left: 4px solid var(--vscode-button-background);
      background: linear-gradient(
        165deg,
        color-mix(in srgb, var(--vscode-button-background) 16%, var(--vscode-sideBar-background)) 0%,
        color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background)) 48%,
        color-mix(in srgb, var(--vscode-focusBorder) 8%, var(--vscode-sideBar-background)) 100%
      );
      box-shadow:
        0 1px 0 color-mix(in srgb, var(--vscode-widget-shadow) 22%, transparent),
        0 0 28px color-mix(in srgb, var(--vscode-button-background) 12%, transparent);
    }
    .tmm-label {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      flex: 1;
      min-width: 160px;
      cursor: pointer;
      color: var(--vscode-foreground);
    }
    .tmm-cb {
      margin-top: 2px;
      flex-shrink: 0;
      width: 15px;
      height: 15px;
      accent-color: var(--vscode-button-background);
    }
    .tmm-body {
      display: flex;
      flex-direction: column;
      gap: 7px;
      min-width: 0;
    }
    .tmm-title-pill {
      display: inline-block;
      align-self: flex-start;
      margin-top: 3px;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: 1px solid color-mix(in srgb, var(--vscode-button-foreground) 22%, transparent);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--vscode-button-background) 35%, transparent);
    }
    .tmm-desc {
      font-size: 11px;
      line-height: 1.45;
      color: var(--muted);
    }
    .tmm-desc strong { color: color-mix(in srgb, var(--vscode-foreground) 88%, var(--muted)); }
    button.btn.icon-gear.tmm-gear {
      align-self: flex-start;
      margin-top: 2px;
      border-color: color-mix(in srgb, var(--vscode-button-background) 45%, var(--border));
      background: color-mix(in srgb, var(--vscode-button-background) 12%, var(--card));
    }
    button.btn.icon-gear.tmm-gear:hover {
      border-color: var(--vscode-button-background);
      background: color-mix(in srgb, var(--vscode-button-background) 22%, var(--card-hover));
    }
    .tmm-glyph {
      position: relative;
      flex-shrink: 0;
      width: 46px;
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: -2px 0 0 -2px;
    }
    .tmm-glyph-main {
      font-size: 38px;
      line-height: 1;
      user-select: none;
      filter: drop-shadow(0 0 16px color-mix(in srgb, var(--vscode-button-background) 75%, transparent))
        drop-shadow(0 2px 8px color-mix(in srgb, var(--vscode-focusBorder) 40%, transparent));
      animation: tmm-glyph-pulse 2.6s ease-in-out infinite;
    }
    .tmm-glyph-bolt {
      position: absolute;
      right: -6px;
      top: -4px;
      font-size: 17px;
      line-height: 1;
      user-select: none;
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 85%, transparent));
      animation: tmm-glyph-zap 1.4s ease-in-out infinite;
    }
    @keyframes tmm-glyph-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.09); }
    }
    @keyframes tmm-glyph-zap {
      0%, 100% { transform: rotate(-12deg) scale(1); opacity: 1; }
      50% { transform: rotate(10deg) scale(1.15); opacity: 0.92; }
    }
    @media (prefers-reduced-motion: reduce) {
      .tmm-glyph-main,
      .tmm-glyph-bolt {
        animation: none;
      }
    }
    button.btn.icon-gear {
      padding: 8px 14px;
      font-size: 20px;
      line-height: 1;
      min-width: 44px;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: var(--card);
      color: inherit;
      cursor: pointer;
    }
    button.btn.icon-gear:hover { border-color: var(--vscode-focusBorder); background: var(--card-hover); }
    .hygiene-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }
    button.hygiene-tile {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      text-align: left;
      padding: 8px 10px;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: var(--card);
      cursor: pointer;
      font: inherit;
      color: inherit;
    }
    button.hygiene-tile:hover { border-color: var(--vscode-focusBorder); background: var(--card-hover); }
    .hic { font-size: 16px; line-height: 1.2; flex-shrink: 0; }
    .htext { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .htt { font-weight: 600; font-size: 11px; }
    .htp { font-size: 9px; color: var(--muted); line-height: 1.3; }

    /* === Agent Teams tab === */
    .at-hero {
      border-radius: var(--r-lg);
      border: 1px solid color-mix(in srgb, var(--vscode-charts-orange, #f97316) 45%, var(--border));
      border-left: 4px solid var(--vscode-charts-orange, #f97316);
      padding: 14px 14px 12px;
      margin-bottom: 12px;
      background: linear-gradient(
        165deg,
        color-mix(in srgb, var(--vscode-charts-orange, #f97316) 14%, var(--vscode-sideBar-background)) 0%,
        color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background)) 55%,
        color-mix(in srgb, var(--vscode-charts-orange, #f97316) 10%, var(--vscode-sideBar-background)) 100%
      );
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .at-hero h3 { margin: 0 0 6px; font-size: 13px; font-weight: 600; }
    .at-hero p { margin: 0 0 10px; font-size: 11px; line-height: 1.5; color: var(--muted); }
    .at-hero .at-status { font-size: 10px; color: var(--muted); margin-bottom: 10px; }
    .at-hero .at-status .ok { color: var(--ok); font-weight: 600; }
    .at-hero .at-status .warn { color: var(--warn); font-weight: 600; }
    .at-hero .row { margin-top: 10px; }
    .at-pack {
      margin: 10px 0 8px;
      border: 1px solid var(--border);
      border-radius: var(--r-sm);
      padding: 8px 10px;
      background: var(--card);
    }
    .at-pack .at-pack-title { font-size: 11px; font-weight: 600; margin-bottom: 6px; }
    .at-pack .at-pack-row {
      display: flex; align-items: flex-start; gap: 6px; padding: 4px 0;
      font-size: 11px;
    }
    .at-pack .at-pack-row input { margin-top: 3px; flex-shrink: 0; }
    .at-pack .at-pack-row .at-pack-meta { color: var(--muted); font-size: 10px; display: block; margin-top: 1px; }
    .at-pack .at-pack-row .at-pack-installed {
      font-size: 9px; padding: 1px 5px; border-radius: 999px;
      background: color-mix(in srgb, var(--ok) 22%, transparent); color: var(--ok);
      margin-left: 6px;
    }
    .at-section {
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--muted);
      display: flex; align-items: center; justify-content: space-between;
      margin: 14px 0 8px;
    }
    .at-section button.btn { font-size: 10px; padding: 4px 9px; min-height: 24px; }
    .at-card {
      border-radius: var(--r-lg);
      border: 1px solid var(--border);
      background: var(--card);
      padding: 10px 12px 10px 14px;
      margin-bottom: 8px;
      border-left: 3px solid var(--vscode-focusBorder);
    }
    .at-card:hover { border-color: color-mix(in srgb, var(--vscode-focusBorder) 65%, var(--border)); background: var(--card-hover); }
    .at-card h3 { margin: 0; font-size: 12.5px; font-weight: 600; }
    .at-card .at-meta { font-size: 9.5px; color: var(--muted); margin-top: 2px; word-break: break-all; }
    .at-card .at-desc { font-size: 11px; margin-top: 6px; line-height: 1.4; }
    .at-card .row { margin-top: 8px; }
    .at-role-badge {
      font-size: 9px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: color-mix(in srgb, var(--accent) 20%, transparent);
      color: var(--vscode-button-foreground);
      margin-left: 6px;
    }
    .at-pill {
      font-size: 9px; padding: 2px 6px; border-radius: 999px;
      background: color-mix(in srgb, var(--muted) 18%, transparent);
      color: var(--muted);
      margin-right: 4px;
    }
    .at-pill.runtime-native { background: color-mix(in srgb, var(--vscode-charts-green, #22c55e) 22%, transparent); color: var(--vscode-charts-green, #22c55e); }
    .at-pill.runtime-custom { background: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 22%, transparent); color: var(--vscode-charts-orange, #f97316); }
    .at-pill.at-cmd-pill { background: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 22%, transparent); color: var(--vscode-charts-blue, #3b82f6); font-family: monospace; }

    /* Form (agent + team) */
    .at-form {
      border-radius: var(--r-lg);
      border: 1px solid var(--border);
      padding: 12px 14px;
      margin-bottom: 12px;
      background: var(--card);
    }
    .at-form h3 { margin: 0 0 10px; font-size: 12.5px; font-weight: 600; }
    .at-form label { display: block; font-size: 10px; font-weight: 600; margin-bottom: 3px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .at-form input[type="text"], .at-form textarea, .at-form select {
      width: 100%;
      padding: 6px 8px;
      font-family: inherit;
      font-size: 11px;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      margin-bottom: 8px;
      box-sizing: border-box;
    }
    .at-form textarea { min-height: 80px; resize: vertical; font-family: var(--vscode-editor-font-family, monospace); }
    .at-form .at-form-row { display: flex; gap: 8px; }
    .at-form .at-form-row > div { flex: 1; min-width: 0; }
    .at-form .at-color-preview {
      display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--border); vertical-align: middle; margin-right: 6px;
    }
    .at-form .at-checkbox-list {
      max-height: 140px; overflow-y: auto;
      border: 1px solid var(--border); border-radius: var(--r-sm);
      padding: 6px 8px; background: var(--vscode-input-background);
      margin-bottom: 8px;
    }
    .at-form .at-checkbox-list label {
      display: flex; align-items: center; gap: 6px;
      text-transform: none; letter-spacing: normal;
      font-size: 11px; font-weight: 500;
      margin-bottom: 3px; color: inherit; cursor: pointer;
    }
    .at-form .at-checkbox-list input { margin: 0; }
    .at-form .at-form-actions { display: flex; gap: 6px; margin-top: 4px; }
    .at-empty-tip {
      font-size: 10.5px; color: var(--muted); margin: 6px 0 12px; line-height: 1.4;
    }
    .at-summary-row {
      display: flex; flex-wrap: wrap; gap: 10px;
      padding: 8px 10px; margin-bottom: 12px;
      border: 1px solid var(--border);
      border-radius: var(--r-sm);
      background: var(--card);
      font-size: 10.5px;
    }
    .at-summary-row .at-summary-item .k { color: var(--muted); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; }
    .at-summary-row .at-summary-item .v { font-weight: 600; font-size: 11.5px; }
    .at-color-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }

    /* === Live transcript === */
    .at-run-panel {
      border: 1px solid var(--border);
      border-left: 3px solid var(--vscode-charts-orange, #f97316);
      border-radius: var(--r-lg);
      background: var(--card);
      margin-bottom: 12px;
    }
    .at-run-head {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    .at-run-head h3 { margin: 0; font-size: 12.5px; font-weight: 600; }
    .at-run-meta { font-size: 10px; color: var(--muted); }
    .at-run-phase-pill {
      font-size: 9px; padding: 2px 7px; border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 22%, transparent);
      color: var(--vscode-button-foreground); text-transform: uppercase; letter-spacing: 0.05em;
    }
    .at-run-phase-pill.phase-plan { background: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 32%, transparent); color: var(--vscode-charts-blue, #3b82f6); }
    .at-run-phase-pill.phase-code { background: color-mix(in srgb, var(--vscode-charts-green, #22c55e) 32%, transparent); color: var(--vscode-charts-green, #22c55e); }
    .at-run-phase-pill.phase-none { background: color-mix(in srgb, var(--muted) 18%, transparent); color: var(--muted); }
    .at-run-status-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: var(--ok); margin-right: 6px;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--ok) 32%, transparent);
    }
    .at-run-status-dot.running { animation: at-pulse 1.2s ease-in-out infinite; }
    .at-run-status-dot.awaiting_approval { background: var(--warn); box-shadow: 0 0 0 2px color-mix(in srgb, var(--warn) 35%, transparent); }
    .at-run-status-dot.error { background: var(--vscode-errorForeground, #f48771); }
    .at-run-status-dot.completed { background: var(--muted); opacity: 0.7; }
    @keyframes at-pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ok) 32%, transparent); }
      50% { transform: scale(1.25); box-shadow: 0 0 0 5px color-mix(in srgb, var(--ok) 15%, transparent); }
    }
    .at-run-actions { margin-left: auto; display: flex; gap: 6px; }
    .at-transcript {
      max-height: 360px;
      overflow-y: auto;
      padding: 6px 12px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 10.5px;
    }
    .at-line {
      padding: 4px 0 4px 8px;
      border-left: 3px solid var(--muted);
      margin-bottom: 4px;
      line-height: 1.4;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .at-line .at-line-head {
      display: flex; gap: 6px; align-items: center;
      font-size: 9px; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.04em;
      margin-bottom: 2px;
    }
    .at-line .at-line-agent { color: var(--vscode-foreground); font-weight: 600; text-transform: none; letter-spacing: normal; font-size: 10px; }
    .at-line .at-line-kind { padding: 0 5px; border-radius: 4px; background: color-mix(in srgb, var(--muted) 20%, transparent); }
    .at-line.kind-error { border-left-color: var(--vscode-errorForeground, #f48771); }
    .at-line.kind-error .at-line-kind { background: color-mix(in srgb, var(--vscode-errorForeground, #f48771) 25%, transparent); color: var(--vscode-errorForeground, #f48771); }
    .at-line.kind-tool_use, .at-line.kind-tool_result { font-size: 10px; }
    .at-line.kind-message { font-style: italic; }
    .at-line.kind-phase_boundary { border-left-color: var(--vscode-charts-yellow, #eab308); background: color-mix(in srgb, var(--vscode-charts-yellow, #eab308) 8%, transparent); padding: 6px 8px; }
    .at-line.kind-plan_artifact { border-left-color: var(--vscode-charts-blue, #3b82f6); }
    .at-line.kind-run_end { border-left-color: var(--vscode-foreground); background: color-mix(in srgb, var(--vscode-foreground) 4%, transparent); padding: 6px 8px; }
    .at-totals {
      display: flex; flex-wrap: wrap; gap: 10px;
      padding: 6px 12px; font-size: 10px;
      border-top: 1px solid var(--border);
      color: var(--muted);
    }
    .at-totals strong { color: var(--vscode-foreground); font-weight: 600; }

    /* Approval modal */
    .at-modal-backdrop {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: color-mix(in srgb, var(--vscode-editor-background) 70%, #000);
      z-index: 9998;
    }
    .at-modal {
      position: fixed; left: 50%; top: 10%; transform: translateX(-50%);
      width: min(640px, 92%);
      max-height: 82vh;
      display: flex; flex-direction: column;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      z-index: 9999;
      box-shadow: 0 10px 40px rgba(0,0,0,0.35);
    }
    .at-modal h3 { margin: 0; padding: 12px 14px; font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--border); }
    .at-modal .at-modal-body { padding: 12px 14px; overflow-y: auto; flex: 1; }
    .at-modal .at-modal-body textarea {
      width: 100%; min-height: 260px; font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11.5px; background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px;
      box-sizing: border-box;
    }
    .at-modal .at-modal-actions {
      padding: 10px 14px; border-top: 1px solid var(--border);
      display: flex; gap: 8px; justify-content: flex-end;
    }
    .at-run-prompt {
      width: 100%; min-height: 80px; padding: 6px 8px;
      font-family: inherit; font-size: 11px; border-radius: var(--r-sm);
      border: 1px solid var(--border); background: var(--vscode-input-background);
      color: var(--vscode-input-foreground); margin-bottom: 8px; box-sizing: border-box;
    }

    /* === Agent Dashboard strip === */
    .ad-strip-head {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: 8px 10px;
      border: 1px solid color-mix(in srgb, var(--vscode-charts-orange, #f97316) 35%, var(--border));
      border-left: 3px solid var(--vscode-charts-orange, #f97316);
      border-radius: var(--r-sm);
      background: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 6%, var(--card));
      margin-bottom: 8px;
      font-size: 11px;
    }
    .ad-strip-head .ad-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: var(--muted); margin-right: 6px;
    }
    .ad-strip-head .ad-dot.running { background: var(--ok); animation: at-pulse 1.2s ease-in-out infinite; }
    .ad-strip-head .ad-dot.stopped { background: var(--muted); opacity: 0.5; }
    .ad-strip-head .ad-dot.error   { background: var(--vscode-errorForeground, #f48771); }
    .ad-strip-head button.btn { padding: 4px 10px; min-height: 24px; font-size: 10px; }

    .ad-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .ad-card {
      border: 1px solid var(--border);
      border-radius: var(--r-sm);
      padding: 8px 10px;
      background: var(--card);
      border-left: 3px solid var(--muted);
      display: flex; flex-direction: column; gap: 4px;
      font-size: 10.5px;
      min-width: 0;
    }
    .ad-card.source-internal { border-left-color: var(--vscode-charts-orange, #f97316); }
    .ad-card.source-external { border-left-color: var(--vscode-charts-blue, #3b82f6); }
    .ad-card.status-error { border-left-color: var(--vscode-errorForeground, #f48771); }
    .ad-card.over-budget { border-color: color-mix(in srgb, var(--warn) 55%, var(--border)); }
    .ad-card .ad-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .ad-card .ad-title { font-weight: 600; font-size: 11px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ad-card .ad-framework, .ad-card .ad-source {
      font-size: 9px; padding: 1px 6px; border-radius: 999px;
      background: color-mix(in srgb, var(--muted) 20%, transparent); color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.03em;
    }
    .ad-card .ad-source-internal { background: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 22%, transparent); color: var(--vscode-charts-orange, #f97316); }
    .ad-card .ad-source-external { background: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 22%, transparent); color: var(--vscode-charts-blue, #3b82f6); }
    .ad-card .ad-status-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: var(--muted);
    }
    .ad-card .ad-status-dot.running { background: var(--ok); animation: at-pulse 1.2s ease-in-out infinite; }
    .ad-card .ad-status-dot.thinking { background: var(--vscode-charts-blue, #3b82f6); animation: at-pulse 1.4s ease-in-out infinite; }
    .ad-card .ad-status-dot.awaiting_approval,
    .ad-card .ad-status-dot.awaiting_permission { background: var(--warn); animation: at-pulse 1.1s ease-in-out infinite; }
    .ad-card .ad-status-dot.error { background: var(--vscode-errorForeground, #f48771); }
    .ad-card .ad-status-dot.done, .ad-card .ad-status-dot.idle { background: var(--muted); opacity: 0.55; }

    .ad-card .ad-tool {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 10px; color: var(--vscode-charts-green, #22c55e);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ad-card .ad-tool.perm { color: var(--warn); }
    .ad-card .ad-tool .ad-tool-target { color: var(--muted); margin-left: 4px; }

    .ad-card .ad-ctx-bar {
      width: 100%; height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--muted) 18%, transparent);
      overflow: hidden; margin: 2px 0;
    }
    .ad-card .ad-ctx-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #00b894, #00d4aa, #4dffd4);
    }
    .ad-card .ad-ctx-label { font-size: 9px; color: var(--muted); }

    .ad-card .ad-metrics { display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; color: var(--muted); }
    .ad-card .ad-metrics strong { color: var(--vscode-foreground); font-weight: 600; }
    .ad-card.over-budget .ad-metrics .ad-cost { color: var(--warn); font-weight: 700; }

    .ad-card .ad-feed { display: flex; flex-direction: column; gap: 2px; font-size: 9.5px; }
    .ad-card .ad-feed .ad-feed-line {
      font-family: var(--vscode-editor-font-family, monospace);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .ad-card .ad-feed .ad-feed-line.running { color: var(--vscode-charts-green, #22c55e); }
    .ad-card .ad-feed .ad-feed-line.error { color: var(--vscode-errorForeground, #f48771); }

    .ad-card .ad-alert {
      padding: 3px 6px; border-radius: var(--r-sm);
      background: color-mix(in srgb, var(--vscode-errorForeground, #f48771) 18%, transparent);
      color: var(--vscode-errorForeground, #f48771);
      font-size: 9.5px;
      display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
    }
    .ad-card .ad-alert button.btn { padding: 2px 7px; min-height: 20px; font-size: 9px; }
    .ad-card .ad-dissent {
      font-size: 9.5px; padding: 1px 6px; border-radius: 999px;
      background: color-mix(in srgb, var(--vscode-charts-yellow, #eab308) 22%, transparent);
      color: var(--vscode-charts-yellow, #eab308);
    }

    .ad-card .ad-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
    .ad-card .ad-actions button.btn { padding: 3px 8px; min-height: 22px; font-size: 9px; }

    .ad-disclose {
      border: 1px solid color-mix(in srgb, var(--vscode-charts-orange, #f97316) 40%, var(--border));
      border-left: 3px solid var(--vscode-charts-orange, #f97316);
      border-radius: var(--r-lg);
      padding: 12px 14px;
      background: color-mix(in srgb, var(--vscode-charts-orange, #f97316) 8%, var(--card));
      margin-bottom: 12px;
    }
    .ad-disclose h3 { margin: 0 0 6px; font-size: 12.5px; font-weight: 600; }
    .ad-disclose ul { margin: 4px 0 10px 18px; padding: 0; font-size: 11px; color: var(--muted); }
    .ad-disclose code { font-family: var(--vscode-editor-font-family, monospace); font-size: 10.5px; }

    /* Phase 2 — toolbar + swim lanes */
    .ad-toolbar {
      display: flex; gap: 8px; align-items: center;
      margin-bottom: 8px;
    }
    .ad-toolbar .ad-filter {
      flex: 1; min-width: 0;
      padding: 5px 8px;
      font-family: inherit; font-size: 11px;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      box-sizing: border-box;
    }
    .ad-toolbar .ad-group-toggle { display: flex; gap: 4px; }
    .ad-toolbar .ad-group-toggle .btn { padding: 4px 10px; min-height: 24px; font-size: 10px; }
    .ad-body { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
    .ad-lane { display: flex; flex-direction: column; gap: 6px; }
    .ad-lane-head {
      display: flex; align-items: baseline; gap: 6px;
      font-size: 10px; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.05em;
      padding: 0 4px;
    }
    .ad-lane-head .ad-lane-title { font-weight: 700; color: var(--vscode-foreground); text-transform: none; letter-spacing: 0; font-size: 11px; }
    .ad-lane-head .ad-lane-count {
      font-size: 9px; padding: 1px 7px; border-radius: 999px;
      background: color-mix(in srgb, var(--muted) 20%, transparent);
      color: var(--muted);
    }
    .ad-card[data-pinned="1"] { outline: 1px dashed color-mix(in srgb, var(--vscode-charts-yellow, #eab308) 55%, transparent); outline-offset: -1px; }
  </style>
</head>
<body>
  <div class="hub-header">
    <p class="hub-tabs-hint" id="hub-tabs-hint">Click a tab to switch sections — each has different tools.</p>
    <nav class="pages" id="pages" aria-label="Hub sections">
      <button type="button" class="page-btn active" data-page="intel" aria-label="Intelligence" title="Bridges, One Click, Thinking Machine, readiness, scans">🧠 Intelligence</button>
      <button type="button" class="page-btn" data-page="mcp" aria-label="MCP" title="Registry search and MCP servers (workspace + user)">🔌 MCP</button>
      <button type="button" class="page-btn" data-page="skills" aria-label="Skills" title="skills.sh catalog and local SKILL.md folders">📚 Skills</button>
      <button type="button" class="page-btn" data-page="workspace" aria-label="Workspace" title="Workspace checklist and all toolbox commands">📋 Workspace</button>
      <button type="button" class="page-btn" data-page="agentteams" aria-label="Agentic Teams" title="Multi-agent planning &amp; debate: agents, teams, live transcript, debate + plan-then-code, dashboard, slash commands">🤝 Agentic Teams</button>
    </nav>
    <nav class="subpages" id="subpages" aria-label="Browse or installed">
      <button type="button" class="sub-btn active" data-sub="browse">Browse</button>
      <button type="button" class="sub-btn" data-sub="installed">Installed</button>
    </nav>
    <div id="intel-auto-scan" class="intel-auto-scan" aria-label="Intelligence quick actions">
      <div class="one-click-row" aria-label="One Click Setup">
        <div class="ocs-glyph" title="One Click Setup" aria-hidden="true">
          <span class="ocs-glyph-main">⚡</span>
          <span class="ocs-glyph-spark">✨</span>
        </div>
        <div class="ocs-cb-slot" aria-hidden="true"></div>
        <div class="ocs-content">
          <button type="button" class="btn primary ocs-pill-btn" id="one-click-setup-run">One Click Setup</button>
          <p class="ocs-desc" id="ocs-desc">Opens the <strong>One Click Setup</strong> wizard: migration tracks (Cursor / Copilot), bridge CLIs, merges, and follow-ups. Copy updates when hub state loads (VS Code vs JetBrains).</p>
        </div>
        <button type="button" class="btn icon-gear ocs-gear" id="one-click-setup-settings" title="One Click Setup defaults" aria-label="One Click Setup settings">⚙</button>
      </div>
      <div class="thinking-machine-row" aria-label="Thinking Machine Mode">
        <div class="tmm-glyph" title="Thinking Machine Mode" aria-hidden="true">
          <span class="tmm-glyph-main">🧠</span>
          <span class="tmm-glyph-bolt">⚡</span>
        </div>
        <label class="tmm-label" for="thinking-machine-mode-cb">
          <input type="checkbox" id="thinking-machine-mode-cb" class="tmm-cb" />
          <span class="tmm-body">
            <span class="tmm-title-pill">Thinking Machine Mode</span>
            <span class="tmm-desc">Session priming for <strong>Claude Code</strong> — MCP &amp; Skills awareness under <code>.claude/</code>, merge into <code>CLAUDE.md</code>, and context pack (opens Claude Code when your pack defaults allow). First enable: confirm <strong>Engage</strong>; <strong>Cancel</strong> turns the mode off.</span>
          </span>
        </label>
        <button type="button" class="btn icon-gear tmm-gear" id="thinking-machine-settings" title="Thinking Machine Mode settings" aria-label="Thinking Machine Mode settings">⚙</button>
      </div>
    </div>
    <div class="search-wrap" id="search-wrap">
      <input class="search" type="search" id="q" placeholder="Search servers, skills, or tools…" />
    </div>
    <div class="chip-row" id="mcp-chips">
      <button type="button" class="chip" data-cmd="workbench.mcp.browseServers">Registry</button>
      <button type="button" class="chip" data-cmd="workbench.mcp.addConfiguration">Add server</button>
      <button type="button" class="chip" data-cmd="workbench.mcp.listServer">List (native)</button>
      <button type="button" class="chip" data-cmd="CloudeCodeToolBox.portCursorMcp">Port Cursor → VS Code</button>
      <button type="button" class="chip" data-cmd="dummy-refresh">Refresh</button>
    </div>
  </div>
  <div id="scroll"><div id="root"></div></div>
  <div id="intel-foot-scan" class="intel-auto-scan intel-foot-scan" aria-label="Auto MCP and skills scan">
    <div class="auto-row">
      <label class="intel-auto-label" for="intel-auto-scan-cb">
        <input type="checkbox" id="intel-auto-scan-cb" />
        <span>When checked: after a workspace opens (debounced), save MCP &amp; Skills awareness to <code>.claude/cloude-code-toolbox-mcp-skills-awareness.md</code> (overwritten), refresh hub, and update the MCP/skills block in <code>CLAUDE.md</code> — no editor tab. Re-runs on reopen so new MCP/skills are reflected. <strong>Scan now</strong> does the same immediately. Use Claude Code <code>/mcp</code> for live tools in the Claude session.</span>
      </label>
      <button type="button" class="btn primary" id="intel-scan-now">Scan now</button>
    </div>
  </div>
  <script>
(function () {
  var vscode = acquireVsCodeApi();
  var state = null;
  var page = "intel";
  var sub = "browse";

  var reg = { generation: 0, servers: [], nextCursor: null, loading: false, error: null, q: "" };
  var skillRm = { generation: 0, items: [], loading: false, error: null, q: "" };
  var debReg = null;
  var debSkill = null;

  var TOOL_GROUPS = [
    {
      title: "Thinking Machine Mode",
      items: [
        { ic: "\\u26A1", t: "One Click Setup", d: "Dual migration tracks (Cursor + Copilot) + bridges + scans — confirm in modal", c: "CloudeCodeToolBox.runOneClickSetup" },
        { ic: "\\uD83D\\uDE80", t: "Prime session", d: "Awareness scan + context pack (enable Thinking Machine Mode first)", c: "CloudeCodeToolBox.runThinkingMachinePriming" },
        { ic: "\\uD83D\\uDCE6", t: "Build context pack", d: "Structured bundle for Claude Code (copy)", c: "CloudeCodeToolBox.buildContextPack" },
        { ic: "\\uD83D\\uDEE1", t: "Readiness summary", d: "Check workspace + instructions + MCP wiring", c: "CloudeCodeToolBox.showIntelligenceReadiness" },
        { ic: "\\uD83D\\uDCDD", t: "Context pack defaults", d: "Git, diagnostics, notepad, open Claude Code after pack", c: "CloudeCodeToolBox.openIntelligenceSettings" },
        { ic: "\\uD83D\\uDD17", t: "Toolbox CLI repos (GitHub)", d: "MCP port, memory bank, rules converter — pick in quick pick", c: "CloudeCodeToolBox.openIntelligenceToolboxRepos" },
        { ic: "\\uD83D\\uDCC1", t: "Port MCP (bundled CLI)", d: "Same as npx port; runs Node CLI from the extension", c: "CloudeCodeToolBox.manualPortCursorMcpWithoutNpx" },
        { ic: "\\uD83D\\uDCD6", t: "Memory bank (bundled CLI)", d: "Same as npx init; runs Node CLI from the extension", c: "CloudeCodeToolBox.memoryBankWithoutNpx" },
        { ic: "\\uD83D\\uDCC4", t: "Cursor rules (bundled CLI)", d: "Same as npx converter; runs Node CLI from the extension", c: "CloudeCodeToolBox.cursorRulesToClaudeWithoutNpx" },
        { ic: "\\uD83D\\uDCC2", t: "Reveal skill folders", d: ".cursor/skills and .agents/skills", c: "CloudeCodeToolBox.revealSkillFoldersWithoutNpx" },
        { ic: "\\uD83D\\uDCE5", t: "Migrate skills .cursor → .agents", d: "SKILL.md folders to .agents/skills (copy or move)", c: "CloudeCodeToolBox.migrateSkillsCursorToAgents" },
        { ic: "\\uD83D\\uDCDC", t: "Merge Copilot instructions → CLAUDE.md", d: ".github/copilot-instructions.md (replaceable block)", c: "CloudeCodeToolBox.mergeCopilotInstructionsIntoClaudeMd" },
        { ic: "\\uD83D\\uDCE5", t: "Migrate Copilot/GitHub skills → .agents", d: ".github/skills and ~/.copilot/skills", c: "CloudeCodeToolBox.migrateCopilotSkillsToAgents" },
        { ic: "\\uD83D\\uDCC2", t: "Reveal Copilot skill folders", d: "No npx — create/reveal paths", c: "CloudeCodeToolBox.revealCopilotSkillFoldersWithoutNpx" },
        { ic: "\\uD83D\\uDD27", t: "Open Claude Code user settings (JSON)", d: "~/.claude/settings.json for MCP, etc.", c: "CloudeCodeToolBox.openClaudeUserSettingsJson" },
        { ic: "\\uD83D\\uDD0D", t: "Scan MCP & Skills awareness", d: "Save to .claude + update CLAUDE.md (optional open from toast)", c: "CloudeCodeToolBox.showMcpSkillsAwareness" },
        { ic: "\\uD83D\\uDD0D", t: "Claude Code / MCP config scan", d: "Heuristic scan → Output (mcp.json, CLAUDE.md)", c: "CloudeCodeToolBox.claudeToolboxConfigScan" },
        { ic: "\\uD83D\\uDCD3", t: "Append notepad → memory-bank", d: "Preview then write to memory-bank/**/*.md", c: "CloudeCodeToolBox.appendNotepadToMemoryBank" },
        { ic: "\\u2728", t: "Create SKILL.md stub", d: ".github/skills/<name>/SKILL.md", c: "CloudeCodeToolBox.createSkillStub" },
        { ic: "\\u2705", t: "Verification checklist", d: "Quick multi-pick before ship", c: "CloudeCodeToolBox.verificationChecklist" },
        { ic: "\\uD83E\\uDDE9", t: "Apply bundled MCP recipe", d: "Merge sample server into .vscode/mcp.json", c: "CloudeCodeToolBox.applyBundledMcpRecipe" },
        { ic: "\\u25B6", t: "Run first test task", d: "tasks.json (test-like name or first task)", c: "CloudeCodeToolBox.runFirstWorkspaceTestTask" }
      ]
    },
    {
      title: "Chat & session",
      items: [
        { ic: "\\uD83D\\uDCAC", t: "Open Claude Code", d: "Focus Claude Code panel", c: "CloudeCodeToolBox.openClaudeCodePanel" },
        { ic: "\\uD83D\\uDCD2", t: "Session notepad", d: "Scratch space for this session", c: "CloudeCodeToolBox.openSessionNotepad" },
        { ic: "\\uD83D\\uDCCB", t: "Copy notepad", d: "Clipboard", c: "CloudeCodeToolBox.copySessionNotepad" },
        { ic: "\\uD83D\\uDDBC", t: "Composer tips hub", d: "Panel with chat / composer notes", c: "CloudeCodeToolBox.openComposerHub" },
        { ic: "\\uD83D\\uDCAC", t: "Inline chat (Cursor-style)", d: "Shortcut-friendly proxy", c: "CloudeCodeToolBox.openInlineChatCursorStyle" }
      ]
    },
    {
      title: "Rules & instructions",
      items: [
        { ic: "\\uD83D\\uDCD6", t: "Cursor vs Claude Code reference", d: "Side-by-side behaviors", c: "CloudeCodeToolBox.openCursorClaudeReference" },
        { ic: "\\uD83D\\uDD04", t: "Translate @-mentions", d: "Selection → Claude-friendly phrasing", c: "CloudeCodeToolBox.translateContextSelection" },
        { ic: "\\u279E", t: "Append .cursorrules", d: "Into CLAUDE.md", c: "CloudeCodeToolBox.appendCursorrules" },
        { ic: "\\uD83D\\uDCC4", t: "Open instruction file…", d: "Picker for CLAUDE.md and related", c: "CloudeCodeToolBox.openInstructionsPicker" },
        { ic: "\\u2728", t: "Create .cursorrules template", d: "Starter file in workspace", c: "CloudeCodeToolBox.createCursorrulesTemplate" },
        { ic: "\\uD83D\\uDD04", t: "Sync Cursor rules → CLAUDE.md", d: "npx or bundled CLI", c: "CloudeCodeToolBox.syncCursorRules" }
      ]
    },
    {
      title: "MCP & Cursor bridges",
      items: [
        { ic: "\\uD83D\\uDD0C", t: "Open workspace mcp.json", d: "Extension command", c: "CloudeCodeToolBox.openWorkspaceMcp" },
        { ic: "\\uD83D\\uDD0C", t: "Open user mcp.json", d: "Extension command", c: "CloudeCodeToolBox.openUserMcp" },
        { ic: "\\u2699", t: "Toggle MCP discovery", d: "chat.mcp.discovery.enabled", c: "CloudeCodeToolBox.toggleMcpDiscovery" },
        { ic: "\\u2795", t: "Add server (native)", d: "VS Code MCP UI", c: "CloudeCodeToolBox.mcpAddServer" }
      ]
    },
    {
      title: "Workspace setup",
      items: [
        { ic: "\\u2699", t: "One Click settings", d: "Which steps run, MCP port mode, memory bank modes", c: "CloudeCodeToolBox.openOneClickSetupSettings" },
        { ic: "\\uD83E\\uDDE0", t: "Init memory bank", d: "npx memory bank", c: "CloudeCodeToolBox.initMemoryBank" }
      ]
    },
    {
      title: "Docs & environment",
      items: [
        { ic: "\\uD83D\\uDCCA", t: "Claude Code account / pricing", d: "Docs picker", c: "CloudeCodeToolBox.openClaudeCodeAccountDocs" },
        { ic: "\\u2705", t: "Environment sync checklist", d: "Tooling alignment", c: "CloudeCodeToolBox.openEnvSyncChecklist" }
      ]
    }
  ];

  function $(sel) { return document.querySelector(sel); }
  function norm(s) { return (s || "").toLowerCase(); }
  function qTrim() {
    var inp = $("#q");
    if (!inp || typeof inp.value !== "string") {
      return "";
    }
    return inp.value.trim();
  }

  function setSearchPlaceholder() {
    var inp = $("#q");
    if (!inp) return;
    if (page === "mcp" && sub === "browse") {
      inp.setAttribute("placeholder", "Search official MCP registry…");
    } else if (page === "skills" && sub === "browse") {
      inp.setAttribute("placeholder", "Search skills.sh…");
    } else if (page === "workspace") {
      inp.setAttribute("placeholder", "Filter toolbox commands…");
    } else {
      inp.setAttribute("placeholder", "Filter installed items…");
    }
  }

  function updateChrome() {
    var subEl = $("#subpages");
    var searchEl = $("#search-wrap");
    var chipsEl = $("#mcp-chips");
    if (!subEl || !searchEl || !chipsEl) {
      return;
    }
    var showSub = page === "mcp" || page === "skills";
    subEl.style.display = showSub ? "flex" : "none";
    searchEl.style.display = (page === "intel" || page === "agentteams") ? "none" : "block";
    chipsEl.style.display = page === "mcp" && sub === "browse" ? "flex" : "none";
    var intelAuto = $("#intel-auto-scan");
    if (intelAuto) {
      intelAuto.style.display = page === "intel" ? "block" : "none";
    }
    var intelFootScan = $("#intel-foot-scan");
    if (intelFootScan) {
      intelFootScan.style.display = page === "intel" ? "block" : "none";
    }
    setSearchPlaceholder();
  }

  function syncIntelAutoScanCheckbox() {
    var cb = $("#intel-auto-scan-cb");
    if (!cb || !state) return;
    cb.checked = state.autoScanMcpSkillsOnWorkspaceOpen === true;
  }

  function syncThinkingMachineModeCheckbox() {
    var tcb = $("#thinking-machine-mode-cb");
    if (!tcb || !state) return;
    tcb.checked = state.thinkingMachineModeEnabled === true;
  }

  /** Build description with strong/code/em via DOM APIs (avoids innerHTML sinks for static analyzers). */
  function setOcsRichDescription(el, segments) {
    el.textContent = "";
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      if (typeof s === "string") {
        el.appendChild(document.createTextNode(s));
      } else if (s.tag === "strong") {
        var st = document.createElement("strong");
        st.textContent = s.text;
        el.appendChild(st);
      } else if (s.tag === "code") {
        var cd = document.createElement("code");
        cd.textContent = s.text;
        el.appendChild(cd);
      } else if (s.tag === "em") {
        var em = document.createElement("em");
        em.textContent = s.text;
        el.appendChild(em);
      }
    }
  }

  /** VS Code vs JetBrains: one-click blurb + top hint (shared HTML). */
  function syncHubHostCopy() {
    var hint = document.getElementById("hub-tabs-hint");
    var ocs = document.getElementById("ocs-desc");
    if (!state) {
      return;
    }
    if (hint) {
      if (state.hubHost === "intellij") {
        hint.textContent =
          "JetBrains — same hub as VS Code; Cursor/Copilot bridges use CLIs bundled in the plugin (node), not public npx.";
      } else {
        hint.textContent = "Click a tab to switch sections — each has different tools.";
      }
    }
    if (ocs) {
      if (state.hubHost === "intellij") {
        setOcsRichDescription(ocs, [
          "Opens the ",
          { tag: "strong", text: "One Click Setup" },
          " wizard. Bridge steps run the CLIs ",
          { tag: "strong", text: "packaged in this plugin" },
          " via ",
          { tag: "code", text: "node" },
          " (optional absolute Node path in Settings). Tracks: Cursor and/or Copilot → Claude Code, memory bank, merges, MCP port, scans. You confirm before anything runs.",
        ]);
      } else {
        setOcsRichDescription(ocs, [
          "Opens the ",
          { tag: "strong", text: "One Click Setup" },
          " wizard. Bridge steps use ",
          { tag: "code", text: "npx" },
          " to the registry ",
          { tag: "em", text: "or" },
          " the CLIs bundled with the extension — your choice from the cards below. Tracks: Cursor and/or Copilot → Claude Code, memory bank, merges, scans. You confirm before anything runs.",
        ]);
      }
    }
  }

  function scheduleRegistry(append) {
    if (debReg) clearTimeout(debReg);
    debReg = setTimeout(function () {
      debReg = null;
      runRegistrySearch(append);
    }, 450);
  }

  function runRegistrySearch(append) {
    if (page !== "mcp" || sub !== "browse") return;
    var q = qTrim();
    if (!append) {
      reg.generation++;
    }
    var gen = reg.generation;
    if (!q) {
      reg.servers = [];
      reg.nextCursor = null;
      reg.loading = false;
      reg.error = null;
      reg.q = "";
      render();
      return;
    }
    reg.loading = true;
    reg.error = null;
    reg.q = q;
    if (!append) {
      reg.servers = [];
      reg.nextCursor = null;
    }
    render();
    vscode.postMessage({
      type: "registrySearch",
      generation: gen,
      search: q,
      cursor: append ? reg.nextCursor : undefined,
      append: !!append
    });
  }

  function scheduleSkillRemote() {
    if (debSkill) clearTimeout(debSkill);
    debSkill = setTimeout(function () {
      debSkill = null;
      runSkillRemoteSearch();
    }, 450);
  }

  function runSkillRemoteSearch() {
    if (page !== "skills" || sub !== "browse") return;
    skillRm.generation++;
    var gen = skillRm.generation;
    var q = qTrim();
    if (!q) {
      skillRm.items = [];
      skillRm.loading = false;
      skillRm.error = null;
      skillRm.q = "";
      render();
      return;
    }
    skillRm.loading = true;
    skillRm.error = null;
    skillRm.q = q;
    render();
    vscode.postMessage({ type: "skillSearch", generation: gen, query: q });
  }

  function registryRepoLine(entry) {
    var s = entry && entry.server ? entry.server : entry;
    if (!s || !s.repository || !s.repository.url) return "";
    return String(s.repository.url);
  }

  function appendRegistryCatalog(rootEl) {
    rootEl.appendChild(el("div", "section-title", "Official MCP registry"));
    var qv = qTrim();
    if (!qv && !reg.loading && reg.servers.length === 0) {
      rootEl.appendChild(el("div", "empty", "Use the search box to query the public MCP registry, then click Install to open VS Code\u2019s MCP setup."));
      return;
    }
    if (reg.loading && reg.servers.length === 0) {
      rootEl.appendChild(el("div", "empty", "Searching registry…"));
      return;
    }
    if (reg.error) {
      rootEl.appendChild(el("div", "empty", "Registry error: " + reg.error));
      return;
    }
    if (reg.servers.length === 0) {
      rootEl.appendChild(el("div", "empty", "No registry results for this query."));
      return;
    }
    reg.servers.forEach(function (entry, idx) {
      var s = entry && entry.server ? entry.server : entry;
      var title = (s && s.name) ? s.name : "MCP server";
      var desc = (s && s.description) ? s.description : "";
      var card = el("div", "mcp-card catalog-card");
      var top = el("div", "card-top");
      top.appendChild(el("h3", null, title));
      top.appendChild(el("span", "badge", "Registry"));
      card.appendChild(top);
      var repo = registryRepoLine(entry);
      if (repo) card.appendChild(el("div", "meta", repo));
      if (desc) card.appendChild(el("div", "desc", desc));
      var row = el("div", "row");
      var ins = el("button", "btn primary", "Install");
      ins.setAttribute("data-reg-idx", String(idx));
      row.appendChild(ins);
      card.appendChild(row);
      rootEl.appendChild(card);
    });
    if (reg.nextCursor) {
      var moreRow = el("div", "row");
      var more = el("button", "btn", "Load more results");
      more.addEventListener("click", function () {
        runRegistrySearch(true);
      });
      moreRow.appendChild(more);
      rootEl.appendChild(moreRow);
    }
  }

  function appendSkillRemoteCatalog(rootEl) {
    rootEl.appendChild(el("div", "section-title", "skills.sh catalog"));
    var qv = qTrim();
    if (!qv && !skillRm.loading && skillRm.items.length === 0) {
      rootEl.appendChild(el("div", "empty", "Search to browse skills from skills.sh. Install runs npx skills add (often targets Cursor). Local SKILL.md folders below are listed for browsing only — they are not on disk only."));
      return;
    }
    if (skillRm.loading && skillRm.items.length === 0) {
      rootEl.appendChild(el("div", "empty", "Searching skills.sh…"));
      return;
    }
    if (skillRm.error) {
      rootEl.appendChild(el("div", "empty", "skills.sh error: " + skillRm.error));
      return;
    }
    if (skillRm.items.length === 0) {
      rootEl.appendChild(el("div", "empty", "No skills matched this query."));
      return;
    }
    skillRm.items.forEach(function (it) {
      var card = el("div", "skill-card catalog-card");
      var top = el("div", "card-top");
      top.appendChild(el("h3", null, it.name));
      top.appendChild(el("span", "badge", "skills.sh"));
      card.appendChild(top);
      card.appendChild(el("div", "meta", it.source + " \u00b7 " + String(it.installs) + " installs"));
      var row = el("div", "row");
      var bp = el("button", "btn primary", "Install (project)");
      bp.setAttribute("data-sh-proj", "1");
      bp.setAttribute("data-src", it.source);
      bp.setAttribute("data-sid", it.skillId);
      var bg = el("button", "btn", "Install (global)");
      bg.setAttribute("data-sh-glob", "1");
      bg.setAttribute("data-src", it.source);
      bg.setAttribute("data-sid", it.skillId);
      row.appendChild(bp);
      row.appendChild(bg);
      card.appendChild(row);
      rootEl.appendChild(card);
    });
  }

  document.querySelectorAll(".page-btn").forEach(function (el) {
    el.addEventListener("click", function () {
      page = el.getAttribute("data-page");
      document.querySelectorAll(".page-btn").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-page") === page);
      });
      updateChrome();
      var qq = qTrim();
      if (page === "mcp" && sub === "browse" && qq) scheduleRegistry(false);
      if (page === "skills" && sub === "browse" && qq) scheduleSkillRemote();
      render();
    });
  });
  document.querySelectorAll(".sub-btn").forEach(function (el) {
    el.addEventListener("click", function () {
      sub = el.getAttribute("data-sub");
      document.querySelectorAll(".sub-btn").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-sub") === sub);
      });
      updateChrome();
      var qq = qTrim();
      if (page === "mcp" && sub === "browse" && qq) scheduleRegistry(false);
      if (page === "skills" && sub === "browse" && qq) scheduleSkillRemote();
      render();
    });
  });
  var qInput = $("#q");
  if (qInput) {
    qInput.addEventListener("input", function () {
      if (page === "workspace") {
        filterWorkspaceTools();
        return;
      }
      if (page === "mcp" && sub === "browse") {
        scheduleRegistry(false);
        return;
      }
      if (page === "skills" && sub === "browse") {
        scheduleSkillRemote();
        return;
      }
      render();
    });
  }

  var scrollEl = document.getElementById("scroll");
  if (scrollEl) {
    scrollEl.addEventListener("click", function (e) {
    var ir = e.target.closest("button[data-reg-idx]");
    if (ir) {
      var i = parseInt(ir.getAttribute("data-reg-idx"), 10);
      var ent = reg.servers[i];
      if (ent) vscode.postMessage({ type: "installMcpRegistry", entry: ent });
      return;
    }
    var sp = e.target.closest("button[data-sh-proj]");
    if (sp) {
      vscode.postMessage({
        type: "installSkillSh",
        source: sp.getAttribute("data-src") || "",
        skillId: sp.getAttribute("data-sid") || "",
        global: false
      });
      return;
    }
    var sg = e.target.closest("button[data-sh-glob]");
    if (sg) {
      vscode.postMessage({
        type: "installSkillSh",
        source: sg.getAttribute("data-src") || "",
        skillId: sg.getAttribute("data-sid") || "",
        global: true
      });
    }
  });
  }

  document.body.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-cmd]");
    if (!btn) return;
    var cmd = btn.getAttribute("data-cmd");
    if (cmd === "dummy-refresh") {
      vscode.postMessage({ type: "refresh" });
      return;
    }
    vscode.postMessage({ type: "runCommand", command: cmd });
  });

  (function wireIntelAutoScan() {
    var cb = $("#intel-auto-scan-cb");
    if (cb) {
      cb.addEventListener("change", function () {
        vscode.postMessage({ type: "setAutoScanMcpSkillsOnWorkspaceOpen", value: cb.checked });
      });
    }
    var sn = $("#intel-scan-now");
    if (sn) {
      sn.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: "CloudeCodeToolBox.showMcpSkillsAwareness" });
      });
    }
    var ocs = $("#one-click-setup-settings");
    if (ocs) {
      ocs.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: "CloudeCodeToolBox.openOneClickSetupSettings" });
      });
    }
    var ocr = $("#one-click-setup-run");
    if (ocr) {
      ocr.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: "CloudeCodeToolBox.runOneClickSetup" });
      });
    }
    var tm = $("#thinking-machine-mode-cb");
    if (tm) {
      tm.addEventListener("change", function () {
        vscode.postMessage({ type: "setThinkingMachineModeEnabled", value: tm.checked });
      });
    }
    var tms = $("#thinking-machine-settings");
    if (tms) {
      tms.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: "CloudeCodeToolBox.openThinkingMachineModeSettings" });
      });
    }
  })();

  function isTrustedHubPostMessageOrigin(origin) {
    try {
      if (origin === window.location.origin) return true;
    } catch (e) {}
    if (origin === "http://cloude.toolbox") return true;
    if (typeof origin === "string" && origin.indexOf("vscode-webview://") === 0) return true;
    return false;
  }

  window.addEventListener("message", function (e) {
    if (!isTrustedHubPostMessageOrigin(e.origin)) return;
    if (!e.data) return;
    if (e.data.type === "state") {
      state = e.data.payload;
      /* Seed dashboard snapshot from full state if we haven't received a push yet. */
      if (state && Array.isArray(state.sessionCards) && state.sessionCards.length) {
        adCards = state.sessionCards;
      }
      render();
      return;
    }
    if (e.data.type === "registrySearchResult") {
      if (e.data.generation !== reg.generation) return;
      reg.loading = false;
      if (e.data.error) {
        reg.error = e.data.error;
        if (!e.data.append) reg.servers = [];
      } else {
        reg.error = null;
        var list = e.data.servers || [];
        if (e.data.append) reg.servers = reg.servers.concat(list);
        else reg.servers = list;
        reg.nextCursor = e.data.nextCursor || null;
      }
      render();
      return;
    }
    if (e.data.type === "skillSearchResult") {
      if (e.data.generation !== skillRm.generation) return;
      skillRm.loading = false;
      if (e.data.error) {
        skillRm.error = e.data.error;
        skillRm.items = [];
      } else {
        skillRm.error = null;
        skillRm.items = e.data.items || [];
      }
      render();
      return;
    }
    if (e.data.type === "agentTeams.runStarted") {
      atRuns[e.data.runId] = atRuns[e.data.runId] || atNewRunState(e.data);
      if (page === "agentteams") render();
      return;
    }
    if (e.data.type === "agentTeams.runEvent") {
      atIngestEvent(e.data.runId, e.data.event);
      if (page === "agentteams") render();
      return;
    }
    if (e.data.type === "agentTeams.phaseBoundary") {
      var r = atRuns[e.data.runId];
      if (r) {
        r.awaitingApproval = true;
        r.planPath = e.data.planPath || null;
      }
      if (page === "agentteams") render();
      return;
    }
    if (e.data.type === "agentTeams.runEnded") {
      var r2 = atRuns[e.data.runId];
      if (r2) { r2.status = e.data.status; r2.awaitingApproval = false; r2.ended = true; }
      if (page === "agentteams") render();
      return;
    }
    if (e.data.type === "agentDashboard.update") {
      adCards = Array.isArray(e.data.cards) ? e.data.cards : [];
      adGeneratedAt = e.data.generatedAt || null;
      if (page === "agentteams") render();
      return;
    }
    if (e.data.type === "agentTeams.commandBody") {
      if (atEdit.mode === "command-edit" && atEdit.commandFilePath === e.data.filePath) {
        atEdit.commandBody = e.data.body || "";
        atEdit.commandAgents = e.data.agents || [];
        if (page === "agentteams") render();
      }
      return;
    }
  });

  function filterText(items, getStr) {
    var q = norm(qTrim());
    if (!q) return items;
    return items.filter(function (it) { return norm(getStr(it)).indexOf(q) !== -1; });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function filterWorkspaceTools() {
    var q = norm(qTrim());
    document.querySelectorAll(".tile").forEach(function (tile) {
      var hay = norm(tile.getAttribute("data-filter") || "");
      tile.style.display = !q || hay.indexOf(q) !== -1 ? "flex" : "none";
    });
    document.querySelectorAll("details.tool-block").forEach(function (d) {
      var any = false;
      d.querySelectorAll(".tile").forEach(function (t) {
        if (t.style.display !== "none") any = true;
      });
      d.style.display = any ? "" : "none";
    });
  }

  function renderKitRow(row) {
    var card = el("div", "kit-card");
    var inner = el("div", "kit-inner");
    var dot = el("div", "status " + (row.present ? "ok" : "miss"));
    inner.appendChild(dot);
    var body = el("div", "kit-body");
    body.appendChild(el("div", "t", row.label));
    if (row.displayPath) body.appendChild(el("div", "p", row.displayPath));
    inner.appendChild(body);
    card.appendChild(inner);
    var rowBtns = el("div", "row");
    if (row.isWizard) {
      var w = el("button", "btn primary", "One Click Setup");
      w.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: "CloudeCodeToolBox.runOneClickSetup" });
      });
      rowBtns.appendChild(w);
    } else if (row.present && row.openUri) {
      var op = el("button", "btn primary", "Open");
      op.addEventListener("click", function () {
        vscode.postMessage({
          type: "runCommandWithArgs",
          command: "CloudeCodeToolBox.openKitTarget",
          args: [row.openUri, !!row.isDirectory]
        });
      });
      rowBtns.appendChild(op);
    } else if (!row.present && row.runCommand) {
      var fix = el("button", "btn primary", "Create / sync");
      fix.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: row.runCommand });
      });
      rowBtns.appendChild(fix);
    }
    card.appendChild(rowBtns);
    return card;
  }

  function mcpCard(s) {
    var card = el("div", s.disabled ? "mcp-card mcp-card--disabled" : "mcp-card");
    var top = el("div", "card-top");
    top.appendChild(el("h3", null, s.id));
    top.appendChild(el("span", "badge", s.disabled ? "Off" : s.kind));
    card.appendChild(top);
    card.appendChild(el("div", "meta", (s.scope === "workspace" ? "Workspace" : "User") + (s.disabled ? " — not in mcp.json (Toolbox stash)" : "")));
    card.appendChild(el("div", "desc", s.detail));
    var row = el("div", "row");
    var toggle = el("button", "btn primary", s.disabled ? "Turn ON" : "Turn OFF");
    toggle.addEventListener("click", function () {
      vscode.postMessage({ type: "mcpToggleServer", scope: s.scope, id: s.id, enable: !!s.disabled });
    });
    var del = el("button", "btn", "Remove");
    del.addEventListener("click", function () {
      vscode.postMessage({ type: "mcpDeleteServer", scope: s.scope, id: s.id });
    });
    var ed = el("button", "btn", "Edit mcp.json");
    ed.addEventListener("click", function () {
      var cmd = s.scope === "workspace" ? "workbench.mcp.openWorkspaceFolderMcpJson" : "workbench.mcp.openUserMcpJson";
      vscode.postMessage({ type: "runCommand", command: cmd });
    });
    row.appendChild(toggle);
    row.appendChild(del);
    row.appendChild(ed);
    card.appendChild(row);
    return card;
  }

  function skillCard(s) {
    var card = el("div", s.disabled ? "skill-card skill-card--disabled" : "skill-card");
    var top = el("div", "card-top");
    top.appendChild(el("h3", null, s.name));
    top.appendChild(el("span", "badge", s.disabled ? "Off" : s.scope === "workspace" ? "Workspace" : "User"));
    card.appendChild(top);
    card.appendChild(
      el(
        "div",
        "meta",
        s.rootPath + (s.disabled ? " — hidden in hub (Toolbox); still on disk" : "")
      )
    );
    card.appendChild(el("div", "desc", s.description));
    var row = el("div", "row");
    var toggle = el("button", "btn primary", s.disabled ? "Turn ON" : "Turn OFF");
    toggle.addEventListener("click", function () {
      vscode.postMessage({
        type: "skillToggleHub",
        skillId: s.id,
        scope: s.scope,
        enable: !!s.disabled
      });
    });
    var delSk = el("button", "btn", "Delete…");
    delSk.addEventListener("click", function () {
      vscode.postMessage({ type: "deleteSkillFolder", fsPath: s.rootPath, scope: s.scope });
    });
    var o = el("button", "btn", "Open SKILL.md");
    o.addEventListener("click", function () {
      vscode.postMessage({ type: "openFile", fsPath: s.skillMdPath });
    });
    var r = el("button", "btn", "Reveal folder");
    r.addEventListener("click", function () {
      vscode.postMessage({ type: "revealPath", fsPath: s.rootPath });
    });
    row.appendChild(toggle);
    row.appendChild(delSk);
    row.appendChild(o);
    row.appendChild(r);
    card.appendChild(row);
    return card;
  }

  function callout(title, body, cmd, btnLabel) {
    var c = el("div", "callout");
    c.appendChild(el("h4", null, title));
    c.appendChild(el("p", null, body));
    var b = el("button", "btn primary", btnLabel);
    b.addEventListener("click", function () {
      vscode.postMessage({ type: "runCommand", command: cmd });
    });
    c.appendChild(b);
    return c;
  }

  function renderContextHygiene() {
    var hy = state && state.hygiene;
    $("#root").appendChild(el("div", "section-title", "Context hygiene"));
    if (hy) {
      var snap = el("div", "callout");
      snap.appendChild(el("h4", null, "Snapshot"));
      var line1 =
        "Workspace MCP servers: " +
        hy.workspaceMcpServerCount +
        ". User MCP servers: " +
        hy.userMcpServerCount +
        ". CLAUDE.md: " +
        (hy.claudeMdMissing ? "missing." : hy.claudeMdLines + " line(s).");
      snap.appendChild(el("p", null, line1));
      snap.appendChild(
        el(
          "p",
          null,
          "These counts come from local config files only — not chat token usage or live MCP runtime state."
        )
      );
      $("#root").appendChild(snap);
    }

    if (!hy) {
      return;
    }

    var grid = el("div", "hygiene-actions");
    var actions = [
      {
        ic: "\\uD83D\\uDD0D",
        t: "Scan Claude Code / MCP files",
        p: "Heuristic secret-shaped patterns in mcp.json + instructions",
        c: "CloudeCodeToolBox.claudeToolboxConfigScan"
      },
      {
        ic: "\\uD83D\\uDCD3",
        t: "Notepad \\u2192 memory-bank",
        p: "Append session notepad to a memory-bank .md file",
        c: "CloudeCodeToolBox.appendNotepadToMemoryBank"
      },
      { ic: "\\u2728", t: "New SKILL.md stub", p: ".github/skills/<name>/", c: "CloudeCodeToolBox.createSkillStub" },
      {
        ic: "\\u2705",
        t: "Verification checklist",
        p: "Multi-pick acknowledgement before you ship",
        c: "CloudeCodeToolBox.verificationChecklist"
      },
      {
        ic: "\\uD83E\\uDDE9",
        t: "Bundled MCP recipe",
        p: "Merge a sample server into .vscode/mcp.json",
        c: "CloudeCodeToolBox.applyBundledMcpRecipe"
      },
      {
        ic: "\\u25B6",
        t: "Run first test task",
        p: "From tasks.json (name heuristics)",
        c: "CloudeCodeToolBox.runFirstWorkspaceTestTask"
      }
    ];
    actions.forEach(function (a) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hygiene-tile";
      btn.appendChild(el("span", "hic", a.ic));
      var body = el("span", "htext");
      body.appendChild(el("span", "htt", a.t));
      body.appendChild(el("span", "htp", a.p));
      btn.appendChild(body);
      btn.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: a.c });
      });
      grid.appendChild(btn);
    });
    $("#root").appendChild(grid);
  }

  function renderIntel() {
    renderContextHygiene();
    $("#root").appendChild(el("div", "section-title", "Cursor \\u2192 VS Code & Claude Code"));

    var ij = state && state.hubHost === "intellij";
    var bridges = [
      {
        ic: "\\uD83D\\uDD0C",
        t: "Port Cursor MCP",
        p: ij
          ? "Map Cursor ~/.cursor/mcp.json into VS Code-style mcp.json (bundled CLI + node)."
          : "Map Cursor ~/.cursor/mcp.json into VS Code mcp.json. Primary: npx from the registry. Alternative: CLI bundled with the extension (offline).",
        c: "CloudeCodeToolBox.portCursorMcp",
        b: "Run MCP port",
        manualCmd: "CloudeCodeToolBox.manualPortCursorMcpWithoutNpx",
        manualLabel: "Bundled CLI",
        hideSecondOnIj: true,
      },
      {
        ic: "\\uD83E\\uDDE0",
        t: "Memory bank (cloude-code-memory-bank)",
        p: ij
          ? "Scaffold memory-bank/ and merge into CLAUDE.md (bundled CLI + node)."
          : "Scaffold memory-bank/ and merge into CLAUDE.md. Primary: npx. Alternative: bundled CLI.",
        c: "CloudeCodeToolBox.initMemoryBank",
        b: "Run memory bank init",
        manualCmd: "CloudeCodeToolBox.memoryBankWithoutNpx",
        manualLabel: "Bundled CLI",
        hideSecondOnIj: true,
      },
      {
        ic: "\\uD83D\\uDD04",
        t: "Cursor rules to CLAUDE.md",
        p: ij
          ? "Convert .cursor/rules into CLAUDE.md / .claude/rules (bundled CLI + node)."
          : "Convert .cursor/rules into CLAUDE.md / .claude/rules. Primary: npx. Alternative: bundled CLI.",
        c: "CloudeCodeToolBox.syncCursorRules",
        b: "Run rules converter",
        manualCmd: "CloudeCodeToolBox.cursorRulesToClaudeWithoutNpx",
        manualLabel: "Bundled CLI",
        hideSecondOnIj: true,
      },
      {
        ic: "\\uD83D\\uDCE5",
        t: "Migrate skills to .agents",
        p: "Copy or move SKILL.md skill folders from .cursor/skills to .agents/skills (workspace and/or home). Editor-side layout only.",
        c: "CloudeCodeToolBox.migrateSkillsCursorToAgents",
        b: "Run migration",
        manualCmd: "CloudeCodeToolBox.revealSkillFoldersWithoutNpx",
        manualLabel: "Open folders",
        hideSecondOnIj: false,
      },
    ];
    bridges.forEach(function (h0) {
      var h = el("div", "hero");
      h.appendChild(el("div", "ic", h0.ic));
      h.appendChild(el("h3", null, h0.t));
      h.appendChild(el("p", null, h0.p));
      var row = el("div", "row");
      var b1 = el("button", "btn primary", h0.b);
      b1.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: h0.c });
      });
      row.appendChild(b1);
      var showSecond = h0.manualCmd && !(ij && h0.hideSecondOnIj);
      if (showSecond) {
        var b3 = el("button", "btn", h0.manualLabel || "Second action");
        b3.addEventListener("click", function () {
          vscode.postMessage({ type: "runCommand", command: h0.manualCmd });
        });
        row.appendChild(b3);
      }
      h.appendChild(row);
      $("#root").appendChild(h);
    });

    $("#root").appendChild(el("div", "section-title", "GitHub Copilot \\u2192 Claude Code"));

    var copilotBridges = [
      {
        ic: "\\uD83D\\uDCDC",
        t: "Copilot instructions \\u2192 CLAUDE.md",
        p: "Merge .github/copilot-instructions.md into root CLAUDE.md (replaceable toolbox block). Extension command only (no npx).",
        c: "CloudeCodeToolBox.mergeCopilotInstructionsIntoClaudeMd",
        b: "Merge to CLAUDE.md"
      },
      {
        ic: "\\uD83D\\uDCE5",
        t: "Copilot / GitHub skills \\u2192 .agents",
        p: "SKILL.md folders from workspace .github/skills and/or user ~/.copilot/skills into .agents/skills (copy or move).",
        c: "CloudeCodeToolBox.migrateCopilotSkillsToAgents",
        b: "Run migration",
        manualCmd: "CloudeCodeToolBox.revealCopilotSkillFoldersWithoutNpx",
        manualLabel: "Reveal folders"
      },
      {
        ic: "\\uD83D\\uDD0C",
        t: "MCP: VS Code vs Claude session",
        p: "VS Code uses User or workspace mcp.json. Claude Code uses /mcp in the panel and may read ~/.claude/settings.json \\u2014 configure both if you use MCP in each.",
        c: "CloudeCodeToolBox.openUserMcp",
        b: "Open user mcp.json",
        manualCmd: "CloudeCodeToolBox.openClaudeUserSettingsJson",
        manualLabel: "Open Claude settings"
      }
    ];
    copilotBridges.forEach(function (h0) {
      var h = el("div", "hero");
      h.appendChild(el("div", "ic", h0.ic));
      h.appendChild(el("h3", null, h0.t));
      h.appendChild(el("p", null, h0.p));
      var row = el("div", "row");
      var b1 = el("button", "btn primary", h0.b);
      b1.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: h0.c });
      });
      row.appendChild(b1);
      if (h0.manualCmd) {
        var b3 = el("button", "btn", h0.manualLabel || "Second action");
        b3.addEventListener("click", function () {
          vscode.postMessage({ type: "runCommand", command: h0.manualCmd });
        });
        row.appendChild(b3);
      }
      h.appendChild(row);
      $("#root").appendChild(h);
    });

    $("#root").appendChild(el("div", "section-title", "Context & readiness"));

    var heroes = [
      { ic: "\\uD83D\\uDE80", t: "Prime session", p: "Optional MCP & Skills scan, then context pack to clipboard (enable Thinking Machine Mode in settings first).", c: "CloudeCodeToolBox.runThinkingMachinePriming", b: "Prime" },
      { ic: "\\uD83D\\uDD0D", t: "Scan MCP & Skills awareness", p: "Writes .claude/cloude-code-toolbox-mcp-skills-awareness.md and refreshes the MCP/skills block in CLAUDE.md. No tab unless you choose Open report on the toast.", c: "CloudeCodeToolBox.showMcpSkillsAwareness", b: "Run scan" },
      { ic: "\\uD83D\\uDCE6", t: "Context pack for Chat", p: "Gathers workspace signals you choose (files, git, diagnostics) and copies a pack for Claude Code.", c: "CloudeCodeToolBox.buildContextPack", b: "Build pack" },
      { ic: "\\uD83D\\uDEE1", t: "Readiness summary", p: "Markdown checklist: instructions, rules, MCP, and suggested next commands.", c: "CloudeCodeToolBox.showIntelligenceReadiness", b: "Run readiness" },
      { ic: "\\uD83D\\uDCDD", t: "Context pack defaults", p: "Pre-select git, diagnostics, notepad, and open Chat after the interactive pack flow.", c: "CloudeCodeToolBox.openIntelligenceSettings", b: "Open settings" }
    ];
    heroes.forEach(function (h0) {
      var h = el("div", "hero");
      h.appendChild(el("div", "ic", h0.ic));
      h.appendChild(el("h3", null, h0.t));
      h.appendChild(el("p", null, h0.p));
      var btn = el("button", "btn primary", h0.b);
      btn.addEventListener("click", function () {
        vscode.postMessage({ type: "runCommand", command: h0.c });
      });
      h.appendChild(btn);
      $("#root").appendChild(h);
    });

    $("#root").appendChild(el("div", "empty", "Tip: run Thinking Machine Mode actions from the Command Palette anytime — they live here for quick access."));
  }

  function renderWorkspace() {
    $("#root").appendChild(el("div", "section-title", "Workspace checklist"));
    var kit = (state && state.kit) || [];
    if (!kit.length) {
      $("#root").appendChild(el("div", "empty", "No kit data."));
    } else {
      kit.forEach(function (row) {
        $("#root").appendChild(renderKitRow(row));
      });
    }
    $("#root").appendChild(el("div", "section-title", "All toolbox commands"));
    $("#root").appendChild(el("div", "empty", "Use the search box above to filter. Open a section to run an action."));
    TOOL_GROUPS.forEach(function (g) {
      var det = document.createElement("details");
      det.className = "tool-block";
      det.open = true;
      var sum = document.createElement("summary");
      sum.textContent = g.title;
      det.appendChild(sum);
      var grid = el("div", "tile-grid");
      g.items.forEach(function (it) {
        var tile = document.createElement("button");
        tile.type = "button";
        tile.className = "tile";
        tile.setAttribute("data-cmd", it.c);
        tile.setAttribute("data-filter", norm(it.t + " " + it.d + " " + g.title));
        var ic = el("span", "ic", it.ic);
        var body = el("div", "body");
        body.appendChild(el("div", "t", it.t));
        body.appendChild(el("div", "d", it.d));
        tile.appendChild(ic);
        tile.appendChild(body);
        grid.appendChild(tile);
      });
      det.appendChild(grid);
      $("#root").appendChild(det);
    });
    filterWorkspaceTools();
  }

  /* ======================== Agent Teams page ======================== */

  var atEdit = {
    mode: "none",     /* "none" | "agent-new" | "agent-edit" | "team-new" | "team-edit" | "command-new" | "command-edit" */
    agentId: null,
    teamId: null,
    commandFilePath: null,
    commandBody: null,
    commandAgents: null
  };
  /** runId -> { events: [], agents: Map, totals: {inTok, outTok, usd}, status, phase, ... } */
  var atRuns = {};
  /** Dashboard — latest cards snapshot (array). Populated by agentDashboard.update messages. */
  var adCards = [];
  var adGeneratedAt = null;
  /** Dashboard filter text (persists across renders while the tab is open). */
  var adFilter = "";
  /** Swim-lane grouping mode: "workspace" (default) | "flat". */
  var adGrouping = "workspace";
  /** runId of the currently-focused run in the UI (last one the user clicked). */
  var atFocusedRunId = null;
  /** { runId, planPath, editedPlan } when an approval modal is open, otherwise null. */
  var atApprovalModal = null;
  /** { teamId, prompt } inline run-prompt card; null when not shown. */
  var atRunPromptFor = null;

  function atNewRunState(seed) {
    return {
      runId: seed.runId,
      teamId: seed.teamId,
      teamName: seed.teamName,
      protocol: seed.protocol || "",
      runtime: seed.runtime || "native",
      events: [],
      totals: { inTok: 0, outTok: 0, usd: 0 },
      status: "running",
      phase: "none",
      awaitingApproval: false,
      ended: false,
      planPath: null,
      planArtifactPath: null,
      startedAt: Date.now()
    };
  }

  function atIngestEvent(runId, ev) {
    if (!runId || !ev) return;
    var r = atRuns[runId];
    if (!r) {
      r = atNewRunState({ runId: runId, teamId: "", teamName: ev.teamName || "", protocol: ev.protocol || "", runtime: ev.runtime || "native" });
      atRuns[runId] = r;
    }
    if (!atFocusedRunId) atFocusedRunId = runId;
    if (r.events.length < 2000) r.events.push(ev);
    if (ev.kind === "run_start") {
      r.protocol = ev.protocol || r.protocol;
      r.runtime = ev.runtime || r.runtime;
      r.teamName = ev.teamName || r.teamName;
    } else if (ev.kind === "phase_boundary") {
      r.phase = ev.to || r.phase;
      if (ev.needsApproval) {
        r.awaitingApproval = true;
        r.planPath = ev.planPath || r.planPath;
      }
    } else if (ev.kind === "usage" && ev.usage) {
      r.totals.inTok += (ev.usage.inputTokens || 0);
      r.totals.outTok += (ev.usage.outputTokens || 0);
      r.totals.usd += (ev.usage.costUsd || 0);
    } else if (ev.kind === "plan_artifact") {
      r.planArtifactPath = ev.path;
      r.planPath = ev.path;
    } else if (ev.kind === "run_end") {
      r.ended = true;
      r.status = ev.status || "completed";
      r.awaitingApproval = false;
    } else if (ev.kind === "error") {
      r.hadError = true;
    }
  }

  function atFmtUsd(n) {
    if (!isFinite(n) || !n) return "$0.00";
    if (n < 0.01) return "$" + n.toFixed(4);
    return "$" + n.toFixed(2);
  }
  function atFmtTokens(n) {
    if (!n) return "0";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  }

  function atEventText(ev) {
    if (ev.kind === "assistant_delta") return ev.text || "";
    if (ev.kind === "assistant_message") return ev.text || "";
    if (ev.kind === "message") return (ev.text || "");
    if (ev.kind === "tool_use") return (ev.tool || "Tool") + (ev.input ? "(" + atTruncate(JSON.stringify(ev.input), 160) + ")" : "");
    if (ev.kind === "tool_result") return (ev.ok ? "✓ " : "✗ ") + (ev.summary || "");
    if (ev.kind === "phase_boundary") return "→ phase " + ev.to + (ev.needsApproval ? " (awaiting approval)" : "");
    if (ev.kind === "plan_artifact") return "📄 " + ev.path;
    if (ev.kind === "error") return "error: " + ev.message;
    if (ev.kind === "log") return ev.message;
    if (ev.kind === "agent_start") return "▶ turn " + ev.turn + " (" + ev.phase + ")";
    if (ev.kind === "agent_end") return "■ end turn " + ev.turn + " (" + ev.status + ", " + ev.durationMs + "ms)";
    if (ev.kind === "run_start") return "▶ run started";
    if (ev.kind === "run_end") return "■ run " + ev.status;
    return "";
  }
  function atTruncate(s, n) {
    if (!s) return "";
    if (s.length <= n) return s;
    return s.slice(0, n) + "…";
  }
  function atAgentColorFromEvents(r, agentName) {
    if (!agentName) return "var(--muted)";
    for (var i = r.events.length - 1; i >= 0; i--) {
      var ev = r.events[i];
      if (ev.kind === "agent_start" && ev.agent === agentName && ev.color) return ev.color;
    }
    var s = state || {};
    var list = s.agents || [];
    for (var j = 0; j < list.length; j++) {
      if (list[j].name === agentName) return list[j].color || "var(--muted)";
    }
    return "var(--muted)";
  }

  function renderRunPanel(root, r) {
    var panel = el("div", "at-run-panel");
    var head = el("div", "at-run-head");
    var dot = document.createElement("span");
    dot.className = "at-run-status-dot " + (r.status || "running");
    head.appendChild(dot);
    head.appendChild(el("h3", null, r.teamName || r.runId));
    var protoPill = el("span", "at-pill runtime-" + (r.runtime || "native"), r.runtime || "native");
    head.appendChild(protoPill);
    head.appendChild(el("span", "at-pill", r.protocol || ""));
    var phasePill = el("span", "at-run-phase-pill phase-" + (r.phase || "none"), "phase: " + (r.phase || "none"));
    head.appendChild(phasePill);
    head.appendChild(el("span", "at-run-meta", "run id: " + r.runId));
    var actions = el("div", "at-run-actions");
    if (r.awaitingApproval) {
      var bApprove = el("button", "btn primary", "Approve plan");
      bApprove.addEventListener("click", function () {
        atApprovalModal = { runId: r.runId, planPath: r.planPath, editedPlan: null };
        render();
      });
      actions.appendChild(bApprove);
    }
    if (!r.ended) {
      var bStop = el("button", "btn", "Stop");
      bStop.addEventListener("click", function () {
        vscode.postMessage({ type: "agentTeams.stopRun", runId: r.runId });
      });
      actions.appendChild(bStop);
    }
    if (r.planArtifactPath) {
      var bPlan = el("button", "btn", "Open plan.md");
      bPlan.addEventListener("click", function () {
        vscode.postMessage({ type: "agentTeams.openAgentFile", fsPath: r.planArtifactPath });
      });
      actions.appendChild(bPlan);
    }
    var bOpenRun = el("button", "btn", "Open transcript");
    bOpenRun.addEventListener("click", function () {
      vscode.postMessage({ type: "agentTeams.openRun", runId: r.runId });
    });
    actions.appendChild(bOpenRun);
    head.appendChild(actions);
    panel.appendChild(head);

    /* Transcript (virtualized tail: last 300 events). */
    var trans = el("div", "at-transcript");
    var events = r.events || [];
    var tail = events.slice(Math.max(0, events.length - 300));
    var lastAgent = "";
    tail.forEach(function (ev) {
      var agentName = ev.agent || ev.from || "";
      var line = el("div", "at-line kind-" + (ev.kind || "log"));
      var color = atAgentColorFromEvents(r, agentName) || "var(--muted)";
      line.style.borderLeftColor = color;
      if ((ev.kind === "assistant_delta") && agentName === lastAgent) {
        /* Extend previous line text to avoid a wall of separate blocks. */
        var prev = trans.lastElementChild;
        if (prev && prev.classList.contains("kind-assistant_delta")) {
          var body = prev.querySelector(".at-line-body");
          if (body) {
            body.textContent = (body.textContent || "") + (ev.text || "");
            return;
          }
        }
      }
      lastAgent = agentName;
      var head2 = el("div", "at-line-head");
      if (agentName) head2.appendChild(el("span", "at-line-agent", agentName));
      if (ev.kind === "message" && ev.to) head2.appendChild(el("span", "at-line-agent", "→ " + ev.to));
      head2.appendChild(el("span", "at-line-kind", ev.kind || ""));
      line.appendChild(head2);
      var body2 = el("div", "at-line-body", atEventText(ev));
      line.appendChild(body2);
      trans.appendChild(line);
    });
    /* Auto-scroll to latest */
    setTimeout(function () { trans.scrollTop = trans.scrollHeight; }, 0);
    panel.appendChild(trans);

    var totals = el("div", "at-totals");
    var a1 = el("span", null, "");
    a1.appendChild(document.createTextNode("Tokens in: "));
    a1.appendChild(el("strong", null, atFmtTokens(r.totals.inTok)));
    var a2 = el("span", null, "");
    a2.appendChild(document.createTextNode("Tokens out: "));
    a2.appendChild(el("strong", null, atFmtTokens(r.totals.outTok)));
    var a3 = el("span", null, "");
    a3.appendChild(document.createTextNode("Cost: "));
    a3.appendChild(el("strong", null, atFmtUsd(r.totals.usd)));
    totals.appendChild(a1);
    totals.appendChild(a2);
    totals.appendChild(a3);
    panel.appendChild(totals);
    root.appendChild(panel);
  }

  function renderApprovalModal(root) {
    if (!atApprovalModal) return;
    var r = atRuns[atApprovalModal.runId];
    if (!r) { atApprovalModal = null; return; }
    var back = el("div", "at-modal-backdrop");
    back.addEventListener("click", function () { /* dismiss blocked */ });
    var modal = el("div", "at-modal");
    modal.appendChild(el("h3", null, "Approve plan — " + (r.teamName || r.runId)));
    var body = el("div", "at-modal-body");
    body.appendChild(
      el(
        "p",
        "at-empty-tip",
        "Review the plan below. You can edit it inline before approving; code-phase agents will receive the edited text."
      )
    );
    var ta = document.createElement("textarea");
    ta.spellcheck = false;
    /* Seed from last plan_artifact event's path if readable — fallback: synthesise from transcript. */
    var seed = "";
    for (var i = r.events.length - 1; i >= 0; i--) {
      var ev = r.events[i];
      if (ev.kind === "assistant_delta" || ev.kind === "assistant_message") {
        seed = (ev.text || "") + seed;
      } else if (ev.kind === "phase_boundary") {
        break;
      }
    }
    var planMatch = seed.match(new RegExp("<plan>([\\\\s\\\\S]*?)</plan>", "i"));
    ta.value = atApprovalModal.editedPlan != null
      ? atApprovalModal.editedPlan
      : (planMatch ? planMatch[1].trim() : seed.trim());
    ta.addEventListener("input", function () {
      atApprovalModal.editedPlan = ta.value;
    });
    body.appendChild(ta);
    if (r.planPath) {
      var openBtn = el("button", "btn", "Open plan.md in editor");
      openBtn.addEventListener("click", function () {
        vscode.postMessage({ type: "agentTeams.openAgentFile", fsPath: r.planPath });
      });
      body.appendChild(openBtn);
    }
    modal.appendChild(body);
    var actions = el("div", "at-modal-actions");
    var bReject = el("button", "btn", "Reject — stop run");
    bReject.addEventListener("click", function () {
      vscode.postMessage({ type: "agentTeams.rejectPlan", runId: r.runId, reason: "user rejected" });
      atApprovalModal = null;
      render();
    });
    var bApprove = el("button", "btn primary", "Approve — start code phase");
    bApprove.addEventListener("click", function () {
      vscode.postMessage({
        type: "agentTeams.approvePlan",
        runId: r.runId,
        editedPlan: atApprovalModal.editedPlan || null
      });
      atApprovalModal = null;
      render();
    });
    actions.appendChild(bReject);
    actions.appendChild(bApprove);
    modal.appendChild(actions);
    root.appendChild(back);
    root.appendChild(modal);
  }

  function renderRunPromptCard(root, s, teamId) {
    var t = findTeamById(s, teamId);
    if (!t) return;
    var card = el("div", "at-form");
    card.appendChild(el("h3", null, "Run team: " + t.name));
    card.appendChild(el("p", "at-empty-tip", "Protocol: " + t.protocol + "  •  Runtime: " + t.runtime + "  •  Agents: " + (t.agents || []).join(", ")));
    card.appendChild(el("label", null, "What should the team do?"));
    var ta = document.createElement("textarea");
    ta.className = "at-run-prompt";
    ta.placeholder = "Describe the task in plain English. Plan-then-code teams will produce a plan first.";
    card.appendChild(ta);
    var actions = el("div", "at-form-actions");
    var bRun = el("button", "btn primary", "Start run");
    bRun.addEventListener("click", function () {
      var prompt = (ta.value || "").trim();
      if (!prompt) { alert("Enter a prompt first."); return; }
      vscode.postMessage({ type: "agentTeams.runTeam", teamId: t.id, prompt: prompt });
      atRunPromptFor = null;
      render();
    });
    var bCancel = el("button", "btn", "Cancel");
    bCancel.addEventListener("click", function () { atRunPromptFor = null; render(); });
    actions.appendChild(bRun);
    actions.appendChild(bCancel);
    card.appendChild(actions);
    root.appendChild(card);
  }

  var AT_PROTOCOLS = [
    { id: "native-task", label: "Native Task (single session)", runtime: "native" },
    { id: "round-robin", label: "Round-robin", runtime: "native" },
    { id: "handoff", label: "Hand-off", runtime: "native" },
    { id: "plan-then-code", label: "Plan → Code (with approval)", runtime: "custom" },
    { id: "debate", label: "Debate + judge", runtime: "custom" },
    { id: "orchestrator", label: "Orchestrator-led", runtime: "custom" },
    { id: "parallel-fan-out", label: "Parallel fan-out", runtime: "custom" },
    { id: "converge", label: "Converge (parallel + cross-pollinate + synthesize)", runtime: "custom" }
  ];
  var AT_MODELS = [
    { id: "", label: "(inherit caller default)" },
    { id: "claude-opus-4-7", label: "Opus 4.7" },
    { id: "claude-sonnet-4-5", label: "Sonnet 4.5" },
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" }
  ];
  var AT_ROLES = [
    { id: "plan", label: "Plan" },
    { id: "code", label: "Code" },
    { id: "review", label: "Review" },
    { id: "both", label: "Both / Flexible" }
  ];
  var AT_TOOL_CHOICES = ["Read", "Edit", "Write", "Bash", "Grep", "Glob", "Task"];

  function atProtocolInfo(id) {
    for (var i = 0; i < AT_PROTOCOLS.length; i++) {
      if (AT_PROTOCOLS[i].id === id) return AT_PROTOCOLS[i];
    }
    return AT_PROTOCOLS[0];
  }

  function renderAgentTeams() {
    var root = $("#root");
    var s = state || {};
    var st = s.agentTeamsEnableStatus || {};
    var needsEnable = !st.agentsDirExists || (s.agents || []).length === 0;

    if (needsEnable && atEdit.mode === "none") {
      renderAgentTeamsHero(root, st, s.starterPack || []);
      renderAgentDashboard(root, s);
      return;
    }

    /* Summary strip */
    var summary = el("div", "at-summary-row");
    summary.appendChild(atSummaryItem("Agents", String((s.agents || []).length)));
    summary.appendChild(atSummaryItem("Teams", String((s.teams || []).length)));
    var foreignCmds = ((s.slashCommands || []).filter(function (c) { return !c.linkedTeam; }));
    if (foreignCmds.length) summary.appendChild(atSummaryItem("Commands", String(foreignCmds.length)));
    summary.appendChild(atSummaryItem("CLI", st.cliOk ? "ok" : "missing"));
    summary.appendChild(atSummaryItem("~/.claude/agents", st.agentsDirExists ? "exists" : "missing"));
    root.appendChild(summary);

    /* Agent Dashboard strip (cards for every running Claude session). */
    renderAgentDashboard(root, s);

    /* Approval modal overlay (in-tab, blocks input). */
    if (atApprovalModal) {
      renderApprovalModal(root);
    }

    if (atEdit.mode === "agent-new" || atEdit.mode === "agent-edit") {
      renderAgentForm(root, s);
      return;
    }
    if (atEdit.mode === "team-new" || atEdit.mode === "team-edit") {
      renderTeamForm(root, s);
      return;
    }
    if (atEdit.mode === "command-new" || atEdit.mode === "command-edit") {
      renderCommandForm(root, s);
      return;
    }

    /* Run-prompt card (shown when user clicks Run… on a team card). */
    if (atRunPromptFor) {
      renderRunPromptCard(root, s, atRunPromptFor);
    }

    /* Active runs — render one panel per run (most recent first). */
    var runIds = Object.keys(atRuns);
    runIds.sort(function (a, b) {
      return (atRuns[b] && atRuns[b].startedAt) - (atRuns[a] && atRuns[a].startedAt);
    });
    if (runIds.length) {
      root.appendChild(el("div", "at-section", "Runs"));
    }
    runIds.forEach(function (id) {
      renderRunPanel(root, atRuns[id]);
    });

    /* AGENTS */
    var agentsSection = el("div", "at-section");
    agentsSection.appendChild(el("span", null, "Agents (" + (s.agents || []).length + ")"));
    var agentsRight = el("div");
    var bPack = el("button", "btn", "Install starter pack");
    bPack.addEventListener("click", function () {
      atInstallStarterPackPrompt(s.starterPack || []);
    });
    var bNewA = el("button", "btn primary", "+ New agent");
    bNewA.style.marginLeft = "6px";
    bNewA.addEventListener("click", function () {
      atEdit.mode = "agent-new";
      atEdit.agentId = null;
      render();
    });
    agentsRight.appendChild(bPack);
    agentsRight.appendChild(bNewA);
    agentsSection.appendChild(agentsRight);
    root.appendChild(agentsSection);

    var agents = s.agents || [];
    if (!agents.length) {
      root.appendChild(el("div", "empty", "No agents yet. Create one or install the starter pack."));
    } else {
      agents.forEach(function (a) {
        root.appendChild(agentCard(a));
      });
    }

    /* TEAMS & SLASH COMMANDS (unified section) */
    var teams = s.teams || [];
    var cmds = s.slashCommands || [];
    var totalCount = teams.length + cmds.length;
    var teamsSection = el("div", "at-section");
    teamsSection.appendChild(el("span", null, "Teams & Commands (" + totalCount + ")"));
    var teamsRight = el("div");
    var bNewT = el("button", "btn primary", "+ New team");
    bNewT.addEventListener("click", function () {
      atEdit.mode = "team-new";
      atEdit.teamId = null;
      render();
    });
    teamsRight.appendChild(bNewT);
    var bNewCmd = el("button", "btn primary", "+ New command");
    bNewCmd.style.marginLeft = "6px";
    bNewCmd.addEventListener("click", function () {
      atEdit.mode = "command-new";
      atEdit.commandFilePath = null;
      atEdit.commandBody = null;
      atEdit.commandAgents = null;
      render();
    });
    teamsRight.appendChild(bNewCmd);
    var bTeamPack = el("button", "btn", "Install starter pack");
    bTeamPack.style.marginLeft = "6px";
    bTeamPack.title = "Install SDLC teams (debate, plan, review, security, etc.) with swarm slash commands";
    bTeamPack.addEventListener("click", function () {
      atInstallStarterPackPrompt(s.starterPack || []);
    });
    teamsRight.appendChild(bTeamPack);
    teamsSection.appendChild(teamsRight);
    root.appendChild(teamsSection);

    var linkedCmdPaths = {};
    if (!teams.length && !cmds.length) {
      root.appendChild(el("div", "empty", "No teams or commands yet. Create a team or slash command, or install the starter pack."));
    }
    teams.forEach(function (t) {
      var linkedCmd = findLinkedCommand(cmds, t.name);
      if (linkedCmd) linkedCmdPaths[linkedCmd.filePath] = true;
      root.appendChild(teamCard(t, linkedCmd));
    });
    var standaloneCmds = cmds.filter(function (c) { return !linkedCmdPaths[c.filePath]; });
    standaloneCmds.forEach(function (c) {
      root.appendChild(standaloneCmdCard(c));
    });
  }

  function standaloneCmdCard(c) {
    var card = el("div", "at-card");
    card.style.borderLeftColor = c.ownedByToolbox
      ? "var(--vscode-charts-orange, #f97316)"
      : "var(--vscode-charts-blue, #3b82f6)";
    var top = el("div", "card-top");
    var left = el("div");
    left.appendChild(el("h3", null, "/" + c.id));
    var typePill = el("span", "at-pill", "command");
    left.appendChild(typePill);
    top.appendChild(left);
    top.appendChild(el("span", "badge", c.ownedByToolbox ? "Toolbox" : c.scope === "workspace" ? "Workspace" : "User"));
    card.appendChild(top);
    if (c.description) {
      card.appendChild(el("div", "at-desc", c.description));
    }
    if (c.argumentHint) {
      card.appendChild(el("div", "at-meta", "usage: /" + c.id + " " + c.argumentHint));
    }
    card.appendChild(el("div", "at-meta", c.scope + "  ·  " + c.filePath));
    var row = el("div", "row");
    var bEdit = el("button", "btn primary", "Edit");
    bEdit.addEventListener("click", function () {
      atEdit.mode = "command-edit";
      atEdit.commandFilePath = c.filePath;
      atEdit.commandBody = null;
      atEdit.commandAgents = null;
      vscode.postMessage({ type: "agentTeams.readCommandBody", filePath: c.filePath });
    });
    var bOpen = el("button", "btn", "Open file");
    bOpen.addEventListener("click", function () {
      vscode.postMessage({ type: "agentTeams.openAgentFile", fsPath: c.filePath });
    });
    var bDel = el("button", "btn", "Delete");
    bDel.addEventListener("click", function () {
      vscode.postMessage({ type: "agentTeams.deleteCommand", filePath: c.filePath });
    });
    row.appendChild(bEdit);
    row.appendChild(bOpen);
    row.appendChild(bDel);
    card.appendChild(row);
    return card;
  }

  function atSummaryItem(k, v) {
    var w = el("div", "at-summary-item");
    w.appendChild(el("div", "k", k));
    w.appendChild(el("div", "v", v));
    return w;
  }

  function renderAgentTeamsHero(root, status, pack) {
    var hero = el("div", "at-hero");
    hero.appendChild(el("h3", null, "Enable Claude Agent Teams"));
    hero.appendChild(
      el(
        "p",
        null,
        "Claude Code subagents live as YAML-frontmatter .md files under ~/.claude/agents/. This will create that folder and (optionally) install the SDLC starter pack."
      )
    );
    var statusEl = el("div", "at-status");
    var cliSpan = document.createElement("span");
    cliSpan.className = status.cliOk ? "ok" : "warn";
    cliSpan.textContent = "claude CLI: " + (status.cliOk ? "OK" : "not found");
    var dirSpan = document.createElement("span");
    dirSpan.className = status.agentsDirExists ? "ok" : "warn";
    dirSpan.textContent = (status.agentsDirPath || "~/.claude/agents") + " — " + (status.agentsDirExists ? "exists" : "missing");
    statusEl.appendChild(cliSpan);
    statusEl.appendChild(document.createTextNode("  •  "));
    statusEl.appendChild(dirSpan);
    hero.appendChild(statusEl);

    /* Starter pack checkboxes */
    var packWrap = el("div", "at-pack");
    packWrap.appendChild(el("div", "at-pack-title", "SDLC starter pack (pre-checked = recommended)"));
    (pack || []).forEach(function (p) {
      var row = el("label", "at-pack-row");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!p.defaultSelected;
      cb.setAttribute("data-pack-id", p.id);
      row.appendChild(cb);
      var body = document.createElement("span");
      var title = document.createElement("strong");
      title.textContent = p.title;
      title.style.fontSize = "11px";
      body.appendChild(title);
      if (p.installed) {
        var badge = document.createElement("span");
        badge.className = "at-pack-installed";
        badge.textContent = "installed";
        body.appendChild(badge);
      }
      var meta = document.createElement("span");
      meta.className = "at-pack-meta";
      meta.textContent = p.description + "  •  " + p.role + "  •  " + (p.model || "inherit");
      body.appendChild(meta);
      row.appendChild(body);
      packWrap.appendChild(row);
    });
    hero.appendChild(packWrap);

    var row = el("div", "row");
    var bEnable = el("button", "btn primary", "Enable Agent Teams");
    bEnable.addEventListener("click", function () {
      var ids = [];
      packWrap.querySelectorAll("input[type='checkbox']").forEach(function (cb) {
        if (cb.checked) {
          ids.push(cb.getAttribute("data-pack-id"));
        }
      });
      vscode.postMessage({
        type: "agentTeams.enable",
        scope: "user",
        installStarterPack: ids.length > 0,
        starterPackSelection: ids
      });
    });
    var bReveal = el("button", "btn", "Reveal ~/.claude/agents");
    bReveal.addEventListener("click", function () {
      vscode.postMessage({ type: "agentTeams.revealAgentsFolder", scope: "user" });
    });
    var bSkip = el("button", "btn", "I already have agents — scan now");
    bSkip.addEventListener("click", function () {
      vscode.postMessage({ type: "refresh" });
    });
    row.appendChild(bEnable);
    row.appendChild(bReveal);
    row.appendChild(bSkip);
    hero.appendChild(row);
    root.appendChild(hero);

    root.appendChild(
      el(
        "p",
        "at-empty-tip",
        "Agent files work in a regular \\u0060claude\\u0060 session via the Task tool — enabling here just scaffolds the folder and installs helpers. You can always edit the .md files directly in your editor."
      )
    );
  }

  function atInstallStarterPackPrompt(pack) {
    var ids = [];
    (pack || []).forEach(function (p) {
      if (p.defaultSelected) {
        ids.push(p.id);
      }
    });
    if (!ids.length) {
      ids = (pack || []).map(function (p) { return p.id; });
    }
    vscode.postMessage({
      type: "agentTeams.installStarterPack",
      scope: "user",
      selected: ids,
      overwrite: false
    });
  }

  function agentCard(a) {
    var card = el("div", "at-card");
    card.style.borderLeftColor = a.color || "var(--vscode-focusBorder)";
    var top = el("div", "card-top");
    var left = el("div");
    var swatch = document.createElement("span");
    swatch.className = "at-color-swatch";
    swatch.style.background = a.color || "var(--muted)";
    var h = el("h3", null, a.name);
    h.style.display = "inline-block";
    left.appendChild(swatch);
    left.appendChild(h);
    var roleBadge = el("span", "at-role-badge", a.role);
    left.appendChild(roleBadge);
    top.appendChild(left);
    top.appendChild(el("span", "badge", a.scope === "workspace" ? "Workspace" : "User"));
    card.appendChild(top);
    var modelStr = a.model ? a.model : "inherit";
    var toolsStr = (a.tools && a.tools.length) ? a.tools.join(", ") : "(none)";
    card.appendChild(el("div", "at-meta", "Model: " + modelStr + "  •  Tools: " + toolsStr + "  •  " + a.filePath));
    if (a.description) {
      card.appendChild(el("div", "at-desc", a.description));
    }
    var row = el("div", "row");
    var bEdit = el("button", "btn primary", "Edit");
    bEdit.addEventListener("click", function () {
      atEdit.mode = "agent-edit";
      atEdit.agentId = a.id;
      render();
    });
    var bOpen = el("button", "btn", "Open file");
    bOpen.addEventListener("click", function () {
      vscode.postMessage({ type: "agentTeams.openAgentFile", fsPath: a.filePath });
    });
    var bDel = el("button", "btn", "Delete");
    bDel.addEventListener("click", function () {
      vscode.postMessage({ type: "agentTeams.deleteAgent", id: a.id });
    });
    row.appendChild(bEdit);
    row.appendChild(bOpen);
    row.appendChild(bDel);
    card.appendChild(row);
    return card;
  }

  function findLinkedCommand(cmds, teamName) {
    if (!cmds || !teamName) return null;
    var slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    for (var i = 0; i < cmds.length; i++) {
      if (cmds[i].id === slug || cmds[i].id === teamName) return cmds[i];
    }
    return null;
  }

  function findTeamForCommand(teams, cmd) {
    if (!teams || !cmd) return null;
    for (var i = 0; i < teams.length; i++) {
      var slug = teams[i].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (cmd.id === slug || cmd.id === teams[i].name) return teams[i];
    }
    return null;
  }

  function teamCard(t, linkedCmd) {
    var card = el("div", "at-card");
    card.style.borderLeftColor = "var(--vscode-charts-orange, #f97316)";
    var top = el("div", "card-top");
    var left = el("div");
    left.appendChild(el("h3", null, t.name));
    var runtimePill = el("span", "at-pill runtime-" + (t.runtime || "native"), t.runtime || "native");
    var protoPill = el("span", "at-pill", t.protocol);
    left.appendChild(document.createTextNode(" "));
    left.appendChild(runtimePill);
    left.appendChild(protoPill);
    var cmdSlug = linkedCmd ? linkedCmd.id : t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    var cmdPill = el("span", "at-pill at-cmd-pill", "/" + cmdSlug);
    cmdPill.title = "Slash command — type /" + cmdSlug + " in Claude Code";
    left.appendChild(cmdPill);
    top.appendChild(left);
    top.appendChild(el("span", "badge", t.scope === "workspace" ? "Workspace" : "User"));
    card.appendChild(top);
    if (t.description) {
      card.appendChild(el("div", "at-desc", t.description));
    }
    var lines = [];
    lines.push("Swarm agents dispatched in parallel via /" + cmdSlug);
    if (t.protocol === "plan-then-code" || t.protocol === "converge") {
      lines.push("Plan: " + ((t.agents || []).join(", ") || "(none)"));
      lines.push("Code: " + ((t.codePhaseAgents || []).join(", ") || "(none)"));
    } else {
      lines.push("Agents: " + ((t.agents || []).join(", ") || "(none)"));
    }
    if (t.judge) lines.push("Judge: " + t.judge);
    if (t.orchestrator) lines.push("Orchestrator: " + t.orchestrator);
    lines.push("Max turns: " + (t.maxTurns || 20));
    lines.forEach(function (ln) { card.appendChild(el("div", "at-meta", ln)); });
    var row = el("div", "row");
    var bEdit = el("button", "btn primary", "Edit");
    bEdit.addEventListener("click", function () {
      atEdit.mode = "team-edit";
      atEdit.teamId = t.id;
      render();
    });
    var bRun = el("button", "btn primary", "Run…");
    bRun.title = "Provide a prompt and dispatch this team.";
    bRun.addEventListener("click", function () {
      atRunPromptFor = t.id;
      render();
    });
    row.appendChild(bEdit);
    row.appendChild(bRun);
    var bDel = el("button", "btn", "Delete");
    bDel.addEventListener("click", function () {
      vscode.postMessage({ type: "agentTeams.deleteTeam", id: t.id });
    });
    row.appendChild(bDel);
    card.appendChild(row);
    return card;
  }

  function findAgentById(s, id) {
    var list = (s && s.agents) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }
  function findTeamById(s, id) {
    var list = (s && s.teams) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function renderAgentForm(root, s) {
    var editing = atEdit.mode === "agent-edit" ? findAgentById(s, atEdit.agentId) : null;
    var defaultModel = (s && s.agentTeamsDefaultModel) || "claude-sonnet-4-5";
    var form = el("div", "at-form");
    form.appendChild(el("h3", null, editing ? "Edit agent: " + editing.name : "New agent"));

    var nameLbl = el("label", null, "Name (used as filename)");
    form.appendChild(nameLbl);
    var name = document.createElement("input");
    name.type = "text";
    name.value = editing ? editing.name : "";
    name.placeholder = "e.g. backend-dev";
    form.appendChild(name);

    var descLbl = el("label", null, "Description");
    form.appendChild(descLbl);
    var desc = document.createElement("input");
    desc.type = "text";
    desc.value = editing ? editing.description : "";
    desc.placeholder = "One-line summary";
    form.appendChild(desc);

    var row1 = el("div", "at-form-row");
    var rRole = document.createElement("div");
    rRole.appendChild(el("label", null, "Role"));
    var role = document.createElement("select");
    AT_ROLES.forEach(function (r) {
      var opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.label;
      if (editing ? editing.role === r.id : r.id === "both") opt.selected = true;
      role.appendChild(opt);
    });
    rRole.appendChild(role);
    var rModel = document.createElement("div");
    rModel.appendChild(el("label", null, "Model"));
    var model = document.createElement("select");
    AT_MODELS.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      if (editing) {
        if (editing.model === m.id || (!editing.model && m.id === "")) opt.selected = true;
      } else {
        if (m.id === defaultModel) opt.selected = true;
      }
      model.appendChild(opt);
    });
    rModel.appendChild(model);
    row1.appendChild(rRole);
    row1.appendChild(rModel);
    form.appendChild(row1);

    var row2 = el("div", "at-form-row");
    var rScope = document.createElement("div");
    rScope.appendChild(el("label", null, "Scope"));
    var scope = document.createElement("select");
    [
      { id: "user", label: "User (~/.claude/agents)" },
      { id: "workspace", label: "Workspace (./.claude/agents)" }
    ].forEach(function (sc) {
      var opt = document.createElement("option");
      opt.value = sc.id;
      opt.textContent = sc.label;
      if (editing ? editing.scope === sc.id : sc.id === "user") opt.selected = true;
      scope.appendChild(opt);
    });
    if (editing) scope.disabled = true;
    rScope.appendChild(scope);
    var rColor = document.createElement("div");
    rColor.appendChild(el("label", null, "Color (hex)"));
    var color = document.createElement("input");
    color.type = "text";
    color.placeholder = "#4ec9b0";
    color.value = editing ? (editing.color || "") : "";
    rColor.appendChild(color);
    row2.appendChild(rScope);
    row2.appendChild(rColor);
    form.appendChild(row2);

    form.appendChild(el("label", null, "Tools"));
    var toolsWrap = el("div", "at-checkbox-list");
    AT_TOOL_CHOICES.forEach(function (t) {
      var lbl = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = t;
      if (editing && editing.tools && editing.tools.indexOf(t) !== -1) cb.checked = true;
      cb.setAttribute("data-tool", t);
      lbl.appendChild(cb);
      var sp = document.createElement("span");
      sp.textContent = t;
      lbl.appendChild(sp);
      toolsWrap.appendChild(lbl);
    });
    form.appendChild(toolsWrap);

    form.appendChild(el("label", null, "System prompt"));
    var prompt = document.createElement("textarea");
    prompt.value = editing ? editing.systemPrompt : "You are…";
    form.appendChild(prompt);

    var actions = el("div", "at-form-actions");
    var bSave = el("button", "btn primary", editing ? "Save changes" : "Create agent");
    bSave.addEventListener("click", function () {
      var tools = [];
      toolsWrap.querySelectorAll("input[type='checkbox']").forEach(function (cb) {
        if (cb.checked) tools.push(cb.getAttribute("data-tool"));
      });
      var draft = {
        name: name.value.trim(),
        description: desc.value.trim(),
        role: role.value,
        model: model.value,
        tools: tools,
        color: color.value.trim(),
        systemPrompt: prompt.value,
        scope: scope.value
      };
      if (!draft.name) {
        alert("Name is required.");
        return;
      }
      if (editing) {
        vscode.postMessage({ type: "agentTeams.updateAgent", id: editing.id, draft: draft });
      } else {
        vscode.postMessage({ type: "agentTeams.createAgent", draft: draft });
      }
      atEdit.mode = "none";
      atEdit.agentId = null;
    });
    var bCancel = el("button", "btn", "Cancel");
    bCancel.addEventListener("click", function () {
      atEdit.mode = "none";
      atEdit.agentId = null;
      render();
    });
    actions.appendChild(bSave);
    actions.appendChild(bCancel);
    form.appendChild(actions);

    root.appendChild(form);
  }

  function renderTeamForm(root, s) {
    var editing = atEdit.mode === "team-edit" ? findTeamById(s, atEdit.teamId) : null;
    var agents = (s && s.agents) || [];
    var defaultProto = (s && s.agentTeamsDefaultProtocol) || "native-task";
    var form = el("div", "at-form");
    form.appendChild(el("h3", null, editing ? "Edit team: " + editing.name : "New team"));

    form.appendChild(el("label", null, "Name"));
    var name = document.createElement("input");
    name.type = "text";
    name.value = editing ? editing.name : "";
    name.placeholder = "e.g. sdlc-core";
    form.appendChild(name);

    form.appendChild(el("label", null, "Description"));
    var desc = document.createElement("input");
    desc.type = "text";
    desc.value = editing ? editing.description : "";
    form.appendChild(desc);

    var row1 = el("div", "at-form-row");
    var rProto = document.createElement("div");
    rProto.appendChild(el("label", null, "Protocol (runtime auto-derived)"));
    var proto = document.createElement("select");
    AT_PROTOCOLS.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label + "  •  " + p.runtime;
      if (editing ? editing.protocol === p.id : p.id === defaultProto) opt.selected = true;
      proto.appendChild(opt);
    });
    rProto.appendChild(proto);
    var rScope = document.createElement("div");
    rScope.appendChild(el("label", null, "Scope"));
    var scope = document.createElement("select");
    [
      { id: "user", label: "User (~/.claude/teams)" },
      { id: "workspace", label: "Workspace (./.claude/teams)" }
    ].forEach(function (sc) {
      var opt = document.createElement("option");
      opt.value = sc.id;
      opt.textContent = sc.label;
      if (editing ? editing.scope === sc.id : sc.id === "user") opt.selected = true;
      scope.appendChild(opt);
    });
    if (editing) scope.disabled = true;
    rScope.appendChild(scope);
    row1.appendChild(rProto);
    row1.appendChild(rScope);
    form.appendChild(row1);

    form.appendChild(el("label", null, "Max turns"));
    var maxTurns = document.createElement("input");
    maxTurns.type = "text";
    maxTurns.value = editing ? String(editing.maxTurns) : "20";
    form.appendChild(maxTurns);

    /* Plan-phase / main agents checkbox list */
    var planLabel = el("label", null, "Agents (plan phase for plan-then-code; otherwise the whole team)");
    form.appendChild(planLabel);
    var planWrap = el("div", "at-checkbox-list");
    if (!agents.length) {
      planWrap.appendChild(el("div", "empty", "No agents yet. Create some first."));
    } else {
      agents.forEach(function (a) {
        var lbl = document.createElement("label");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = a.name;
        cb.setAttribute("data-plan-agent", a.name);
        if (editing && editing.agents && editing.agents.indexOf(a.name) !== -1) cb.checked = true;
        lbl.appendChild(cb);
        var sp = document.createElement("span");
        var sw = document.createElement("span");
        sw.className = "at-color-swatch";
        sw.style.background = a.color || "var(--muted)";
        sp.appendChild(sw);
        sp.appendChild(document.createTextNode(a.name + "  •  " + a.role));
        lbl.appendChild(sp);
        planWrap.appendChild(lbl);
      });
    }
    form.appendChild(planWrap);

    /* Code-phase agents (only shown for plan-then-code) */
    var codeLabel = el("label", null, "Code-phase agents (plan-then-code only)");
    form.appendChild(codeLabel);
    var codeWrap = el("div", "at-checkbox-list");
    if (!agents.length) {
      codeWrap.appendChild(el("div", "empty", "No agents yet."));
    } else {
      agents.forEach(function (a) {
        var lbl = document.createElement("label");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = a.name;
        cb.setAttribute("data-code-agent", a.name);
        if (editing && editing.codePhaseAgents && editing.codePhaseAgents.indexOf(a.name) !== -1) cb.checked = true;
        lbl.appendChild(cb);
        var sp = document.createElement("span");
        var sw = document.createElement("span");
        sw.className = "at-color-swatch";
        sw.style.background = a.color || "var(--muted)";
        sp.appendChild(sw);
        sp.appendChild(document.createTextNode(a.name + "  •  " + a.role));
        lbl.appendChild(sp);
        codeWrap.appendChild(lbl);
      });
    }
    form.appendChild(codeWrap);

    var row2 = el("div", "at-form-row");
    var rJudge = document.createElement("div");
    rJudge.appendChild(el("label", null, "Judge (debate)"));
    var judge = document.createElement("select");
    var emptyJ = document.createElement("option");
    emptyJ.value = "";
    emptyJ.textContent = "(none)";
    judge.appendChild(emptyJ);
    agents.forEach(function (a) {
      var opt = document.createElement("option");
      opt.value = a.name;
      opt.textContent = a.name;
      if (editing && editing.judge === a.name) opt.selected = true;
      judge.appendChild(opt);
    });
    rJudge.appendChild(judge);
    var rOrch = document.createElement("div");
    rOrch.appendChild(el("label", null, "Orchestrator"));
    var orch = document.createElement("select");
    var emptyO = document.createElement("option");
    emptyO.value = "";
    emptyO.textContent = "(none)";
    orch.appendChild(emptyO);
    agents.forEach(function (a) {
      var opt = document.createElement("option");
      opt.value = a.name;
      opt.textContent = a.name;
      if (editing && editing.orchestrator === a.name) opt.selected = true;
      orch.appendChild(opt);
    });
    rOrch.appendChild(orch);
    row2.appendChild(rJudge);
    row2.appendChild(rOrch);
    form.appendChild(row2);

    form.appendChild(el("div", "at-meta", "A matching /" + (editing ? editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "team-name") + " slash command will be auto-created for this team."));

    var actions = el("div", "at-form-actions");
    var bSave = el("button", "btn primary", editing ? "Save changes" : "Create team");
    bSave.addEventListener("click", function () {
      var picked = [];
      planWrap.querySelectorAll("input[type='checkbox']").forEach(function (cb) {
        if (cb.checked) picked.push(cb.value);
      });
      var codePicked = [];
      codeWrap.querySelectorAll("input[type='checkbox']").forEach(function (cb) {
        if (cb.checked) codePicked.push(cb.value);
      });
      var n = parseInt(maxTurns.value, 10);
      if (isNaN(n) || n < 1) n = 20;
      var info = atProtocolInfo(proto.value);
      var draft = {
        name: name.value.trim(),
        description: desc.value.trim(),
        protocol: proto.value,
        runtime: info.runtime,
        maxTurns: n,
        agents: picked,
        codePhaseAgents: codePicked,
        judge: judge.value || undefined,
        orchestrator: orch.value || undefined,
        scope: scope.value
      };
      if (!draft.name) {
        alert("Team name is required.");
        return;
      }
      if (!draft.agents.length) {
        alert("Pick at least one agent.");
        return;
      }
      if (editing) {
        vscode.postMessage({ type: "agentTeams.updateTeam", id: editing.id, draft: draft });
      } else {
        vscode.postMessage({ type: "agentTeams.createTeam", draft: draft });
      }
      atEdit.mode = "none";
      atEdit.teamId = null;
    });
    var bCancel = el("button", "btn", "Cancel");
    bCancel.addEventListener("click", function () {
      atEdit.mode = "none";
      atEdit.teamId = null;
      render();
    });
    actions.appendChild(bSave);
    actions.appendChild(bCancel);
    form.appendChild(actions);

    root.appendChild(form);
  }

  function findCommandByFilePath(s, fp) {
    var list = (s && s.slashCommands) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].filePath === fp) return list[i];
    }
    return null;
  }

  function buildCommandBodyPreview(agentNames, allAgents) {
    if (!agentNames.length) return "";
    var NL = String.fromCharCode(10);
    var BT = String.fromCharCode(96);
    var lines = [];
    lines.push("Run this command using the **Task** tool to dispatch each subagent in order:");
    lines.push("");
    for (var i = 0; i < agentNames.length; i++) {
      var aName = agentNames[i];
      var agent = null;
      for (var j = 0; j < allAgents.length; j++) {
        if (allAgents[j].name === aName) { agent = allAgents[j]; break; }
      }
      var agentDesc = agent && agent.description ? " -- " + agent.description : "";
      lines.push((i + 1) + ". " + BT + aName + BT + agentDesc);
    }
    lines.push("");
    lines.push("After all agents have replied, synthesize their outputs into a coherent response.");
    lines.push("");
    lines.push("User's request:");
    lines.push("$ARGUMENTS");
    return lines.join(NL);
  }

  function renderCommandForm(root, s) {
    var editing = atEdit.mode === "command-edit" ? findCommandByFilePath(s, atEdit.commandFilePath) : null;
    var agents = (s && s.agents) || [];
    var userEditedBody = false;

    if (editing && atEdit.commandBody === null) {
      var loading = el("div", "at-form");
      loading.appendChild(el("h3", null, "Loading command..."));
      loading.appendChild(el("p", null, "Reading command body from disk."));
      root.appendChild(loading);
      return;
    }

    var form = el("div", "at-form");
    form.appendChild(el("h3", null, editing ? "Edit command: /" + editing.id : "New slash command"));

    form.appendChild(el("label", null, "Name (becomes the /command-name)"));
    var name = document.createElement("input");
    name.type = "text";
    name.value = editing ? editing.id : "";
    name.placeholder = "e.g. my-review";
    if (editing) name.disabled = true;
    form.appendChild(name);

    form.appendChild(el("label", null, "Description"));
    var desc = document.createElement("input");
    desc.type = "text";
    desc.value = editing ? (editing.description || "") : "";
    desc.placeholder = "Short description shown by Claude Code";
    form.appendChild(desc);

    form.appendChild(el("label", null, "Argument hint"));
    var hint = document.createElement("input");
    hint.type = "text";
    hint.value = editing ? (editing.argumentHint || "") : "";
    hint.placeholder = "<what should the command do?>";
    form.appendChild(hint);

    var row1 = el("div", "at-form-row");
    var rScope = document.createElement("div");
    rScope.appendChild(el("label", null, "Scope"));
    var scope = document.createElement("select");
    [
      { id: "user", label: "User (~/.claude/commands)" },
      { id: "workspace", label: "Workspace (./.claude/commands)" }
    ].forEach(function (sc) {
      var opt = document.createElement("option");
      opt.value = sc.id;
      opt.textContent = sc.label;
      if (editing ? editing.scope === sc.id : sc.id === "user") opt.selected = true;
      scope.appendChild(opt);
    });
    if (editing) scope.disabled = true;
    rScope.appendChild(scope);
    row1.appendChild(rScope);
    form.appendChild(row1);

    var editAgents = editing && atEdit.commandAgents ? atEdit.commandAgents : [];

    form.appendChild(el("label", null, "Agents to dispatch (select and order)"));
    form.appendChild(el("div", "at-meta", "Check agents to include. Instructions below auto-update when you change selection."));
    var agentsWrap = el("div", "at-checkbox-list");
    if (!agents.length) {
      agentsWrap.appendChild(el("div", "at-meta", "No agents available. Create agents first."));
    }
    agents.forEach(function (a) {
      var lbl = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = a.name;
      cb.setAttribute("data-agent", a.name);
      if (editAgents.indexOf(a.name) !== -1) cb.checked = true;
      lbl.appendChild(cb);
      var swatch = document.createElement("span");
      swatch.className = "at-color-swatch";
      swatch.style.background = a.color || "var(--muted)";
      lbl.appendChild(swatch);
      var sp = document.createElement("span");
      sp.textContent = a.name + " (" + a.role + ")";
      lbl.appendChild(sp);
      agentsWrap.appendChild(lbl);
    });
    form.appendChild(agentsWrap);

    form.appendChild(el("label", null, "Instructions (command body)"));
    form.appendChild(el("div", "at-meta", "Auto-generated from agents. Edit freely; once edited, agent changes won't overwrite your text. Use $ARGUMENTS for user input."));
    var instructions = document.createElement("textarea");
    instructions.rows = 12;
    if (editing && atEdit.commandBody) {
      instructions.value = atEdit.commandBody;
      userEditedBody = true;
    } else {
      instructions.value = buildCommandBodyPreview(editAgents, agents);
    }
    instructions.addEventListener("input", function () { userEditedBody = true; });
    form.appendChild(instructions);

    function refreshBody() {
      if (userEditedBody) return;
      var sel = [];
      agentsWrap.querySelectorAll("input[type='checkbox']").forEach(function (cb) {
        if (cb.checked) sel.push(cb.getAttribute("data-agent"));
      });
      instructions.value = buildCommandBodyPreview(sel, agents);
    }
    agentsWrap.addEventListener("change", refreshBody);

    var actions = el("div", "at-form-actions");
    var bSave = el("button", "btn primary", editing ? "Save changes" : "Create command");
    bSave.addEventListener("click", function () {
      var selectedAgents = [];
      agentsWrap.querySelectorAll("input[type='checkbox']").forEach(function (cb) {
        if (cb.checked) selectedAgents.push(cb.getAttribute("data-agent"));
      });
      var draft = {
        name: name.value.trim(),
        description: desc.value.trim(),
        argumentHint: hint.value.trim(),
        agents: selectedAgents,
        instructions: instructions.value,
        scope: scope.value
      };
      if (!draft.name) {
        alert("Command name is required.");
        return;
      }
      if (!draft.agents.length && !draft.instructions.trim()) {
        alert("Select at least one agent or provide custom instructions.");
        return;
      }
      if (editing) {
        vscode.postMessage({ type: "agentTeams.updateCommand", filePath: editing.filePath, draft: draft });
      } else {
        vscode.postMessage({ type: "agentTeams.createCommand", draft: draft });
      }
      atEdit.mode = "none";
      atEdit.commandFilePath = null;
      atEdit.commandBody = null;
      atEdit.commandAgents = null;
    });
    var bCancel = el("button", "btn", "Cancel");
    bCancel.addEventListener("click", function () {
      atEdit.mode = "none";
      atEdit.commandFilePath = null;
      atEdit.commandBody = null;
      atEdit.commandAgents = null;
      render();
    });
    actions.appendChild(bSave);
    actions.appendChild(bCancel);
    form.appendChild(actions);

    root.appendChild(form);
  }

  /* ======================== Agent Dashboard (card strip) ======================== */

  function renderAgentDashboard(root, s) {
    var d = (s && s.agentDashboard) || null;
    if (!d) return;

    if (!d.enabled || !d.running) {
      renderDashboardDisclosure(root, d);
      if (!d.enabled) return;
    }

    var head = el("div", "ad-strip-head");
    var dot = document.createElement("span");
    dot.className = "ad-dot " + (d.running ? "running" : d.lastError ? "error" : "stopped");
    head.appendChild(dot);
    head.appendChild(el("strong", null, "Agent Dashboard"));
    head.appendChild(
      el(
        "span",
        "ad-source",
        d.running ? "port " + (d.port || "?") : d.lastError ? "error" : "stopped"
      )
    );
    head.appendChild(el("span", "ad-framework", (adCards.length || 0) + " session(s)"));
    var actionWrap = document.createElement("div");
    actionWrap.style.marginLeft = "auto";
    actionWrap.style.display = "flex";
    actionWrap.style.gap = "6px";
    if (!d.running) {
      var bEnable = el("button", "btn primary", "Enable");
      bEnable.addEventListener("click", function () {
        vscode.postMessage({ type: "agentDashboard.enable" });
      });
      actionWrap.appendChild(bEnable);
    } else {
      var bDisable = el("button", "btn", "Disable");
      bDisable.addEventListener("click", function () {
        vscode.postMessage({ type: "agentDashboard.disable" });
      });
      actionWrap.appendChild(bDisable);
    }
    var bStatus = el("button", "btn", "Status");
    bStatus.addEventListener("click", function () {
      vscode.postMessage({ type: "agentDashboard.status" });
    });
    actionWrap.appendChild(bStatus);
    var bReveal = el("button", "btn", "Reveal settings.json");
    bReveal.addEventListener("click", function () {
      vscode.postMessage({ type: "agentDashboard.revealSettingsJson" });
    });
    actionWrap.appendChild(bReveal);
    head.appendChild(actionWrap);
    root.appendChild(head);

    if (Array.isArray(d.foreignHooks) && d.foreignHooks.length > 0) {
      var warn = el(
        "div",
        "callout",
        "Other agent-dashboard hooks detected in ~/.claude/settings.json (" +
          d.foreignHooks.length +
          "). Events may be processed twice. Run Status for details."
      );
      warn.style.borderLeftColor = "var(--warn)";
      root.appendChild(warn);
    }

    if (!d.running) return;

    if (!adCards || !adCards.length) {
      root.appendChild(
        el(
          "div",
          "empty",
          "No Claude Code sessions detected yet — start \\u0060claude\\u0060 in a terminal or run a team from the list below and watch them appear here."
        )
      );
      return;
    }

    /* Toolbar: filter box + grouping toggle. */
    var toolbar = el("div", "ad-toolbar");
    var filterInput = document.createElement("input");
    filterInput.type = "search";
    filterInput.className = "ad-filter";
    filterInput.placeholder = "Filter cards (title, agent, tool, cwd, protocol…)";
    filterInput.value = adFilter;
    filterInput.addEventListener("input", function () {
      adFilter = filterInput.value || "";
      renderAdCardsBody(root);
    });
    toolbar.appendChild(filterInput);
    var groupWrap = el("div", "ad-group-toggle");
    ["workspace", "flat"].forEach(function (mode) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn" + (adGrouping === mode ? " primary" : "");
      b.textContent = mode === "workspace" ? "By workspace" : "Flat";
      b.addEventListener("click", function () {
        adGrouping = mode;
        renderAdCardsBody(root);
      });
      groupWrap.appendChild(b);
    });
    toolbar.appendChild(groupWrap);
    root.appendChild(toolbar);

    var bodyWrap = el("div", "ad-body");
    bodyWrap.setAttribute("data-ad-body", "1");
    root.appendChild(bodyWrap);
    renderAdCardsBody(bodyWrap);
  }

  function renderAdCardsBody(hostOrRoot) {
    var host = hostOrRoot.getAttribute && hostOrRoot.getAttribute("data-ad-body") === "1"
      ? hostOrRoot
      : hostOrRoot.querySelector('[data-ad-body="1"]');
    if (!host) return;
    host.textContent = "";

    var filtered = filterDashboardCards(adCards, adFilter);
    if (!filtered.length) {
      host.appendChild(
        el("div", "empty", "No cards match \\u201C" + adFilter + "\\u201D.")
      );
      return;
    }

    if (adGrouping === "flat") {
      var grid = el("div", "ad-cards");
      filtered.forEach(function (card) {
        grid.appendChild(renderSessionCard(card));
      });
      host.appendChild(grid);
      return;
    }

    /* Swim lanes: group by workspace (cwd basename), pinned first, then by updatedAt. */
    var lanes = groupSessionsByWorkspace(filtered);
    lanes.forEach(function (lane) {
      var laneWrap = el("div", "ad-lane");
      var head = el("div", "ad-lane-head");
      head.appendChild(el("span", "ad-lane-title", lane.title));
      head.appendChild(el("span", "ad-lane-count", String(lane.cards.length)));
      laneWrap.appendChild(head);
      var grid = el("div", "ad-cards");
      lane.cards.forEach(function (card) {
        grid.appendChild(renderSessionCard(card));
      });
      laneWrap.appendChild(grid);
      host.appendChild(laneWrap);
    });
  }

  function filterDashboardCards(cards, query) {
    var q = (query || "").trim().toLowerCase();
    if (!q) return cards.slice();
    return cards.filter(function (c) {
      var hay =
        (c.title || "") +
        " " +
        (c.cwd || "") +
        " " +
        (c.protocol || "") +
        " " +
        (c.teamName || "") +
        " " +
        ((c.currentTool && c.currentTool.name) || "") +
        " " +
        ((c.currentTool && c.currentTool.target) || "") +
        " " +
        (c.source || "") +
        " " +
        (c.status || "");
      return hay.toLowerCase().indexOf(q) !== -1;
    });
  }

  function groupSessionsByWorkspace(cards) {
    var map = {};
    cards.forEach(function (c) {
      var key = laneKeyForCard(c);
      if (!map[key]) map[key] = { title: key, cards: [] };
      map[key].cards.push(c);
    });
    var lanes = Object.keys(map).map(function (k) {
      return map[k];
    });
    /* Sort lanes: current workspace first, then alphabetical. */
    var ws = (state && state.workspaceName) || "";
    lanes.sort(function (a, b) {
      if (a.title === ws) return -1;
      if (b.title === ws) return 1;
      if (a.title === "(no workspace)") return 1;
      if (b.title === "(no workspace)") return -1;
      return a.title.localeCompare(b.title);
    });
    lanes.forEach(function (lane) {
      lane.cards.sort(function (a, b) {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      });
    });
    return lanes;
  }

  function laneKeyForCard(card) {
    if (!card.cwd) return "(no workspace)";
    /* Use the basename of the cwd path — cheaper than matching full paths. */
    var cwd = String(card.cwd).replace(/[\\\\/]+$/, "");
    var parts = cwd.split(/[\\\\/]/);
    return parts[parts.length - 1] || cwd;
  }

  function renderDashboardDisclosure(root, d) {
    if (d.enabled) return;
    var box = el("div", "ad-disclose");
    box.appendChild(el("h3", null, "Enable Agent Dashboard"));
    var p = el(
      "p",
      "at-empty-tip",
      "Opt-in feature. When enabled, the Toolbox will:"
    );
    box.appendChild(p);
    var ul = document.createElement("ul");
    function li(text) {
      var x = document.createElement("li");
      x.textContent = text;
      ul.appendChild(x);
    }
    li("Write a helper script (agent-dock-hook.py) into ~/.claude/");
    li("Add hook entries for PreToolUse, PostToolUse, Stop, SubagentStop, PermissionRequest into ~/.claude/settings.json (atomic, dedup, reversible via Disable)");
    li("Start an HTTP listener on 127.0.0.1:" + (d.port || "3456") + " that only accepts POST /hook + GET /healthz");
    li("Tail ~/.claude/projects/<session>.jsonl files to show token and tool-call activity");
    li("No telemetry — nothing leaves your machine. All data stays local to the hook listener and the UI.");
    box.appendChild(ul);
    var row = el("div", "row");
    var b = el("button", "btn primary", "Enable Agent Dashboard");
    b.addEventListener("click", function () {
      vscode.postMessage({ type: "agentDashboard.enable" });
    });
    row.appendChild(b);
    box.appendChild(row);
    root.appendChild(box);
  }

  function renderSessionCard(card) {
    var over = card.budgetUsd && card.projectedCostUsd && card.projectedCostUsd > card.budgetUsd;
    var c = el(
      "div",
      "ad-card source-" + (card.source || "external") + " status-" + (card.status || "idle") + (over ? " over-budget" : "")
    );
    if (card.pinned) c.setAttribute("data-pinned", "1");
    /* title row */
    var top = el("div", "ad-row");
    var dot = el("span", "ad-status-dot " + (card.status || "idle"), "");
    top.appendChild(dot);
    var title = el("span", "ad-title", card.title || card.teamName || card.sessionId);
    top.appendChild(title);
    top.appendChild(el("span", "ad-source ad-source-" + (card.source || "external"), card.source || "external"));
    c.appendChild(top);

    /* framework + status text */
    var meta = el("div", "ad-row");
    meta.style.color = "var(--muted)";
    meta.style.fontSize = "9.5px";
    meta.appendChild(el("span", null, "status: " + (card.status || "idle")));
    if (card.protocol) meta.appendChild(el("span", null, "· " + card.protocol));
    if (card.cwd) {
      var cwd = card.cwd.length > 40 ? "…" + card.cwd.slice(-40) : card.cwd;
      meta.appendChild(el("span", null, "· " + cwd));
    }
    if (typeof card.dissentCount === "number" && card.dissentCount > 0) {
      meta.appendChild(el("span", "ad-dissent", "⚖ " + card.dissentCount + " dissent"));
    }
    c.appendChild(meta);

    /* current tool */
    if (card.currentTool && card.currentTool.name) {
      var tool = el("div", "ad-tool" + (card.waitingForPermission ? " perm" : ""));
      tool.textContent = "↻ " + card.currentTool.name;
      if (card.currentTool.target) {
        var t = el("span", "ad-tool-target", " → " + card.currentTool.target);
        tool.appendChild(t);
      }
      if (card.waitingForPermission) {
        var perm = el("span", "ad-tool-target", " · needs approval");
        tool.appendChild(perm);
      }
      c.appendChild(tool);
    }

    /* context bar */
    var ctxMax = (card.context && card.context.max) || 0;
    var ctxUsed = (card.context && card.context.used) || 0;
    var pct = ctxMax > 0 ? Math.min(100, Math.floor((ctxUsed * 100) / ctxMax)) : 0;
    var bar = el("div", "ad-ctx-bar");
    var fill = el("div", "ad-ctx-bar-fill");
    fill.style.width = pct + "%";
    bar.appendChild(fill);
    c.appendChild(bar);
    var ctxLabel = el("div", "ad-ctx-label");
    ctxLabel.textContent = "ctx " + pct + "% · used " + formatTokens(ctxUsed) + "/" + formatTokens(ctxMax);
    c.appendChild(ctxLabel);

    /* metrics: tokens + cost */
    var metrics = el("div", "ad-metrics");
    var tks = el("span", null, "");
    tks.appendChild(document.createTextNode("in "));
    tks.appendChild(el("strong", null, formatTokens((card.tokens && card.tokens.input) || 0)));
    tks.appendChild(document.createTextNode(" / out "));
    tks.appendChild(el("strong", null, formatTokens((card.tokens && card.tokens.output) || 0)));
    metrics.appendChild(tks);
    var cost = el("span", "ad-cost", "");
    cost.appendChild(document.createTextNode("cost "));
    cost.appendChild(el("strong", null, formatUsd(card.costUsd || 0)));
    metrics.appendChild(cost);
    if (card.projectedCostUsd && card.projectedCostUsd > (card.costUsd || 0) * 1.02) {
      var proj = el("span", null, "");
      proj.appendChild(document.createTextNode("proj "));
      proj.appendChild(el("strong", null, formatUsd(card.projectedCostUsd)));
      metrics.appendChild(proj);
    }
    if (card.budgetUsd) {
      var bud = el("span", null, "");
      bud.appendChild(document.createTextNode("budget "));
      bud.appendChild(el("strong", null, formatUsd(card.budgetUsd)));
      metrics.appendChild(bud);
    }
    c.appendChild(metrics);

    /* tool feed (last 3) */
    var feed = (card.toolFeed || []).slice(0, 3);
    if (feed.length) {
      var feedEl = el("div", "ad-feed");
      feed.forEach(function (f) {
        var line = el(
          "div",
          "ad-feed-line " + (f.status === "error" ? "error" : f.status === "running" ? "running" : ""),
          (f.status === "error" ? "✗ " : f.status === "running" ? "↻ " : "✓ ") +
            f.name +
            (f.target ? " " + f.target : "")
        );
        feedEl.appendChild(line);
      });
      c.appendChild(feedEl);
    }

    /* Safety alerts (Phase 1.6) */
    (card.safetyAlerts || []).forEach(function (alert) {
      if (alert.acknowledged) return;
      var row = el("div", "ad-alert");
      row.appendChild(el("span", null, "⚠ " + alert.pattern + " in " + (alert.tool || "tool")));
      if (alert.target) row.appendChild(el("span", "ad-tool-target", alert.target.slice(0, 60)));
      var ack = el("button", "btn", "Ack");
      ack.addEventListener("click", function () {
        vscode.postMessage({
          type: "agentDashboard.acknowledgeAlert",
          sessionId: card.sessionId,
          alertId: alert.id,
        });
      });
      row.appendChild(ack);
      c.appendChild(row);
    });

    /* Actions */
    var actions = el("div", "ad-actions");
    if (card.runId) {
      var bOpen = el("button", "btn primary", "Open run");
      bOpen.addEventListener("click", function () {
        vscode.postMessage({ type: "agentTeams.openRun", runId: card.runId });
      });
      actions.appendChild(bOpen);
      if (card.status !== "done" && card.status !== "error") {
        var bStop = el("button", "btn", "Stop");
        bStop.addEventListener("click", function () {
          vscode.postMessage({ type: "agentTeams.stopRun", runId: card.runId });
        });
        actions.appendChild(bStop);
      }
      if (card.status === "awaiting_approval") {
        var bApp = el("button", "btn primary", "Approve plan");
        bApp.addEventListener("click", function () {
          var r = atRuns[card.runId];
          if (r) {
            atApprovalModal = { runId: card.runId, planPath: r.planPath, editedPlan: null };
          } else {
            atApprovalModal = { runId: card.runId, planPath: null, editedPlan: null };
          }
          render();
        });
        actions.appendChild(bApp);
      }
    } else {
      var bTx = el("button", "btn", "Reveal transcript");
      bTx.addEventListener("click", function () {
        vscode.postMessage({
          type: "agentDashboard.revealSessionTranscript",
          sessionId: card.sessionId,
        });
      });
      actions.appendChild(bTx);
    }
    var bPin = el("button", "btn", card.pinned ? "Unpin" : "Pin");
    bPin.addEventListener("click", function () {
      vscode.postMessage({
        type: card.pinned ? "agentDashboard.unpinSession" : "agentDashboard.pinSession",
        sessionId: card.sessionId,
      });
    });
    actions.appendChild(bPin);
    c.appendChild(actions);

    return c;
  }

  function formatTokens(n) {
    if (!n) return "0";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  }
  function formatUsd(v) {
    if (!isFinite(v) || !v) return "$0.00";
    if (v < 0.01) return "$" + v.toFixed(4);
    return "$" + v.toFixed(2);
  }

  function render() {
    var root = $("#root");
    if (!root) {
      return;
    }
    root.textContent = "";
    updateChrome();
    if (!state) {
      root.appendChild(el("div", "empty", "Loading\u2026"));
      return;
    }
    syncIntelAutoScanCheckbox();
    syncThinkingMachineModeCheckbox();
    syncHubHostCopy();

    if (state.hubLoadError) {
      var warn = el("div", "callout");
      warn.style.borderLeftColor = "var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground))";
      warn.appendChild(el("h4", null, "Could not load hub data"));
      warn.appendChild(
        el(
          "p",
          null,
          String(state.hubLoadError) + " You can still use tabs below; try Refresh or reload the window."
        )
      );
      root.appendChild(warn);
    }

    if (page === "intel") {
      renderIntel();
      return;
    }
    if (page === "workspace") {
      renderWorkspace();
      return;
    }
    if (page === "agentteams") {
      renderAgentTeams();
      return;
    }

    if (page === "skills") {
      if (sub === "browse") {
        appendSkillRemoteCatalog($("#root"));
      }
      var skills = filterText(state.skills || [], function (s) {
        return s.name + " " + s.description + " " + s.rootPath + (s.disabled ? " off hidden" : "");
      });
      $("#root").appendChild(el("div", "section-title", sub === "browse" ? "Local skills (this machine)" : "Installed skills"));
      $("#root").appendChild(el("div", "empty", "Browsing only — attach SKILL.md in chat when you need it."));
      if (!skills.length) {
        $("#root").appendChild(el("div", "empty", "No SKILL.md skill folders found. Add subfolders with SKILL.md under project roots (.github/skills, .claude/skills, .agents/skills, .cursor/skills) or user roots under .claude/skills, .agents/skills, .cursor/skills (and legacy editor skill dirs if present)."));
        return;
      }
      skills.forEach(function (s) {
        $("#root").appendChild(skillCard(s));
      });
      return;
    }

    /* MCP */
    var ws = state.workspaceServers || [];
    var us = state.userServers || [];
    var browse = sub === "browse";
    var rootEl = $("#root");

    if (browse) {
      appendRegistryCatalog(rootEl);
      rootEl.appendChild(el("div", "section-title", "Workspace MCP"));
      if (!state.workspaceName) {
        rootEl.appendChild(callout("No folder open", "Open a workspace folder to edit .vscode/mcp.json and list workspace-scoped servers.", "workbench.mcp.openWorkspaceFolderMcpJson", "Open workspace mcp.json"));
      } else if (state.workspaceMcp === "missing") {
        rootEl.appendChild(callout("Workspace mcp.json missing", "Create .vscode/mcp.json to register MCP servers for this project.", "workbench.mcp.openWorkspaceFolderMcpJson", "Create workspace mcp.json"));
      } else if (state.workspaceMcp === "empty") {
        if ((ws || []).length === 0) {
          rootEl.appendChild(callout("No servers yet", "Your mcp.json exists but defines no servers.", "workbench.mcp.openWorkspaceFolderMcpJson", "Edit workspace mcp.json"));
        }
        filterText(ws, function (x) { return x.id + x.kind + x.detail + (x.disabled ? " off disabled" : ""); }).forEach(function (s) {
          rootEl.appendChild(mcpCard(s));
        });
      } else {
        filterText(ws, function (x) { return x.id + x.kind + x.detail + (x.disabled ? " off disabled" : ""); }).forEach(function (s) {
          rootEl.appendChild(mcpCard(s));
        });
      }

      rootEl.appendChild(el("div", "section-title", "User MCP"));
      if (state.userMcp === "missing") {
        if ((us || []).length === 0) {
          rootEl.appendChild(callout("User mcp.json missing", "Opens your global MCP config (VS Code will create the file if needed).", "workbench.mcp.openUserMcpJson", "Open user mcp.json"));
        }
        filterText(us, function (x) { return x.id + x.kind + x.detail + (x.disabled ? " off disabled" : ""); }).forEach(function (s) {
          rootEl.appendChild(mcpCard(s));
        });
      } else if (state.userMcp === "empty") {
        if ((us || []).length === 0) {
          rootEl.appendChild(callout("No user servers", "Add servers to your user mcp.json for every workspace.", "workbench.mcp.openUserMcpJson", "Edit user mcp.json"));
        }
        filterText(us, function (x) { return x.id + x.kind + x.detail + (x.disabled ? " off disabled" : ""); }).forEach(function (s) {
          rootEl.appendChild(mcpCard(s));
        });
      } else {
        filterText(us, function (x) { return x.id + x.kind + x.detail + (x.disabled ? " off disabled" : ""); }).forEach(function (s) {
          rootEl.appendChild(mcpCard(s));
        });
      }
    } else {
      rootEl.appendChild(el("div", "section-title", "Workspace servers"));
      if (!state.workspaceName) {
        rootEl.appendChild(el("div", "empty", "No workspace folder."));
      } else if ((ws || []).length > 0) {
        filterText(ws, function (x) { return x.id + x.kind + x.detail + (x.disabled ? " off disabled" : ""); }).forEach(function (s) {
          rootEl.appendChild(mcpCard(s));
        });
      } else if (state.workspaceMcp === "missing") {
        rootEl.appendChild(el("div", "empty", "Missing mcp.json"));
      } else {
        rootEl.appendChild(el("div", "empty", "No servers defined"));
      }

      rootEl.appendChild(el("div", "section-title", "User servers"));
      if ((us || []).length > 0) {
        filterText(us, function (x) { return x.id + x.kind + x.detail + (x.disabled ? " off disabled" : ""); }).forEach(function (s) {
          rootEl.appendChild(mcpCard(s));
        });
      } else if (state.userMcp === "missing") {
        rootEl.appendChild(el("div", "empty", "Missing user mcp.json"));
      } else {
        rootEl.appendChild(el("div", "empty", "No servers"));
      }
    }
  }

  try {
    updateChrome();
    render();
  } catch (bootErr) {
    try {
      var rootEl = document.getElementById("root");
      var em = bootErr && bootErr.message ? bootErr.message : String(bootErr);
      if (rootEl) {
        rootEl.textContent = "";
        var pe = document.createElement("div");
        pe.className = "empty";
        pe.textContent = "Hub failed to start: " + em;
        rootEl.appendChild(pe);
      }
    } catch (_) {}
  } finally {
    try {
      vscode.postMessage({ type: "ready" });
    } catch (_) {}
  }
})();
  </script>
</body>
</html>`;
}
