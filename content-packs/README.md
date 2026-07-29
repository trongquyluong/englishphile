# Englishphile content packs

Use this folder for clean JSON/CSV packs that are ready for validation and admin review.

Expected structure:

```text
content-packs/
  README.md
  pilot-pack-001/
    manifest.json
    01-pronunciation-pack-001.json
    ...
    10-writing-pack-001.json
```

Guidelines:

- `manifest.json` is optional but recommended.
- Pack files should be `.json` or `.csv` and follow the Englishphile import schema.
- Do not put raw PDF/DOCX files here yet. OCR/PDF extraction is not part of Phase 6.
- `00-all-in-one` files are for quick one-shot import only.
- Do not import a `00-all-in-one` file together with split `01-10` files. The app and CLI prefer split files and ignore `00-all-in-one` when both are present.
- Imported content defaults to `NEEDS_REVIEW`; run QA and preview before publishing.

Import locally:

```bash
npm run import:pack -- content-packs/pilot-pack-001
```

Audit the repository packs without Prisma or a database:

```bash
npm run audit:content-packs
npm run --silent audit:content-packs -- --format=json
```

The audit reads only split JSON files listed in each `manifest.json`; it does not
count `00-all-in-one` mirrors. See
[`docs/PHASE_2_PRODUCT_CONTENT_AUDIT.md`](../docs/PHASE_2_PRODUCT_CONTENT_AUDIT.md)
for the repository evidence boundary, current inventory, product gaps, and
proposed editorial sequence.
