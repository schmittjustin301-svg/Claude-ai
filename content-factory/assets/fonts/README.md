# Bundled fonts

## Anton-Regular.ttf

Anton, designed by Vernon Adams (with later contributions by Kimberly Geswein,
Cyreal and the Google Fonts team). Retrieved from Google Fonts
(`fonts.gstatic.com`).

Licensed under the **SIL Open Font License, Version 1.1**, which permits
bundling and redistribution with software. Full license text:
<https://openfontlicense.org/open-font-license-official-text/>
Font source: <https://fonts.google.com/specimen/Anton>

The font is committed to the repository on purpose: ffmpeg's `drawtext`
filter needs a real font file on disk, and Anton is not installed on a
typical Linux/macOS/Windows host. Bundling it means poster generation
produces identical output on every machine, with no host font setup.
