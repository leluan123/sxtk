# Phân tích kết quả xúc xắc

Web tĩnh dành cho PC và điện thoại. Sau khi lọc theo 1 hoặc 2 kỳ nhập vào, trang hiển thị lần lượt: số kỳ có tổng 6, 15, 17, 4, 5 hoặc 16; các bộ Hoa từng xuất hiện ở kỳ tiếp theo; Top 10 kết quả lịch sử; Top 3 xác suất ước tính toàn cục; Hoa ở các kỳ có phút quay 29, 35, 41, 47 hoặc 53; và số kỳ có đúng một cặp số giống nhau. Mục cặp số loại trừ Hoa và thống kê theo mặt lặp 1–6.

## Dữ liệu

Đặt các file `.json` hoặc `.jsonl` trong `datas/`. Mỗi file có thể là mảng JSON hoặc JSON Lines (mỗi dòng là một đối tượng). Mỗi bản ghi cần có `id`, `date`, `result` gồm ba số từ 1 đến 6, và `total`. Các file được gộp và loại bản ghi trùng `id`; nếu cùng `id` mà nội dung khác nhau, quá trình build dừng để tránh đếm sai. **Thứ tự ba số trong một kỳ được giữ nguyên**, ví dụ `4-1-1` khác `1-4-1`. Hai kỳ nhập vào cũng được xét theo thứ tự thời gian. Chỉ các `id` liền nhau mới được tính là các kỳ liên tiếp.

File dữ liệu hiện không có giờ quay. Mục Hoa theo phút suy ra phút của kỳ từ lịch Bingo18: 159 kỳ/ngày, kỳ đầu 06:05, cách nhau 6 phút, kỳ cuối 21:53. Mốc được xác nhận là kỳ `0193354` lúc 06:05 ngày 28/10/2026. Bộ xử lý dùng mốc này và những ngày có đủ 159 mã kỳ liên tục để suy ra các ngày thiếu bản ghi. Ngày nào không xác định chắc chắn mốc đầu ngày sẽ bị bỏ qua trong riêng mục theo phút, và trang sẽ ghi số kỳ bị bỏ qua. `process_time` là thời điểm xử lý dữ liệu, không được dùng làm giờ quay. [Lịch quay Bingo18 của Vietlott](https://vietlott.vn/vi/choi/bingo/cach-choi).

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

Top 3 được tính độc lập với bộ lọc Top 10. Bộ xử lý đếm tần suất từng mặt 1–6 **riêng cho từng vị trí** trên toàn bộ các kỳ. Với `N` kỳ, xác suất mặt `i` ở một vị trí được ước tính bằng `(số lần mặt i ở vị trí đó + 1) / (N + 6)`. Xác suất của bộ có thứ tự `a-b-c` là tích xác suất của `a` ở vị trí 1, `b` ở vị trí 2 và `c` ở vị trí 3. Tổng xác suất của 216 bộ bằng 100%. Mô hình giả định các vị trí độc lập và tần suất các mặt ổn định; chênh lệch nhỏ có thể chỉ là dao động ngẫu nhiên và không bảo đảm kỳ tiếp theo. Vì không dùng kết quả đã nhập, Top 3 giữ nguyên khi thay bộ lọc.
