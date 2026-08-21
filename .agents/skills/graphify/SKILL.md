---
name: graphify
description: >-
  Turn any codebase, documentation, and schemas into a persistent, queryable knowledge graph.
  Uses deterministic AST parsing (tree-sitter), Leiden community clustering, and graph traversal
  to map architecture, find god nodes, and trace dependencies with zero hallucinations and minimal token consumption.
---

# 🕸️ Graphify — Codebase Knowledge Graph Engine & Intelligence Layer

> **Official Repository**: [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)  
> **PyPI Package**: `graphifyy` (CLI command: `graphify`)  
> **Architecture**: Local-First • Deterministic AST Parsing (tree-sitter) • Non-Vector Graph • Zero Code Sent to LLM

---

## 🎯 1. KHI NÀO SỬ DỤNG GRAPHIFY (WHEN TO USE GRAPHIFY)

AI Agents nên chủ động kích hoạt Graphify trong các tình huống sau:
1. **Khảo sát Dự án Mới hoặc Tái cấu trúc quy mô lớn**:
   - Nhanh chóng nắm bắt bản đồ kiến trúc tổng thể, các "God Nodes" (điểm nút tập trung nhiều phụ thuộc nhất), và luồng tương tác giữa các module.
2. **Tiết kiệm Token & Tối ưu Context Window**:
   - Thay vì phải liên tục `grep` hoặc đọc thô hàng chục file source code lớn, Agent truy vấn trực tiếp đồ thị tri thức để lấy chính xác các liên kết cần thiết (giảm tới ~70x lượng token tiêu thụ).
3. **Phân tích Phụ thuộc & Đường đi Tương tác (Path Tracing)**:
   - Trả lời các câu hỏi phức tạp: *"Component A gọi Component B qua những tầng nào?"*, *"Sửa file này sẽ ảnh hưởng tới những component nào?"*.
4. **Bảo toàn Ngữ cảnh Đồ thị Xuyên Suốt Phiên Làm Việc (Persistent Context)**:
   - Dữ liệu đồ thị được lưu trong `graphify-out/` và tái sử dụng cho các phiên tiếp theo mà không cần phân tích lại từ đầu.

---

## 🛠️ 2. LỆNH ĐIỀU HÀNH & TRA CỨU (CLI & AGENT COMMANDS)

### 📌 1. Lệnh Tạo & Cập Nhật Đồ Thị
```bash
# Quét và tạo đồ thị toàn bộ workspace
graphify .

# Cập nhật vi sai (chỉ quét các tệp đã sửa đổi)
graphify . --update

# Xuất Wiki tương thích Obsidian
graphify . --wiki
```

### 🔍 2. Lệnh Truy Vấn & Giải Thích Kiến Trúc
```bash
# Truy vấn ngữ cảnh kiến trúc bằng ngôn ngữ tự nhiên
graphify query "How does PlayerContext interact with MobilePlayerBar and LiveWaveformBeatEngine?"

# Tìm đường dẫn phụ thuộc ngắn nhất giữa 2 khái niệm / component
graphify path "PlayerContext" "LiveWaveformBeatEngine"

# Giải thích chi tiết một node / component cụ thể
graphify explain "DesktopPlayerBar"
```

---

## 📂 3. CẤU TRÚC KHO LƯU TRỮ ĐỒ THỊ (`graphify-out/`)

Khi Graphify thực thi, thư mục `graphify-out/` sẽ được khởi tạo với các thành phần cốt lõi:

* 📊 **`graphify-out/graph.html`**:
  Giao diện trực quan hóa mạng lưới 2D/3D (Force-Directed Graph), hỗ trợ phóng to, lọc theo cụm cộng đồng (Leiden communities) và kiểm tra tương tác từng nút.
* 📄 **`graphify-out/GRAPH_REPORT.md`**:
  Báo cáo tổng kết kiến trúc chi tiết, phân loại các nút trung tâm (God Nodes), các liên kết bất ngờ (Surprising Connections), và các câu hỏi đề xuất cho AI.
* 💾 **`graphify-out/graph.json`**:
  Cơ sở dữ liệu đồ thị hoàn chỉnh (Nodes, Edges, Properties, Confidence Tags: `EXTRACTED` vs `INFERRED`) dùng để truy vấn có cấu trúc qua CLI.

---

## ⚙️ 4. HƯỚNG DẪN CÀI ĐẶT MÔI TRƯỜNG (INSTALLATION PROTOCOL)

### Cách 1: Cài đặt qua `uv` (Khuyến nghị)
```bash
uv tool install graphifyy
graphify install --project
```

### Cách 2: Cài đặt qua `pip` / `pipx`
```bash
pip install graphifyy
# hoặc
pipx install graphifyy

graphify install --project
```

---

## 🔒 5. QUY CHUẨN TƯƠNG THÍCH VỚI POSTLAIN VAULT

1. **Tuân thủ Tuyệt đối Invariants**:
   - Quá trình phân tích AST của Graphify không được làm thay đổi mã nguồn logic trong `src/` hoặc can thiệp vào Invariants trong [PROJECT_BRAIN.md](file:///c:/Users/Admin/Documents/hidden-music/PROJECT_BRAIN.md).
2. **Loại trừ Thư mục Rác (`.gitignore`)**:
   - Đảm bảo `graphify-out/` hoặc các tệp cache tạm không làm phình repo Git trừ khi được yêu cầu lưu trữ báo cáo `GRAPH_REPORT.md`.
