# Gia Phả Tông Môn — Quản lý huyết mạch dạng Tree

Web app **local**, không backend, không database — quản lý gia phả/huyết thống
theo phong cách tu tiên/huyền huyễn. Toàn bộ dữ liệu là JSON, chạy hoàn toàn
trong trình duyệt.

## Cách chạy local (khuyến nghị)

Ứng dụng chỉ dùng HTML/CSS/JS thuần (không ES module), nên có thể mở trực tiếp
`index.html`. Tuy nhiên **khuyến nghị chạy qua một HTTP server nhỏ** để tính
năng `fetch("data/data.json")` hoạt động đầy đủ (một số trình duyệt chặn
`fetch` khi mở bằng `file://`):

```bash
cd family-tree   # thư mục chứa index.html
python3 -m http.server 8811
```

Sau đó mở:

```
http://localhost:8811
```

### Mở trực tiếp không cần server

Nếu không muốn chạy server, chỉ cần mở thẳng `index.html` bằng trình duyệt —
app vẫn chạy được nhờ dữ liệu mẫu đã được nhúng sẵn trong `js/seed.js`
(dùng khi không đọc được `data/data.json` qua `file://`).

## Cấu trúc project

```
family-tree/
├── index.html              # khung giao diện, không hard-code dữ liệu
├── style.css                # toàn bộ style (tối giản, dark, chất fantasy)
├── data/
│   └── data.json             # dữ liệu mẫu — nguồn "chuẩn" khi có HTTP server
├── js/
│   ├── seed.js                # bản sao data.json, dùng khi mở qua file://
│   ├── utils.js                # hàm tiện ích (dựng element, toast, download...)
│   ├── store.js                 # toàn bộ tầng dữ liệu: state, validate, CRUD,
│   │                            #   quan hệ, generation, import/export, localStorage
│   ├── layout.js                 # thuật toán tính toạ độ cây (bottom-up width,
│   │                              #   top-down assign) — không đụng tới DOM
│   ├── tree.js                    # render cây ra DOM/SVG + pan/zoom
│   ├── ui.js                       # modal, confirm, popover, form field dùng chung
│   ├── lane-modal.js                # modal "+ Thêm nhân vật ngoài gia phả"
│   ├── character-modal.js            # modal chi tiết nhân vật + các modal liên quan
│   ├── sidebar.js                     # sidebar: danh sách gia phả + cây cảnh giới
│   └── app.js                          # điểm khởi động, nối các module lại
└── README.md
```

## Model dữ liệu (tóm tắt)

```jsonc
{
  "realms": [ { "id": "...", "name": "Luyện Khí", "parentId": null } ],
  "families": [ { "id": "...", "name": "Lý gia", "rootCharacterId": "char_..." } ],
  "characters": [
    {
      "id": "...", "familyId": "...", "generation": 1,
      "name": "Lý Thiên", "gender": "male", "title": "Gia chủ",
      "realmId": "...", "status": "alive", "note": "",
      "inMainTree": true
    }
  ],
  "relationships": [
    { "id": "...", "type": "spouse", "from": "char_A", "to": "char_B", "role": "wife" },
    { "id": "...", "type": "parent", "from": "char_A", "to": "char_C", "role": "son" }
  ]
}
```

Nguyên tắc quan trọng:

- Mọi quan hệ được biểu diễn bằng **ID** trong mảng `relationships`, không có
  circular reference trong JSON.
- Vợ/chồng nằm **cùng đời/cùng hàng** với nhân vật chính (không phải con).
- Khi thêm con từ một node vợ/chồng cụ thể, quan hệ `parent` được tạo **từ
  đúng node đó** (không tự động quy về nhân vật nam chính).
- Nhân vật "ngoài cây" (`inMainTree: false`) vẫn có `generation` hợp lệ nhưng
  không có quan hệ cha/mẹ/con nối vào cây chính — dùng cho các nhân vật cùng
  thời nhưng không cùng huyết thống (thành chủ, ma đầu, đối thủ...).

## Tính năng chính

- **Quản lý nhiều gia phả**: tạo gia phả mới, mỗi gia phả tự có 1 nhân vật đời 1.
- **Cây gia phả trực quan**: pan (kéo), zoom in/out, reset zoom, fit vừa màn hình.
- **Node nhân vật** hiển thị tên, chức danh, cảnh giới, trạng thái; màu theo
  giới tính (xanh = nam, hồng = nữ, xám = không xác định); viền nét đứt = ngoài cây.
- **Popup chi tiết nhân vật**: xem/sửa thông tin, xem quan hệ (cha/mẹ, vợ/chồng,
  con), thêm thành viên phụ thuộc, tách/nối khỏi cây, xoá (có xác nhận và tuỳ
  chọn xoá cả nhánh con cháu).
- **Quản lý cảnh giới** 2 cấp (đại cảnh giới / tiểu cảnh giới): thêm, sửa, xoá
  (chặn xoá nếu còn nhân vật đang dùng), đổi thứ tự.
- **Nhân vật ngoài gia phả**: bấm vào nhãn "Đời N" trên cây để thêm nhân vật
  cùng thế hệ nhưng không thuộc nhánh chính; có thể nối vào cây sau này.
- **Import / Export JSON**: xuất toàn bộ dữ liệu ra file, nhập lại từ file
  (có validate, báo lỗi rõ ràng, không crash app nếu file sai định dạng).
- **Auto-save**: mọi thay đổi tự lưu vào `localStorage`, refresh trang không
  mất dữ liệu.

## Ghi chú kỹ thuật

- Không dùng framework — chỉ HTML/CSS/JS thuần, chia theo module IIFE/class.
- `Layout` tính toạ độ theo thuật toán "đo bề rộng cây con từ dưới lên rồi gán
  toạ độ từ trên xuống" nên các nhánh không chồng lấn dù có nhiều vợ/chồng và
  nhiều con.
- Toàn bộ node/link trong cây được sinh ra từ dữ liệu (`Layout.compute` +
  `TreeView.render`), không có HTML hard-code cho bất kỳ nhân vật nào.
