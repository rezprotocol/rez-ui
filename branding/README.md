# Rez — Final Document Icon + Transparent Logo Pack (Finished)

## What's included

### Transparent logo masters
- `assets/source/rez-icon-mark-transparent.png`
- `assets/source/rez-icon-full-transparent.png`

Also included for reference:
- `assets/source/rez-icon-mark.png` (black background)
- `assets/source/rez-icon-full.png` (black background)

### Rez-branded document icon outputs
- macOS: `assets/doc-icon/mac/rez-doc-icon.icns` + `assets/doc-icon/mac/iconset/*`
- Windows: `assets/doc-icon/win/rez-doc-icon.ico`
- Linux: `assets/doc-icon/linux/rez-doc-icon-*.png`
- Master: `assets/doc-icon/master/rez-doc-icon-master-1024.png`

## Electron (macOS) wiring hint (electron-builder)

Use `extendInfo` and reference the doc icon file name (without extension) in `CFBundleTypeIconFile`:

```json
"mac": {
  "icon": "assets/mac/icon.icns",
  "extendInfo": {
    "CFBundleDocumentTypes": [
      {
        "CFBundleTypeName": "Rez Document",
        "CFBundleTypeExtensions": ["rez"],
        "CFBundleTypeRole": "Editor",
        "CFBundleTypeIconFile": "rez-doc-icon"
      }
    ]
  }
}
```

Ensure `rez-doc-icon.icns` is bundled into your app resources.

## Rebuild script
`scripts/build-doc-icons.py` regenerates mac/win/linux doc icon outputs from the master.

Run:
```bash
python3 scripts/build-doc-icons.py
```
