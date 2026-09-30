# UPLOAD_03 vendor fix — V18.3.57

This ZIP contains only the 100 files from the original UPLOAD_03. The files are split into smaller uploads. Each sub-batch has fewer than 15 MiB of file contents and at most 100 files, including nested folders. File bytes and runtime paths are unchanged.

| Upload folder | Files | Total contents |
| --- | ---: | ---: |
| UPLOAD_03_A | 93 | 14.09 MiB |
| UPLOAD_03_B | 3 | 9.35 MiB |
| UPLOAD_03_C | 3 | 12.91 MiB |
| UPLOAD_03_D | 1 | 5.44 MiB |

1. Extract this ZIP on your computer.
2. Open the SAME GitHub repository root containing index.html and vendor.
3. Add file → Upload files. Open UPLOAD_03_A on your computer and drag its CONTENTS into the upload page. Commit.
4. Return to the repository ROOT and repeat for UPLOAD_03_B, UPLOAD_03_C and UPLOAD_03_D, in order.
5. Continue with the original UPLOAD_04 if it has not been committed. The original UPLOAD_01 and UPLOAD_02 are still required for a complete app; if those were committed successfully, use this patch to complete UPLOAD_03 rather than uploading them again.

**Upload the extracted contents, not this ZIP and not the UPLOAD_03_A/B/C/D folder itself.**
Each sub-batch contains vendor/... paths. Start from the repository root, not inside vendor; otherwise vendor/vendor is created. The final paths must remain vendor/monaco/min/... and vendor/pyodide/....

UPLOAD_03_GUIDE.md and UPLOAD_03_INVENTORY.json are instructions outside the batches and do not need to be uploaded to the repository.

The original UPLOAD_03 was 41.79 MiB in total; the largest individual file was 10.91 MiB. GitHub's documented browser limit is 25 MiB per file and 100 files per upload: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository . Its message alone does not establish which upload stage failed. Smaller batches reduce the amount submitted per commit without changing the code. This package was checked for counts, sizes, paths and byte-for-byte coverage, but an actual GitHub commit was not performed.

If a single-file upload still fails, note the exact filename shown by GitHub. Browser uploads of these extracted files are within the documented per-file limit, so further diagnosis needs the specific failing file or screenshot. GitHub Desktop or a local git push is the other supported upload route.
