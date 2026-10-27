# Phân tích kết quả xúc xắc

Web tĩnh dành cho PC và điện thoại. Sau khi lọc theo 1 hoặc 2 kỳ nhập vào, trang hiển thị lần lượt: các bộ Hoa (ba số trùng nhau) từng xuất hiện ở kỳ tiếp theo, Top 10 kết quả lịch sử, và Top 3 xác suất ước tính từ dữ liệu.

## Dữ liệu

Đặt các file `.json` hoặc `.jsonl` trong `datas/`. Mỗi file có thể là mảng JSON hoặc JSON Lines (mỗi dòng là một đối tượng). Mỗi bản ghi cần có `id`, `date`, `result` gồm ba số từ 1 đến 6, và `total`. Các file được gộp và loại bản ghi trùng `id`; nếu cùng `id` mà nội dung khác nhau, quá trình build dừng để tránh đếm sai. Thứ tự ba số trong một kỳ không quan trọng. Hai kỳ nhập vào vẫn được xét theo thứ tự thời gian. Chỉ các `id` liền nhau mới được tính là các kỳ liên tiếp.

Khi có dữ liệu mới, thêm file vào `datas/` và đẩy commit lên nhánh `main`. GitHub Actions sẽ tạo lại `dist/data.json` và triển khai trang.

## Chạy tại máy

```bash
python scripts/build_data.py
python -m http.server 8000 --directory dist
```

Mở `http://localhost:8000`.

## Triển khai GitHub Pages

Tạo repository GitHub, đẩy mã nguồn lên nhánh `main`, rồi vào **Settings → Pages → Build and deployment → Source: GitHub Actions**. Workflow `.github/workflows/deploy.yml` sẽ triển khai trang. `dist/data.json` được tạo trong quá trình build nên không cần sửa thủ công.

## Cách tính Top 3

Có 56 bộ ba không xét thứ tự. Xác suất lý thuyết của mỗi bộ là số hoán vị của bộ đó chia cho 216. Với `c` lần xuất hiện trong `n` lần khớp, trang hiển thị ước tính `(c + 56 × p_lý_thuyết) / (n + 56)`. Mức làm mượt 56 được cố định để tránh tỷ lệ cực đoan khi có rất ít dữ liệu. Đây là ước tính mô tả, không phải bảo đảm cho kỳ tiếp theo.
