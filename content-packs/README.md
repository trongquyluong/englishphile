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

Pronunciation options use the existing `options` JSON field. Each question must
have exactly four canonical A-D options and every option must include one
explicit target span:

```json
{
  "id": "A",
  "text": "example",
  "targetSpan": {
    "start": 0,
    "end": 2
  }
}
```

`start` is inclusive and `end` is exclusive. Both are zero-based Unicode
code-point offsets into the unchanged display `text`, not UTF-16 code-unit or
grapheme-cluster offsets. Option `text` is limited to 200 Unicode code points.
A combining mark therefore counts as its own code point. Never infer or repair
target spans from metadata, answer position,
letter matching, capitalization, phonetic assumptions, dictionaries, or AI.
Normal import can retain structural defects as `NEEDS_REVIEW` warnings, but
publication requires the complete target-span and canonical-answer contract.

Import locally:

```bash
npm run import:pack -- content-packs/pilot-pack-001
```

Audit the repository packs without Prisma or a database:

```bash
npm run audit:content-packs
npm run --silent audit:content-packs -- --format=json
```

The audit and importer share one JSON/CSV file selector. The audit examines the
complete importer-selected directory set, including when `manifest.json` is
absent. When a manifest exists, every selected file must be listed and every
listed file must be selected and present; duplicate, invalid, missing, and
unlisted entries are inventory errors. Numbered split files retain their input
order and take precedence over `00-all-in-one` mirrors when both are present.
The audit then uses the same pure JSON/CSV normalization and type-specific
validation rules as import, without Prisma or a database. See
[`docs/PHASE_2_PRODUCT_CONTENT_AUDIT.md`](../docs/PHASE_2_PRODUCT_CONTENT_AUDIT.md)
for the repository evidence boundary, current inventory, product gaps, and
proposed editorial sequence.

Before authoring a controlled batch, follow
[`docs/PHASE_2_CONTENT_QA_WORKFLOW.md`](../docs/PHASE_2_CONTENT_QA_WORKFLOW.md).
Copy [`CONTENT_PACK_REVIEW_TEMPLATE.md`](CONTENT_PACK_REVIEW_TEMPLATE.md) to
`REVIEW_RECORD.md` inside the new pack and record human linguistic, rendering,
calibration, and approval evidence separately from automated output.
