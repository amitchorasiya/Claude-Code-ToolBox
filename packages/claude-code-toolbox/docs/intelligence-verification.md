# Intelligence — manual verification (context pack vs Copilot Chat)

Use this checklist when validating **GitHub Copilot Toolbox** on a new **VS Code** or **Copilot Chat** version.

Record the build you tested:

- VS Code version: _______________
- GitHub Copilot extension version: _______________
- Kit extension version: _______________

## Pasted `#file:` lines

1. Run **GitHub Copilot Toolbox: Intelligence — build context pack for Chat (copy)** with git/diagnostics **off**.
2. Open Copilot Chat, paste only the **Suggested Chat references** section (the `#file:…` lines) **without** using **Add context**.
3. Ask: “Summarize the file I referenced.”

**Expected (fill in after test):**

- [ ] Model clearly used file content without Add context.
- [ ] Model asked for attachment or failed → users should rely on **Add context** for those builds.

## Add context (control)

1. Clear the chat thread.
2. Use **Add context** to attach the same file(s).
3. Repeat the question.

**Expected:** Reliable access to file content (product baseline).

## Privacy spot-check

1. Enable **Include git** and **Include diagnostics** in the context pack flow.
2. Confirm the generated markdown shows only paths/diagnostics you are willing to send to Copilot before pasting.
