/**
 * Shared webview chrome: Material 3–inspired elevation + macOS-style grouping
 * (SF system stack, rounded cards, subtle hairlines, accent tint).
 */

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export function kitPageHtml(opts: {
  title: string;
  subtitle?: string;
  /** Raw HTML fragments (already safe / from trusted templates) */
  bodyHtml: string;
}): string {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:;">`;

  const styles = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    min-height: 100%;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    letter-spacing: -0.01em;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    -webkit-font-smoothing: antialiased;
  }
  .kit-bg {
    min-height: 100vh;
    padding: 28px 24px 40px;
    background:
      radial-gradient(1200px 600px at 100% -10%, color-mix(in srgb, var(--vscode-button-background) 12%, transparent), transparent 55%),
      radial-gradient(800px 400px at -5% 110%, color-mix(in srgb, var(--vscode-textLink-foreground) 8%, transparent), transparent 50%),
      var(--vscode-editor-background);
  }
  .kit-header {
    margin-bottom: 24px;
  }
  .kit-kicker {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--vscode-descriptionForeground) 92%, var(--vscode-foreground));
    margin-bottom: 8px;
  }
  .kit-title {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.03em;
    margin: 0 0 6px 0;
    line-height: 1.2;
  }
  .kit-subtitle {
    margin: 0;
    font-size: 13px;
    color: var(--vscode-descriptionForeground);
    max-width: 52ch;
  }
  .kit-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 720px;
  }
  .kit-card {
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 65%, transparent);
    background: color-mix(in srgb, var(--vscode-editor-background) 72%, var(--vscode-sideBar-background));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--vscode-foreground) 4%, transparent),
      0 4px 24px color-mix(in srgb, var(--vscode-widget-shadow) 35%, transparent);
    overflow: hidden;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .kit-card__head {
    padding: 14px 18px 10px;
    border-bottom: 1px solid color-mix(in srgb, var(--vscode-widget-border) 50%, transparent);
    background: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 35%, transparent);
  }
  .kit-card__title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
  }
  .kit-card__body {
    padding: 16px 18px 18px;
  }
  .kit-card__body h2 {
    font-size: 15px;
    font-weight: 600;
    margin: 20px 0 10px 0;
    letter-spacing: -0.02em;
    color: var(--vscode-foreground);
  }
  .kit-card__body h2:first-child { margin-top: 0; }
  .kit-card__body p {
    margin: 0 0 12px 0;
    color: color-mix(in srgb, var(--vscode-foreground) 92%, transparent);
  }
  .kit-card__body p:last-child { margin-bottom: 0; }
  .kit-card__body ul {
    margin: 0 0 12px 0;
    padding-left: 1.15rem;
  }
  .kit-card__body li { margin-bottom: 6px; }
  .kit-card__body blockquote {
    margin: 12px 0;
    padding: 10px 14px;
    border-radius: 10px;
    border-left: 3px solid var(--vscode-textLink-foreground);
    background: color-mix(in srgb, var(--vscode-textLink-foreground) 8%, var(--vscode-editor-background));
    color: var(--vscode-foreground);
  }
  .kit-table-wrap {
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 70%, transparent);
    margin: 12px 0;
  }
  table.kit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .kit-table th {
    text-align: left;
    padding: 10px 12px;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--vscode-descriptionForeground);
    background: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 55%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--vscode-widget-border) 60%, transparent);
  }
  .kit-table td {
    padding: 10px 12px;
    vertical-align: top;
    border-bottom: 1px solid color-mix(in srgb, var(--vscode-widget-border) 45%, transparent);
  }
  .kit-table tr:last-child td { border-bottom: none; }
  .kit-table code {
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--vscode-textPreformat-background) 85%, transparent);
  }
  a.kit-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    margin-right: 12px;
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    color: var(--vscode-button-foreground);
    background: color-mix(in srgb, var(--vscode-button-background) 92%, var(--vscode-foreground));
    box-shadow: 0 1px 2px color-mix(in srgb, var(--vscode-widget-shadow) 40%, transparent);
  }
  a.kit-link:hover {
    filter: brightness(1.06);
  }
  a.kit-link--secondary {
    background: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 80%, transparent);
    color: var(--vscode-foreground);
    border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 55%, transparent);
    box-shadow: none;
  }
  a.kit-inline-link {
    color: var(--vscode-textLink-foreground);
    text-decoration: none;
    font-weight: 500;
  }
  a.kit-inline-link:hover {
    text-decoration: underline;
  }
  .kit-muted {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid color-mix(in srgb, var(--vscode-widget-border) 50%, transparent);
  }
  `;

  const sub = opts.subtitle
    ? `<p class="kit-subtitle">${escAttr(opts.subtitle)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${csp}
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${styles}</style>
</head>
<body>
  <div class="kit-bg">
    <header class="kit-header">
      <div class="kit-kicker">Cloude Code ToolBox</div>
      <h1 class="kit-title">${escAttr(opts.title)}</h1>
      ${sub}
    </header>
    <div class="kit-stack">
      ${opts.bodyHtml}
    </div>
  </div>
</body>
</html>`;
}

/** One titled card wrapping inner HTML */
export function kitCard(title: string, innerHtml: string): string {
  return `<section class="kit-card">
    <div class="kit-card__head"><h2 class="kit-card__title">${escAttr(title)}</h2></div>
    <div class="kit-card__body">${innerHtml}</div>
  </section>`;
}
