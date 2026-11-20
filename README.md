# FORM — your personal stylist

FORM learns your taste, fit, and budget, then builds complete outfits from real pieces.
This repository publishes FORM as a website with GitHub Pages.

**Live site:** https://thomascaruso.github.io/form-interactive-exam/

## The website

FORM started as a phone app. This build lays it out as a real website on a computer, and keeps the
full-screen app layout on phones.

- **Landing page:** the promise, a looping cover that shows chosen pieces becoming a worn look,
  "How it works", a lookbook of the app's styled looks, and a moving strip of real catalogue
  pieces photographed on models, with prices.
- **Site navigation:** a top bar with For You, Edits, Try On, Saved (with a live count), You, and
  **Start over**, which clears what the site saved in your browser.
- **For You:** a two-column page. The left side has the date, your progress through today's selection,
  the Pieces / Complete looks switch and your recently saved pieces. The right side has the card deck.
- **Keyboard controls** on the deck: `→` save, `←` pass, `Enter` details, `Z` undo.
- **Saved:** a four-column grid of pieces, and looks two across.
- **Onboarding, looks and pieces:** split pages with an editorial photograph beside each step.
  A piece's page shows the retailer's on-model photo of that piece when there is one.

## Try it

1. **Teach it your taste.** Pick a department, then say yes or no to eight pieces.
2. **Get your edit.** Choose your size and silhouette. FORM composes looks for you.
3. **Explore.**
   - **For You:** swipe, click or use the arrow keys to save pieces and complete looks.
   - **Edits:** build and keep outfits.
   - **Try On:** stage an outfit for a try-on.
   - **Saved:** your pieces, looks, and wardrobe.
   - **You:** plan your week and refine your style brief.

## About this build

- FORM uses Expo and React Native Web. The editable app is in `source/`, and the GitHub Pages export is in `app/`.
- Everything runs in the browser. There are no accounts and no server, and nothing is purchased.
  Product prices are a guide from the retailer.
- AI try-on needs a private image service, so it is not connected in this public build. The app says so.
- Each screen has its own entry page, and `404.html` falls back to the app, so reloading any screen works.

## Rebuild from source

Use Node.js 22 LTS and npm. Run these commands from the repository root.

```sh
cd source
npm ci
npm run build:pages
```

The build refreshes the root `app/` export, each route entry page, and `404.html`.
It disables sign-in and clears inherited `EXPO_PUBLIC_*` settings before Expo runs.
The public demo needs no environment files or service credentials.

## Browser tests

From `source/`, install Playwright's Chromium and run the desktop and emulated iPhone tests.

```sh
npx playwright install chromium
npm run test:pages
```

To test an export locally, serve the parent of a checkout named `form-interactive-exam`
on loopback so the repository's GitHub Pages path matches locally. For example, with
Python installed, run `python -m http.server 8000 --bind 127.0.0.1` from that parent.
Then run `npm run test:pages -- http://127.0.0.1:8000/form-interactive-exam/` from `source/`.

## Codex improvement

Codex reproduced a keyboard conflict on the published For You page and updated the
deck so a focused control keeps its keyboard input. With focus off the controls,
the original shortcuts still save, pass, open details, and undo. The browser tests
cover both cases, along with onboarding, navigation, and saved items.
