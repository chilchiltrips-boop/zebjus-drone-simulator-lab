# GitHub web upload batches — V18.3.36

The downloadable release is **one outer ZIP**. After extraction it contains two upload folders:

1. `BATCH_1_CORE` — 51 core HTML/CSS/JS, firmware source/catalogs, tools, GitHub workflow, docs and SUPPORT files.
2. `BATCH_2_ASSETS` — 54 GLB component models, thumbnails, reference images and icons.

Upload **the contents** of `BATCH_1_CORE` to the repository root first, then upload **the contents** of `BATCH_2_ASSETS` to the same repository root. Do not upload the `BATCH_1_CORE` or `BATCH_2_ASSETS` folder names themselves as repository folders.

GitHub web upload replaces same-name files but does not delete removed files. The firmware Action runs `tools/cleanup_repo.py` to remove known obsolete leftovers and refresh `FILE_COUNT.txt`.

Do not rename `FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino`. Stable naming is intentional so future source updates replace the old file.
