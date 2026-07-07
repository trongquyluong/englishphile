# Englishphile Pilot Database Pack 001

Bộ này là Phase 5.5 content pack để import thử vào Englishphile trước khi sang Phase 6.

## Nội dung

- Individual JSON files: 10
- Problems: 46
- Questions: 220
- Nội dung là original pilot content, không bê nguyên văn từ PDF/tài liệu upload.

## Cách import

1. Đăng nhập bằng tài khoản teacher.
2. Vào `/admin/import`.
3. Chọn `Import JSON`.
4. Paste nội dung file JSON.
5. Bấm `Kiểm tra dữ liệu`.
6. Xem preview.
7. Import với `Publish ngay sau khi import` unchecked nếu muốn đưa vào `NEEDS_REVIEW`, hoặc checked nếu muốn publish ngay.

## Import option

### Cách A — import individual packs
Import từng file 01 đến 10 để giữ sourceCollection riêng cho từng dạng bài.

### Cách B — import all-in-one
Import `00-all-in-one-pilot-pack-001.json` để test nhanh.

Không nên import cả all-in-one lẫn individual packs vì sẽ tạo duplicate warnings.

## Suggested workflow

1. Import unchecked để contentStatus = `NEEDS_REVIEW`.
2. Vào `/admin/review`.
3. Preview từng dạng câu hỏi.
4. Nếu renderer hiển thị đúng, publish từng problem.
5. Ghi chú chỗ nào cần chỉnh schema trước khi tạo content pack lớn hơn.
