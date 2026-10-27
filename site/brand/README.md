# PWF logo

The logo is a heartbeat inside JSON braces: a workout written as data. The SVGs are the source files, and the PNGs were rendered from them.

| Files | Use |
| --- | --- |
| `pwf-mark.svg`, `pwf-mark-2048.png` | The mark, for light backgrounds |
| `pwf-mark-on-dark.svg`, `pwf-mark-on-dark-2048.png` | The mark, for dark backgrounds |
| `pwf-icon.svg`, `pwf-icon-2048.png` | The app icon, an orange rounded square. The website uses it as its favicon |
| `pwf-icon-square.svg`, `pwf-icon-square-2048.png`, `pwf-icon-square-512.png` | The app icon without rounded corners, for places that round or crop it themselves, such as avatars |
| `pwf-icon-192.png`, `pwf-icon-512.png` | The rounded icon at the sizes the web app manifest uses |
| `pwf-social.html`, `pwf-social.png` | The 1280 × 640 preview image for links to the site and for the GitHub repository |

The site's `favicon.ico` (16, 32 and 48 px) and `apple-touch-icon.png` (180 px) are made from the icons, and `site.webmanifest` lists the manifest icons.

## Colours

| Part | On light backgrounds | On dark backgrounds |
| --- | --- | --- |
| Braces | `#1d1d1b` | `#f1efe9` |
| Heartbeat | `#d9481e` | `#f0643a` |
| App icon | White on `#d9481e` | White on `#d9481e` |

## Other sizes

Use the SVG wherever you can. To make a PNG at another size, render the SVG in a browser. ImageMagick's built-in SVG renderer drops the strokes. With headless Chrome, from this folder:

```bash
size=1024 svg=pwf-icon.svg out=pwf-icon-1024.png
printf '<style>body{margin:0}</style><img src="%s" width="%s">' "$PWD/$svg" "$size" > /tmp/logo.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --default-background-color=00000000 --window-size=$size,$size --screenshot="$PWD/$out" file:///tmp/logo.html
```

To render the preview image again after editing `pwf-social.html`:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1280,640 --screenshot="$PWD/pwf-social.png" "file://$PWD/pwf-social.html"
```
