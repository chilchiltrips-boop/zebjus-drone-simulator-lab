# GitHub upload • V18.3.44

The ZIP contains one complete `ZEBJUS_V18_3_44_PROJECT_READY` folder. The application and all 3D/image assets live together at its root. Upload the **contents**, including `.github`, into the existing repository root.

If GitHub's web uploader limits a selection to 100 files, select the source/runtime folders and root files first, then upload the remaining `.glb`, `.png` and `.svg` assets to the same repository root. Do not upload a wrapper folder. **Run the firmware workflow manually after both groups are present**; an asset-only second commit does not trigger it. `npm run check` must pass in the assembled repository.

The initial ZIP does not contain a compiled A1/A2 application `.bin`. The GitHub workflow builds both stable filenames only after a successful upload and validation.
