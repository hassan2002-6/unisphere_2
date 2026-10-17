# Branding assets

## University logo (sign-in page)

`shu-logo.png` is the **official** Salim Habib University logo — the
university's own artwork, extracted at full resolution from the logo file
published on its website (`https://shu.edu.pk/wp-content/uploads/shu-main-logo.svg`,
fetched 2026-10-17) and trimmed to the artwork (crimson “SALIM HABIB UNIVERSITY”
wordmark over the “SHU” monogram with the rose). Nothing here is invented or
redrawn.

Only the raster ships: the site's SVG wrapper masks its embedded image in a way
that renders blank when embedded elsewhere, so the extracted PNG is the display
copy.

The sign-in page renders this file; if it is missing or renamed, a
clearly-labelled dashed “SHU logo” placeholder appears instead. To swap in a
different authorized asset, replace this file keeping the same name; to opt out
of redistributing the logo in this repository, delete it and the placeholder
returns automatically.

## Favicon

The browser icon (`apps/web/src/app/favicon.ico`) is the UniSphere product
placeholder — a crimson square with a white “U”. It is not a university logo
and can be replaced independently of the artwork above.
