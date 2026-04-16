/**
 * Minimal markdown → HTML for trusted bundled docs (tables, lists, headers, inline).
 */

import { kitCard } from "./modernShell";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="kit-inline-link">$1</a>'
  );
  return t;
}

function tableHtml(lines: string[]): string {
  if (lines.length < 2) {
    return `<p>${inline(lines.join(" "))}</p>`;
  }
  const header = lines[0];
  const bodyRows = lines.slice(2);
  const parseRow = (row: string) =>
    row
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

  const ths = parseRow(header);
  const rows = bodyRows.map(parseRow).filter((r) => r.length > 0);
  let html = '<div class="kit-table-wrap"><table class="kit-table"><thead><tr>';
  for (const h of ths) {
    html += `<th>${inline(h)}</th>`;
  }
  html += "</tr></thead><tbody>";
  for (const r of rows) {
    html += "<tr>";
    for (let j = 0; j < ths.length; j++) {
      html += `<td>${inline(r[j] ?? "")}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table></div>";
  return html;
}

function renderChunk(lines: string[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith("|")) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tbl.push(lines[i]);
        i += 1;
      }
      out.push(tableHtml(tbl));
      continue;
    }
    if (line.startsWith("> ")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        q.push(lines[i].slice(2));
        i += 1;
      }
      out.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      out.push(
        "<ul>" + items.map((it) => `<li>${inline(it)}</li>`).join("") + "</ul>"
      );
      continue;
    }
    if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
      out.push(`<p class="kit-muted">${inline(line.slice(1, -1))}</p>`);
      i += 1;
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
    i += 1;
  }
  return out.join("\n");
}

/** Split markdown by ## sections into Material-style cards */
export function markdownToKitBody(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  if (lines[0]?.startsWith("# ")) {
    i = 1;
  }
  const parts: string[] = [];
  while (i < lines.length) {
    if (!lines[i].trim()) {
      i += 1;
      continue;
    }
    if (lines[i].startsWith("## ")) {
      const title = lines[i].slice(3).trim();
      i += 1;
      const chunk: string[] = [];
      while (i < lines.length && !lines[i].startsWith("## ")) {
        chunk.push(lines[i]);
        i += 1;
      }
      parts.push(kitCard(title, renderChunk(chunk)));
      continue;
    }
    if (lines[i].trim() === "---") {
      i += 1;
      continue;
    }
    const chunk: string[] = [];
    while (
      i < lines.length &&
      !lines[i].startsWith("## ") &&
      lines[i].trim() !== "---"
    ) {
      chunk.push(lines[i]);
      i += 1;
    }
    if (chunk.some((l) => l.trim())) {
      parts.push(kitCard("Overview", renderChunk(chunk)));
    }
  }
  return parts.join("\n");
}
