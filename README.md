# VAMA CARA Video Ad Creator

Renders a 25-second luxury ad (version 2 draft; version 1 is kept for reference) for the Export Edition white shirt in the browser and exports a real video file (MP4 where the browser supports it, otherwise WebM). No uploads, no servers, no paid services.

## Folder structure

```
vama-cara-video-ad/
├── index.html                 version 2 (current)
├── app.js                     version 2: all settings and text are in CONFIG at the top
├── style.css
├── index_v1_original.html     version 1, untouched reference
├── app_v1_original.js         version 1, untouched reference
├── README.md
├── CHANGES.md                 exactly what changed from v1 to v2
├── CHANGES_*.diff             line-by-line diffs against v1
└── sale/
    ├── image_1.jpg ... image_5.jpg   (your model photos)
    ├── Vama_Cara_TM_Logo.png         (official logo, supplied)
    └── music.mp3                      (optional)
```

`index.html` must sit in the parent folder of `sale`, as shown.

## Why you need a local server

The page loads your photos from `sale/` and draws them to a canvas to record the video. Browsers treat `file://` pages as having no origin, so the canvas becomes "tainted" and recording produces a blank or blocked video. The app detects this and refuses to render rather than give you an empty file. Serving the folder over `http://localhost` fixes it.

## Run it on Android (Termux, free)

1. Install Termux from F-Droid (the Play Store version is outdated).
2. In Termux run: `pkg install python`
3. Run `termux-setup-storage` and allow access.
4. Copy the whole `vama-cara-video-ad` folder to your phone's Documents or Download folder.
5. In Termux:
   ```
   cd ~/storage/shared/Documents/vama-cara-video-ad
   python -m http.server 8080
   ```
6. Open Chrome and go to `http://localhost:8080`
7. Wait for the five thumbnails to show "Loaded", then tap **Export video**.

Keep Termux running in the background (pull down its notification and tap Acquire wakelock) so Android does not stop the server. Any other free local web server app works too; the only requirement is that the page is opened over http.

Alternative: upload the folder to a free static host (for example Netlify Drop or GitHub Pages) and open that address. Your photos will then be on a public URL, so only do this if that is acceptable.

## Exporting

- Recording is real time: a 24 s ad takes about 25 s. Keep the screen on and stay on the tab. If Chrome goes to the background the export stops and tells you, rather than giving a broken file.
- **Resolution Auto** picks 1280×720 on devices that report low memory or few CPU cores, otherwise 1920×1080. You can force either.
- **Format** is detected from what the browser can actually record. MP4 is used when available, otherwise WebM. The file type is confirmed by reading the file's header, and the extension and label always match the real format.
- When finished you get an inline player, **Download video**, **Open video**, and **Share or save** (only shown if your browser supports sharing files). The result panel shows format, duration, resolution, size and whether music was included.
- Some mobile browsers open a generated video in a player instead of saving it. Use the player's three-dot menu, long-press the video, or use Share or save.

### If you get WebM and need MP4

A browser cannot honestly rename WebM to MP4. Convert it with a video editor, HandBrake, or ffmpeg:

```
ffmpeg -i VAMA-CARA-Export-Edition-1080p.webm -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac VAMA-CARA.mp4
```

Browser-recorded WebM often lacks a seek bar in some players; converting also fixes that.

## Music

Put a royalty-free track at `sale/music.mp3` (change the path in `CONFIG.music`). It is mixed in at the configured volume with a fade in and fade out. If the file is missing or cannot be decoded, the export is a valid silent video. Only use music you are licensed to use.

## Editing text and timing

Open `app.js` and edit `CONFIG`: `copy` (intro and end card text, optional contact line), `shots` (each shot's image, headline `lines`, `feature` caption and camera move), `timeline` (seconds), `logo`, `music`, `fps`, and `images` paths. The `feature` captions are empty on purpose: fill them only with wording copied from the product page's A+ content and description. Keep claims you can support; the defaults make no fabric, origin, certification or discount claims.

## Troubleshooting

| Problem | What to do |
|---|---|
| "files could not be loaded" (photos or logo) | Check the `sale` folder is next to `index.html`, names are exactly `image_1.jpg` to `image_5.jpg` (lowercase, `.jpg`), and the page is opened over http. Tap Reload files. |
| "browser blocks them from the canvas" | You opened the page with `file://`. Use the local server steps above. |
| Preview works but export is not supported | Use a recent Chrome. Other browsers may lack canvas recording. |
| Export stopped: tab went to background | Stay on the tab with the screen on until it finishes. Tap Retry export. |
| Recording is empty or too small | Tap Retry export. Try 1280×720, or Format: WebM only. |
| Export is choppy or the phone gets hot | Choose 1280×720 and close other apps and tabs. |
| No sound | Check the music path and format (MP3 or M4A). The notice under Project files says whether the track was found and decoded. |
| Download opens a player | Use the player menu or long-press the video to save. Or use Share or save. |
| Fonts look different from your design | Text uses the best serif installed on the device (Georgia, Noto Serif and similar). The exact stack is `CONFIG.fontSerif`. |
