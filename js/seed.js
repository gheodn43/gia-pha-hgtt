/**
 * Dữ liệu khởi tạo mặc định (bản nhúng của data/data.json).
 *
 * Lý do tồn tại file này: khi mở trực tiếp index.html bằng giao thức file://
 * trình duyệt sẽ chặn fetch("data/data.json") vì CORS. Ứng dụng sẽ tự động
 * fallback sang SEED_DATA để app luôn chạy được, kể cả khi không có HTTP server.
 *
 * Nếu sửa data/data.json thì nhớ đồng bộ lại nội dung JSON vào biến bên dưới.
 */
const SEED_DATA = {
  "version": 2,
  "meta": {
    "name": "Dữ liệu mẫu - Gia phả tu tiên (nhiều cây huyết thống)",
    "description": "Một gia phả (Lý gia) chứa 3 cây huyết thống độc lập, không có quan hệ với nhau, chỉ dùng chung trục đời khi hiển thị."
  },
  "realms": [
    {
      "id": "realm_luyenkhi",
      "name": "Luyện Khí",
      "parentId": null,
      "order": 0
    },
    {
      "id": "realm_lk_1",
      "name": "Nhất tầng",
      "parentId": "realm_luyenkhi",
      "order": 0
    },
    {
      "id": "realm_lk_2",
      "name": "Nhị tầng",
      "parentId": "realm_luyenkhi",
      "order": 1
    },
    {
      "id": "realm_lk_3",
      "name": "Tam tầng",
      "parentId": "realm_luyenkhi",
      "order": 2
    },
    {
      "id": "realm_lk_4",
      "name": "Viên mãn",
      "parentId": "realm_luyenkhi",
      "order": 3
    },
    {
      "id": "realm_trucco",
      "name": "Trúc Cơ",
      "parentId": null,
      "order": 1
    },
    {
      "id": "realm_tc_1",
      "name": "Sơ kỳ",
      "parentId": "realm_trucco",
      "order": 0
    },
    {
      "id": "realm_tc_2",
      "name": "Trung kỳ",
      "parentId": "realm_trucco",
      "order": 1
    },
    {
      "id": "realm_tc_3",
      "name": "Hậu kỳ",
      "parentId": "realm_trucco",
      "order": 2
    },
    {
      "id": "realm_kimdan",
      "name": "Kim Đan",
      "parentId": null,
      "order": 2
    },
    {
      "id": "realm_kd_1",
      "name": "Sơ kỳ",
      "parentId": "realm_kimdan",
      "order": 0
    },
    {
      "id": "realm_kd_2",
      "name": "Trung kỳ",
      "parentId": "realm_kimdan",
      "order": 1
    },
    {
      "id": "realm_kd_3",
      "name": "Hậu kỳ",
      "parentId": "realm_kimdan",
      "order": 2
    },
    {
      "id": "realm_nguyenanh",
      "name": "Nguyên Anh",
      "parentId": null,
      "order": 3
    },
    {
      "id": "realm_na_1",
      "name": "Sơ kỳ",
      "parentId": "realm_nguyenanh",
      "order": 0
    },
    {
      "id": "realm_na_2",
      "name": "Trung kỳ",
      "parentId": "realm_nguyenanh",
      "order": 1
    },
    {
      "id": "realm_na_3",
      "name": "Hậu kỳ",
      "parentId": "realm_nguyenanh",
      "order": 2
    }
  ],
  "families": [
    {
      "id": "family_ly",
      "name": "Lý gia",
      "note": "Gia tộc tu tiên trấn thủ Thanh Vân thành - gồm nhiều huyết thống cùng tồn tại quanh vùng đất này."
    }
  ],
  "trees": [
    {
      "id": "tree_ly_main",
      "familyId": "family_ly",
      "name": "Huyết thống chính",
      "rootCharacterId": "char_ly_thien",
      "note": ""
    },
    {
      "id": "tree_thanhvan",
      "familyId": "family_ly",
      "name": "Thanh Vân Tông",
      "rootCharacterId": "char_diep_co_thanh",
      "note": "Không cùng huyết thống với Lý gia, root bắt đầu ở đời 2."
    },
    {
      "id": "tree_tan",
      "familyId": "family_ly",
      "name": "Tần thị",
      "rootCharacterId": "char_tan_vo_dao",
      "note": "Không cùng huyết thống với Lý gia, root bắt đầu ở đời 3."
    }
  ],
  "characters": [
    {
      "id": "char_ly_thien",
      "familyId": "family_ly",
      "treeId": "tree_ly_main",
      "generation": 1,
      "name": "Lý Thiên",
      "gender": "male",
      "title": "Gia chủ",
      "realmId": "realm_tc_3",
      "status": "alive",
      "note": "Người sáng lập Lý gia, từng là trưởng lão Thanh Vân Tông."
    },
    {
      "id": "char_lam_nguyet",
      "familyId": "family_ly",
      "treeId": "tree_ly_main",
      "generation": 1,
      "name": "Lâm Nguyệt",
      "gender": "female",
      "title": "Chủ mẫu",
      "realmId": "realm_tc_2",
      "status": "alive",
      "note": "Xuất thân Lâm gia, tinh thông đan đạo."
    },
    {
      "id": "char_tan_dao",
      "familyId": "family_ly",
      "treeId": "tree_ly_main",
      "generation": 1,
      "name": "Tần Dao",
      "gender": "female",
      "title": "Nhị phu nhân",
      "realmId": "realm_lk_4",
      "status": "alive",
      "note": ""
    },
    {
      "id": "char_ly_long",
      "familyId": "family_ly",
      "treeId": "tree_ly_main",
      "generation": 2,
      "name": "Lý Long",
      "gender": "male",
      "title": "Thiếu chủ",
      "realmId": "realm_tc_1",
      "status": "alive",
      "note": "Con trưởng, được kỳ vọng kế thừa gia chủ."
    },
    {
      "id": "char_ly_ho",
      "familyId": "family_ly",
      "treeId": "tree_ly_main",
      "generation": 2,
      "name": "Lý Hổ",
      "gender": "male",
      "title": "Hộ vệ trưởng",
      "realmId": "realm_lk_3",
      "status": "deceased",
      "note": "Tử trận tại Hắc Phong Lĩnh năm 132."
    },
    {
      "id": "char_ly_nguyet",
      "familyId": "family_ly",
      "treeId": "tree_ly_main",
      "generation": 2,
      "name": "Lý Nguyệt",
      "gender": "female",
      "title": "Đại tiểu thư",
      "realmId": "realm_lk_2",
      "status": "alive",
      "note": ""
    },
    {
      "id": "char_ha_thanh_thanh",
      "familyId": "family_ly",
      "treeId": "tree_ly_main",
      "generation": 2,
      "name": "Hạ Thanh Thanh",
      "gender": "female",
      "title": "Thiếu phu nhân",
      "realmId": "realm_lk_4",
      "status": "alive",
      "note": "Ái nữ của Hạ gia ở Lưu Vân thành."
    },
    {
      "id": "char_ly_van",
      "familyId": "family_ly",
      "treeId": "tree_ly_main",
      "generation": 3,
      "name": "Lý Vân",
      "gender": "male",
      "title": "Đích tôn",
      "realmId": "realm_lk_1",
      "status": "alive",
      "note": "Mới mở mạch linh căn năm 8 tuổi."
    },
    {
      "id": "char_diep_co_thanh",
      "familyId": "family_ly",
      "treeId": "tree_thanhvan",
      "generation": 2,
      "name": "Diệp Cô Thành",
      "gender": "male",
      "title": "Đại trưởng lão Thanh Vân Tông",
      "realmId": "realm_kd_3",
      "status": "alive",
      "note": "Root của một cây huyết thống riêng, không liên quan tới Lý gia dù cùng đời với đời 2 của Lý gia."
    },
    {
      "id": "char_diep_phong",
      "familyId": "family_ly",
      "treeId": "tree_thanhvan",
      "generation": 3,
      "name": "Diệp Phong",
      "gender": "male",
      "title": "Đệ tử chân truyền",
      "realmId": "realm_kd_1",
      "status": "alive",
      "note": "Con trai Diệp Cô Thành."
    },
    {
      "id": "char_tan_vo_dao",
      "familyId": "family_ly",
      "treeId": "tree_tan",
      "generation": 3,
      "name": "Tần Vô Đạo",
      "gender": "male",
      "title": "Thành chủ",
      "realmId": "realm_kd_2",
      "status": "alive",
      "note": "Root của một cây huyết thống riêng, đối thủ của Lý gia. Cùng đời 3 với Lý Vân nhưng không cùng huyết thống."
    },
    {
      "id": "char_tan_bat_diet",
      "familyId": "family_ly",
      "treeId": "tree_tan",
      "generation": 4,
      "name": "Tần Bất Diệt",
      "gender": "male",
      "title": "Nhị thiếu chủ",
      "realmId": "realm_lk_2",
      "status": "alive",
      "note": "Con trai Tần Vô Đạo."
    }
  ],
  "relationships": [
    {
      "id": "rel_001",
      "treeId": "tree_ly_main",
      "type": "spouse",
      "from": "char_ly_thien",
      "to": "char_lam_nguyet",
      "role": "wife"
    },
    {
      "id": "rel_002",
      "treeId": "tree_ly_main",
      "type": "spouse",
      "from": "char_ly_thien",
      "to": "char_tan_dao",
      "role": "wife"
    },
    {
      "id": "rel_003",
      "treeId": "tree_ly_main",
      "type": "parent",
      "from": "char_ly_thien",
      "to": "char_ly_long",
      "role": "son"
    },
    {
      "id": "rel_004",
      "treeId": "tree_ly_main",
      "type": "parent",
      "from": "char_lam_nguyet",
      "to": "char_ly_long",
      "role": "son"
    },
    {
      "id": "rel_005",
      "treeId": "tree_ly_main",
      "type": "parent",
      "from": "char_ly_thien",
      "to": "char_ly_ho",
      "role": "son"
    },
    {
      "id": "rel_006",
      "treeId": "tree_ly_main",
      "type": "parent",
      "from": "char_lam_nguyet",
      "to": "char_ly_ho",
      "role": "son"
    },
    {
      "id": "rel_007",
      "treeId": "tree_ly_main",
      "type": "parent",
      "from": "char_ly_thien",
      "to": "char_ly_nguyet",
      "role": "daughter"
    },
    {
      "id": "rel_008",
      "treeId": "tree_ly_main",
      "type": "parent",
      "from": "char_tan_dao",
      "to": "char_ly_nguyet",
      "role": "daughter"
    },
    {
      "id": "rel_009",
      "treeId": "tree_ly_main",
      "type": "spouse",
      "from": "char_ly_long",
      "to": "char_ha_thanh_thanh",
      "role": "wife"
    },
    {
      "id": "rel_010",
      "treeId": "tree_ly_main",
      "type": "parent",
      "from": "char_ly_long",
      "to": "char_ly_van",
      "role": "son"
    },
    {
      "id": "rel_011",
      "treeId": "tree_ly_main",
      "type": "parent",
      "from": "char_ha_thanh_thanh",
      "to": "char_ly_van",
      "role": "son"
    },
    {
      "id": "rel_012",
      "treeId": "tree_thanhvan",
      "type": "parent",
      "from": "char_diep_co_thanh",
      "to": "char_diep_phong",
      "role": "son"
    },
    {
      "id": "rel_013",
      "treeId": "tree_tan",
      "type": "parent",
      "from": "char_tan_vo_dao",
      "to": "char_tan_bat_diet",
      "role": "son"
    }
  ],
  "ui": {
    "activeFamilyId": "family_ly",
    "activeTreeId": "tree_ly_main"
  }
};
