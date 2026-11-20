# FORM — interactive demo

FORM is a personal-stylist concept: describe an occasion and it builds three complete
looks around your fit, taste, and budget. This repository is a standalone, front-end-only
demo of that experience, published with GitHub Pages.

**Live site:** https://thomascaruso.github.io/form-interactive-exam/

## What you can do

- **Enter the demo** — "Explore the demo" or "Build my FORM" (four-step setup: photos, style, sizing, budget).
- **Generate looks** — type an occasion or tap a quick chip, then "Style me".
- **Change options** — open a look to swap pieces, change colors, read fit details, and preview a simulated try-on.
- **Revise and compare** — push all three looks in a direction (Lower total, Dressier, More relaxed,
  Darker palette). Each revision is kept as a version (v1, v2, v3…) with a list of what changed and how
  the average total moved, so you can compare, go back, and keep experimenting.
- **Save looks** — heart any look; the Saved board keeps the exact version you saved.
- **Navigate** — Home, Saved, and Your FORM (sidebar on desktop, bottom bar on mobile).

## Notes

- Plain HTML, CSS, and JavaScript — no build step, no backend, no accounts.
- Catalog items are illustrative; nothing is for sale. Uploaded photos stay in the browser tab.
- All asset paths are relative, so the site works from the `/form-interactive-exam/` Pages path.

Run locally: open `index.html`, or `python -m http.server` in this folder.
