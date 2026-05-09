# Forensic Workbench Dashboard (FWB) — User Guide

FWB is a single-page browser app for forensic review of PDF documents. PDFs are processed locally in your browser; only the page image you choose to examine — together with the prompt you supply — is sent through the configured LLM gateway.

## Quick start

The fastest path is the green **Load Demo Data** button at the top of the hamburger menu (☰, top-right). It fetches a sample prompt library and a test PDF from GitHub so you can try the full workflow without supplying anything.

## Workflow

1. **Drop in PDFs.** Drag one or more PDF files onto the drop zone, or click it to pick files. Multiple PDFs are supported.
2. **Create the summary table.** Click **Create Summary Table**. FWB renders a thumbnail for every page across every loaded PDF and lays them out in a table with five columns: *File, Page, Thumbnail, Notes, LLM Response*.
3. **Open a page.** Click any thumbnail to open that page in a separate viewer window. The same window is reused for subsequent clicks.
4. **Examine the page.** In the viewer:
   - Type a prompt in the textarea, or
   - **Single-click** a saved library prompt to copy it into the textarea, or
   - **Double-click** a library prompt to copy it and run it immediately.
   - Click **Examine page using LLM** to send the rendered page plus the prompt to your configured gateway.
5. **Read the result.** The response appears in the *LLM Response* column of the row whose thumbnail you opened. The viewer also shows it inline.

The *Notes* column is plain editable text — type anything you want to remember about a page.

## Hamburger menu (☰)

### Load Demo Data
Pulls a sample prompt library (`FWB-prompt-library.json`) and a test PDF (`forensic_test_00.pdf`) from GitHub and loads them into the dashboard. Useful for first-time use or for sharing a working demo.

### AI Gateway Settings
- **Gateway Endpoint** — full URL of an `ai_proxy` `/chat` endpoint. The default points at a hosted Cloud Run instance. Override it if you run the gateway locally (typically `http://localhost:8080/chat`).
- The gateway holds provider keys; the browser never sees them.
- If you save the field empty, FWB falls back to the default endpoint.

### Prompt Library
A library is a list of named prompts you can apply to any page.
- **Edit** — opens the library editor in a separate window. Add prompts (name + text), reorder them with the ↑/↓ buttons, edit the selected prompt, or delete entries. Changes sync live to the main window and to any open viewer.
- **Export** — saves the current library as `fwb-prompt-library.json`.
- **Import** — loads a JSON file. Either an array of `{ name, text }` objects, or `{ "prompts": [ ... ] }`.

### User Guide
Opens this document.

## What is and isn't persisted

For now, the gateway endpoint, the prompt library, and any notes you've typed are kept **in memory for the session**. Use **Export** to save your library; **Import** to restore it. The PDF you've loaded and any LLM responses you've generated do not persist either — closing or reloading the page clears them.

Persistence is on the roadmap; this iteration deliberately keeps state explicit.

## Tips

- The viewer caches each PDF after the first thumbnail click, so subsequent clicks on the same file are fast.
- Hover a library pill in the viewer to see the full prompt text in a tooltip.
- High-resolution pages can produce sizable base64 images — if a request fails with a payload error, try a less detailed prompt or a smaller PDF.

## Limitations

- Image input requires the gateway to use the OpenAI provider.
- No OCR for scanned PDFs (pages are sent as rendered images, which most modern vision models handle well).
- Single-row LLM operations only — there is no bulk-apply across rows yet.
