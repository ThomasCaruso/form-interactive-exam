# FORM — your personal stylist

FORM learns your taste, fit, and budget, then builds complete outfits from real pieces.
This repository publishes FORM as a website with GitHub Pages.

**Live site:** https://thomascaruso.github.io/form-interactive-exam/

## The website

FORM started as a phone app. This build lays it out as a real website on a computer, and keeps the
full-screen app layout on phones.

- **Landing page:** the promise, a looping cover that shows chosen pieces becoming a worn look,
  "How it works", and a moving strip of real pieces from the catalogue.
- **Site navigation:** a top bar with For You, Edits, Try On, Saved (with a live count), You, and
  **Start over**, which clears what the site saved in your browser.
- **For You:** a two-column page. The left side has the date, your progress through today's selection,
  the Pieces / Complete looks switch and your recently saved pieces. The right side has the card deck.
- **Keyboard controls** on the deck: `→` save, `←` pass, `Enter` details, `Z` undo.
- **Saved:** a four-column grid of pieces, and looks two across.
- **Onboarding, looks and pieces:** split pages with an editorial photograph beside each step.

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

- The app is written in React Native with Expo and exported to static web files. This repo contains
  only that compiled website (`app/`) and a root page that opens it.
- Everything runs in the browser. There are no accounts and no server, and nothing is purchased.
  Product prices are a guide from the retailer.
- AI try-on needs a private image service, so it is not connected in this public build. The app says so.
- Each screen has its own entry page, and `404.html` falls back to the app, so reloading any screen works.
