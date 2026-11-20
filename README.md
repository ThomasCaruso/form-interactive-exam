# FORM — your personal stylist

FORM learns your taste, fit, and budget, then builds complete outfits from real pieces.
This repository publishes the FORM app as a website with GitHub Pages.

**Live site:** https://thomascaruso.github.io/form-interactive-exam/

On a computer the app runs inside a phone frame next to a short introduction. On a phone it
opens full screen at [`/app/`](https://thomascaruso.github.io/form-interactive-exam/app/).

## Try it

1. **Teach it your taste.** Pick a department, then say yes or no to eight pieces.
2. **Get your edit.** Choose your size and silhouette; FORM composes looks for you.
3. **Explore.**
   - **For You:** a feed of pieces and complete looks to save or pass.
   - **Edits:** build and keep outfits.
   - **Try On:** stage an outfit for a try-on.
   - **Saved:** your pieces, looks, and wardrobe.
   - **You:** plan your week and refine your style brief.

"Restart the app" on the desktop page clears what the app saved in your browser and starts over.

## About this build

- The app is written in React Native with Expo and exported to static web files. This repo contains
  only that compiled website (`app/`) plus the landing page (`index.html`).
- Everything runs in the browser. There are no accounts, no server, and nothing is purchased.
  Product prices are a guide from the retailer.
- AI try-on needs a private image service, so it is not connected in this public build. The app says so.
- Each app screen has its own entry page, and `404.html` falls back to the app, so reloading any screen works.
