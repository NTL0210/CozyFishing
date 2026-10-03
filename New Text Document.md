Bạn là một Chuyên gia Lập trình Game Web (Web Game Developer) và Kỹ sư DevOps. Nhiệm vụ của bạn là hướng dẫn và viết code chi tiết để xây dựng một tựa game web 2D "Cozy Fishing" (Câu cá chữa lành) chạy tĩnh trên trình duyệt (host trên GitHub Pages).

Vui lòng đọc kỹ các ràng buộc hệ thống và yêu cầu thiết kế dưới đây, sau đó triển khai dự án theo TỪNG GIAI ĐOẠN (Phase-by-Phase). 
CẢNH BÁO: KHÔNG viết toàn bộ code vào một lần trả lời. Hãy làm theo đúng thứ tự, xuất code cho Phase 1, sau đó DỪNG LẠI và hỏi tôi có muốn đi tiếp không.

### PHẦN 1: RÀNG BUỘC KỸ THUẬT & THẨM MỸ (CONSTRAINTS)
1. **Công nghệ:** Chỉ sử dụng Vanilla JavaScript (ES6+), HTML5 Canvas hoặc DOM, và CSS3 thuần. Cấu trúc project dùng **Vite** để đóng gói.
2. **Bảo mật:** Giữ `package.json` cực kỳ tối giản. KHÔNG sử dụng thư viện UI/Game ngoài (như Phaser, React) để tránh rủi ro bảo mật và phình to code.
3. **Thẩm mỹ (Anti AI-Slop UI):** Giao diện phải mang nét "cozy, indie". 
   - Dùng CSS thuần với màu sắc pastel, earthy (xanh lá nhạt, nâu gỗ, xanh dương). Nút bấm bo góc (border-radius), đổ bóng phẳng (flat shadow). KHÔNG dùng gradient loè loẹt kiểu AI.
   - Nguồn Asset: Dùng Public Domain (như Kenney.nl). Tạm thời lúc code hãy dùng Emoji hoặc các khối màu (div) để đại diện.
4. **Database (Bắt buộc):** Dùng `IndexedDB` (viết wrapper API thuần, không xài thư viện) để lưu mọi dữ liệu của người chơi (Vàng, Fish-dex, Bẫy cua, Timestamp).
5. **CI/CD:** Có file `.github/workflows/deploy.yml` để tự động build và deploy lên GitHub Pages khi push code lên nhánh `main`.

### PHẦN 2: THIẾT KẾ GAMEPLAY & TÍNH NĂNG (FEATURES)
1. **Minigame Câu Cá (Tension Bar):**
   - 4 Trạng thái: IDLE ➔ WAITING ➔ REELING ➔ CAUGHT.
   - Khi cá cắn câu (WAITING kết thúc), xuất hiện minigame Tension Bar (REELING). Người chơi giữ/thả chuột để điều khiển thanh màu xanh giữ con cá ở bên trong. Tốc độ di chuyển của icon cá phụ thuộc vào độ hiếm.
2. **Môi trường & Thời tiết:**
   - Chu kỳ Ngày/Đêm dựa trên giờ hệ thống máy tính. Ban đêm nhạc nền đổi, màu sắc tối đi, xuất hiện cá dị thường.
   - Thời tiết ngẫu nhiên (Ví dụ: Mưa làm thanh câu trơn hơn nhưng tăng tỉ lệ cá hiếm).
3. **Cửa hàng (Shop) & Bách khoa (Fish-dex):**
   - Shop: Mua mồi câu (thay đổi trọng số thuật toán RNG Loot Table) và nâng cấp Cần câu.
   - Fish-dex: Sổ tay hiển thị dạng lưới lưu trữ các loại cá đã câu (Tên, Hình ảnh, Số lượng, Kỷ lục, Câu mô tả tấu hài).
4. **Cơ chế Giữ chân (Retention Mechanics):**
   - **Bảng nhiệm vụ:** Mỗi ngày random 3 nhiệm vụ (ví dụ: Câu 5 cá chép, Bắt 1 rác). Xong được thưởng vàng.
   - **Bẫy Cua (Offline Idle Progress):** Khi tắt web, lưu Timestamp vào Database. Khi bật lại, lấy (Giờ hiện tại - Giờ tắt) để tính phần thưởng Offline (cứ 30 phút rớt 1 vật phẩm vào bẫy cua).
   - **Mở khóa Bản đồ (Zones):** Dùng vàng mua vé đổi map (Ví dụ: Ao Làng ➔ Hồ Sương Mù). Đổi map sẽ đổi màu nền và đổi mảng Cá trong thuật toán RNG.

### PHẦN 3: KẾ HOẠCH TRIỂN KHAI (CHỈ CODE THEO THỨ TỰ NÀY)

**PHASE 1: Khởi tạo Project & DevOps**
- Cung cấp cấu trúc thư mục project Vite.
- Cung cấp nội dung file `package.json` siêu gọn nhẹ.
- Viết file `.github/workflows/deploy.yml` chuẩn để deploy.

**PHASE 2: Hệ thống Database (IndexedDB) & Giao diện cơ bản**
- Viết file `storage.js` bao gồm Schema lưu trữ đầy đủ: `{ coins, currentBait, unlockedBaits, currentZone, unlockedZones, fishDex: {}, crabPots: { placeTime, loot: [] }, quests: [] }`.
- Viết `index.html` và `style.css` (Màn hình chính, Hồ nước, UI Thanh trạng thái). CSS tuân thủ phong cách Pastel, Cozy.

**PHASE 3: Core Game Loop & Minigame Tension Bar**
- Viết `game.js`. Xây dựng State Machine cho 4 trạng thái câu cá.
- Viết hàm Minigame Tension Bar dùng `requestAnimationFrame`.
- Viết hệ thống RNG Loot Table sinh ra cá/rác cơ bản.

**PHASE 4: Môi trường, Shop & Fish-dex**
- Viết logic chuyển đổi Ngày/Đêm & Thời tiết.
- Cập nhật HTML/CSS thêm Modal cho Cửa hàng và Fish-dex.
- Cập nhật thuật toán RNG để Mồi câu (Bait) thay đổi được tỉ lệ ra cá hiếm.
- Cập nhật hàm lưu cá mới vào Fish-dex khi câu thành công.

**PHASE 5: Offline Idle (Bẫy cua), Nhiệm vụ & Đổi Map**
- Viết logic tính toán Timestamp cho Bẫy Cua offline ngay khi load game.
- Render UI hiển thị Bẫy cua có đồ.
- Viết logic tạo và kiểm tra Nhiệm vụ hàng ngày.
- Viết logic đổi màu nền và đổi mảng cá RNG khi người chơi chuyển Zone.

**Bây giờ, hãy bắt đầu thực hiện PHASE 1. Hãy đưa ra các file code, sau đó DỪNG LẠI và chờ tôi phản hồi "Tiếp tục" thì mới làm Phase 2.**