# GitHub web upload batches

This project contains more than 100 files. GitHub web uploads are easier in two passes.

1. Upload Batch 1 first: core HTML/CSS/JS, firmware source/catalogs, tools, workflow, docs and SUPPORT files.
2. Upload Batch 2 second: GLB component models, thumbnails, reference images and icons.
3. Upload both batches to the repository root. The relative paths are already preserved.
4. GitHub web upload replaces same-name files but does not delete removed files. The firmware Action runs `tools/cleanup_repo.py` to remove known obsolete leftovers and refresh `FILE_COUNT.txt`.

Do not rename `FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino`. Stable naming is intentional so future source updates replace the old file.
