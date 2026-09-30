# ZEBJUS V18.3.57 — upload at most 100 files at a time

Extract this ZIP. You will see four UPLOAD folders. This packaging preserves every original application file and path; it does not change runtime code.

| Folder | Files | Vendor files |
| --- | ---: | ---: |
| UPLOAD_01 | 100 | 0 |
| UPLOAD_02 | 100 | 30 |
| UPLOAD_03 | 100 | 100 |
| UPLOAD_04 | 15 | 15 |

## Upload each batch to the SAME repository root

1. Open the repository root containing index.html, app.js and vendor (or the empty repository root for a new project).
2. Add file → Upload files.
3. Open UPLOAD_01 on your computer. Drag its CONTENTS into the upload page, then commit.
4. Return to the SAME repository root and repeat with the CONTENTS of UPLOAD_02, then UPLOAD_03 and UPLOAD_04.
5. Wait until all four batches are uploaded before using the updated app. The vendor files are spread across batches; one vendor batch alone is incomplete.

Do not upload the outer folder or the UPLOAD_01/02/03/04 folders themselves. Those are packaging folders. index.html must be at the repository root; the final vendor path must be vendor/monaco/min/..., not UPLOAD_03/vendor/monaco/min/.... Keep every nested path supplied inside each batch; later batches add files to the same vendor folder. Do not open the repository's vendor folder before uploading a batch containing vendor, as that would create vendor/vendor.

UPLOAD_GUIDE.md and UPLOAD_INVENTORY.json are packing instructions outside the batches; they are not app files to upload. Show hidden files when selecting batch contents so .github and .gitignore are included (Mac Finder: Command+Shift+period). Upload the existing source filenames to replace corresponding old files; do not keep an extra project folder around the uploaded app.

All 315 original project files occur exactly once. Each batch has at most 100 files, including recursively nested files. Every copied file was checked against the original bytes. Combining the four batches gives the unchanged, tested V18.3.57 project with FILE_COUNT.txt = 315 and the same offline asset inventory. GitHub upload/deployment and real kit testing were not performed by this packaging task. This is source plus browser dependencies; firmware binaries still need the build described in the project.

For local use, merge the CONTENTS of the four batches into one empty project folder, preserving subfolders, then use Start_Offline. Do not run an app directly from a single batch.
