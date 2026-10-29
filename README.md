# SAPPHIRE.exe

A fake operating system that tells you who The Sapphire is. Boot it, drag the windows around, poke the terminal, and try not to click the red icon.

Live: **https://blksapphire.vercel.app** (once deployed)

## What's inside

- Boot screen with a typed POST log and a synthesised chime
- Draggable, focusable windows: `about_me.txt`, `work/`, `links`, `terminal`, `recycle_bin`
- A terminal that answers `help`, `whoami`, `ls`, `open`, `cat bio`, `date`, `sudo`, `hack`, `coffee`, `clear`, `exit`
- Taskbar with Lagos time, sound toggle and a plain-text-mode switch
- Easter eggs: a button you should not click, a Konami code, sparkles, an idle screensaver
- Mobile layout: windows become full-screen sheets, icons move into a launcher
- Plain text fallback (`index.html#plain`) for screen readers, no-JS visitors and crawlers

## Privacy

- No account, no backend, no analytics, no cookies, no network calls
- All sound is synthesised with WebAudio; fonts are self-hosted
- The only stored value is `sapphire.audio` (on/off) in `localStorage`
- CSP and security headers in `vercel.json`

## Structure

```
index.html          markup, copy, plain-text fallback
styles.css          pixel/CRT theme, responsive layout
app.js              boot, window manager, terminal, audio, easter eggs
fonts/              Press Start 2P + VT323 (OFL, licences included)
favicon.svg
test/               node:test structural + privacy checks
.github/workflows/  CI: node --test
```

## Run locally

```sh
python3 -m http.server 4173
```

Then open <http://localhost:4173>. There is no build step and no dependencies.

## Test

```sh
npm test        # or: node --test test/
```
