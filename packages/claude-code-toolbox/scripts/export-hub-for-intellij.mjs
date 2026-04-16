/**
 * After `npm run compile`, emits hub HTML for the IntelliJ JCEF shell.
 * Run: node scripts/export-hub-for-intellij.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { getHubWebviewHtml } = require("../out/webview/hubWebviewDocument.js");

const csp = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src https: data:",
  "script-src 'unsafe-inline'",
].join("; ");

let html = getHubWebviewHtml(csp);

/** IntelliJ JCEF does not inject VS Code theme variables — defaults keep color-mix() and controls valid. */
const JCEF_THEME_FALLBACKS = `
      --vscode-foreground: #1e1e1e;
      --vscode-sideBar-background: #e6e6e6;
      --vscode-editor-background: #ffffff;
      --vscode-widget-border: #b0b0b0;
      --vscode-widget-shadow: #000000;
      --vscode-toolbar-hoverBackground: #d0d0d0;
      --vscode-button-background: #0f62fe;
      --vscode-button-foreground: #ffffff;
      --vscode-descriptionForeground: #5c5c5c;
      --vscode-focusBorder: #0f62fe;
      --vscode-font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --vscode-input-background: #ffffff;
      --vscode-input-foreground: #1e1e1e;
      --vscode-textLink-foreground: #0f62fe;
      --vscode-testing-iconPassed: #388a34;
      --vscode-charts-green: #388a34;
      --vscode-list-warningForeground: #b8860b;
      --vscode-editorWarning-foreground: #b8860b;
      --vscode-symbolIcon-classForeground: #007acc;
`;

const rootNeedle = ":root {\n      --pad:";
if (!html.includes(rootNeedle)) {
  console.error("export-hub-for-intellij: expected :root --pad marker not found");
  process.exit(1);
}
html = html.replace(rootNeedle, `:root {\n${JCEF_THEME_FALLBACKS}\n      --pad:`);

const bridgeBeforeMainScript = `  <script>
  (function () {
    window.__cloudePending = [];
    window.cloudeBridgePost = null;
    function acquireVsCodeApi() {
      return {
        postMessage: function (m) {
          var s = JSON.stringify(m);
          if (window.cloudeBridgePost) {
            window.cloudeBridgePost(s);
          } else {
            window.__cloudePending.push(s);
          }
        },
        getState: function () { return null; },
        setState: function () {},
      };
    }
    window.acquireVsCodeApi = acquireVsCodeApi;
  })();
  </script>
`;

const needle = `  <script>\n(function () {\n  var vscode = acquireVsCodeApi();`;
if (!html.includes(needle)) {
  console.error("export-hub-for-intellij: expected hub script marker not found — hubWebviewDocument.ts changed?");
  process.exit(1);
}
html = html.replace(needle, bridgeBeforeMainScript + needle);

const out = join(
  __dirname,
  "..",
  "..",
  "cloude-code-toolbox-intellij",
  "src",
  "main",
  "resources",
  "hub",
  "hub-body.html",
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html, "utf8");
console.log("Wrote", out, "(" + Math.round(html.length / 1024) + " KB)");
