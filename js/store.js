/**
 * Store - toàn bộ tầng dữ liệu (state, quan hệ, validate, persistence).
 *
 * Mô hình: một gia phả (family) có thể chứa NHIỀU cây huyết thống (tree) độc
 * lập. Mỗi nhân vật thuộc đúng một tree (và family của tree đó). Hai tree
 * không có quan hệ/edge nối với nhau — chỉ dùng chung một trục "đời"
 * (generation) khi hiển thị.
 *
 * Nguyên tắc:
 *  - State luôn là JSON thuần (không object reference vòng), dễ export/import.
 *  - Mọi quan hệ biểu diễn bằng ID trong mảng `relationships`, không bao giờ
 *    nối hai nhân vật khác `treeId`.
 *  - `generation` là thuộc tính toàn cục của nhân vật: root của một tree có
 *    thể là đời 1, 4, 8... tuỳ người dùng chọn khi tạo tree, KHÔNG mặc định
 *    ép về 1.
 *  - Mọi thay đổi đi qua commit() -> lưu localStorage -> phát sự kiện -> UI re-render.
 */

const GENDER_LABELS = { male: 'Nam', female: 'Nữ', unknown: 'Không xác định' };
const STATUS_LABELS = { alive: 'Còn sống', deceased: 'Đã chết' };
const SPOUSE_ROLE_LABELS = { wife: 'Vợ', husband: 'Chồng', partner: 'Bạn đời' };
const CHILD_ROLE_LABELS = { son: 'Con trai', daughter: 'Con gái', adopted: 'Con nuôi' };

/** Các loại quan hệ có thể chọn khi "Thêm thành viên phụ thuộc" */
const RELATION_OPTIONS = [
  { value: 'wife', kind: 'spouse', label: 'Vợ', defaultGender: 'female' },
  { value: 'husband', kind: 'spouse', label: 'Chồng', defaultGender: 'male' },
  { value: 'partner', kind: 'spouse', label: 'Bạn đời', defaultGender: 'unknown' },
  { value: 'son', kind: 'child', label: 'Con trai', defaultGender: 'male' },
  { value: 'daughter', kind: 'child', label: 'Con gái', defaultGender: 'female' },
  { value: 'adopted', kind: 'child', label: 'Con nuôi', defaultGender: 'unknown' },
];

const STORAGE_KEY = 'giapha.tu-tien.v2';

class Store {
  constructor() {
    this.state = null;
    this.listeners = new Set();
  }

  /* ------------------------------------------------------------------ *
   * Khởi tạo & persistence
   * ------------------------------------------------------------------ */

  /**
   * Thứ tự nạp dữ liệu: localStorage -> data/data.json -> SEED_DATA nhúng sẵn.
   * @returns {Promise<'local'|'file'|'seed'>} nguồn dữ liệu đã dùng
   */
  async init() {
    const cached = this.#loadFromStorage();
    if (cached) {
      this.state = cached;
      this.#emit();
      return 'local';
    }

    try {
      const res = await fetch('data/data.json', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const check = Store.validate(json);
        if (check.ok) {
          this.state = Store.normalize(json);
          this.commit();
          return 'file';
        }
      }
    } catch (err) {
      /* file:// hoặc không có server -> dùng SEED_DATA bên dưới */
    }

    this.state = Store.normalize(Utils.clone(typeof SEED_DATA !== 'undefined' ? SEED_DATA : Store.emptyState()));
    this.commit();
    return 'seed';
  }

  #loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const check = Store.validate(parsed);
      if (!check.ok) {
        console.warn('Dữ liệu localStorage không hợp lệ, bỏ qua:', check.errors);
        return null;
      }
      return Store.normalize(parsed);
    } catch (err) {
      console.warn('Không đọc được localStorage:', err);
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) {
      console.warn('Không lưu được localStorage:', err);
    }
  }

  /** Lưu + báo cho UI re-render */
  commit() {
    this.save();
    this.#emit();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #emit() {
    for (const fn of this.listeners) fn(this.state);
  }

  resetToSeed() {
    this.state = Store.normalize(Utils.clone(typeof SEED_DATA !== 'undefined' ? SEED_DATA : Store.emptyState()));
    this.commit();
  }

  /* ------------------------------------------------------------------ *
   * Validate & normalize
   * ------------------------------------------------------------------ */

  static emptyState() {
    return { version: 2, realms: [], families: [], trees: [], characters: [], relationships: [], ui: {} };
  }

  /** Kiểm tra format tối thiểu của một file JSON trước khi nạp */
  static validate(data) {
    const errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, errors: ['Dữ liệu gốc phải là một object JSON.'] };
    }
    for (const key of ['families', 'trees', 'characters', 'relationships', 'realms']) {
      if (!Array.isArray(data[key])) errors.push(`Trường "${key}" bị thiếu hoặc không phải mảng.`);
    }
    if (errors.length) return { ok: false, errors };

    const seen = new Set();
    const checkId = (item, label, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`${label}[${index}] không phải object.`);
        return false;
      }
      if (typeof item.id !== 'string' || !item.id) {
        errors.push(`${label}[${index}] thiếu "id".`);
        return false;
      }
      if (seen.has(item.id)) errors.push(`Trùng id: "${item.id}".`);
      seen.add(item.id);
      return true;
    };

    data.realms.forEach((r, i) => {
      if (checkId(r, 'realms', i) && typeof r.name !== 'string') errors.push(`realms[${i}] thiếu "name".`);
    });
    data.families.forEach((f, i) => {
      if (checkId(f, 'families', i) && typeof f.name !== 'string') errors.push(`families[${i}] thiếu "name".`);
    });
    data.trees.forEach((t, i) => {
      if (!checkId(t, 'trees', i)) return;
      if (typeof t.name !== 'string') errors.push(`trees[${i}] thiếu "name".`);
      if (typeof t.familyId !== 'string') errors.push(`trees[${i}] thiếu "familyId".`);
    });
    data.characters.forEach((c, i) => {
      if (!checkId(c, 'characters', i)) return;
      if (typeof c.name !== 'string') errors.push(`characters[${i}] thiếu "name".`);
      if (typeof c.familyId !== 'string') errors.push(`characters[${i}] thiếu "familyId".`);
      if (typeof c.treeId !== 'string') errors.push(`characters[${i}] thiếu "treeId".`);
    });
    data.relationships.forEach((r, i) => {
      if (!checkId(r, 'relationships', i)) return;
      if (!['spouse', 'parent'].includes(r.type)) errors.push(`relationships[${i}] có type không hợp lệ: "${r.type}".`);
      if (typeof r.from !== 'string' || typeof r.to !== 'string') errors.push(`relationships[${i}] thiếu "from"/"to".`);
      else if (r.from === r.to) errors.push(`relationships[${i}] tự trỏ vào chính nó.`);
    });

    return { ok: errors.length === 0, errors: errors.slice(0, 12) };
  }

  /** Dọn dẹp dữ liệu: bù field thiếu, bỏ quan hệ mồ côi/liên-tree, tính lại đời */
  static normalize(input) {
    const data = Utils.clone(input);
    data.version = 2;
    data.ui = data.ui && typeof data.ui === 'object' ? data.ui : {};

    /* --- Cảnh giới: chỉ hỗ trợ 2 cấp (đại / tiểu) --- */
    const realmIds = new Set((data.realms || []).map((r) => r.id));
    data.realms = (data.realms || []).map((r, i) => ({
      id: r.id,
      name: String(r.name ?? '').trim() || 'Cảnh giới',
      parentId: r.parentId && realmIds.has(r.parentId) && r.parentId !== r.id ? r.parentId : null,
      order: Number.isFinite(r.order) ? r.order : i,
    }));
    const realmById = new Map(data.realms.map((r) => [r.id, r]));
    for (const realm of data.realms) {
      // Nếu cha lại có cha -> kéo lên làm con của đại cảnh giới gốc
      let guard = 0;
      while (realm.parentId && realmById.get(realm.parentId)?.parentId && guard < 10) {
        realm.parentId = realmById.get(realm.parentId).parentId;
        guard += 1;
      }
    }

    /* --- Gia phả (family không còn giữ rootCharacterId - giờ thuộc tree) --- */
    data.families = (data.families || []).map((f) => ({
      id: f.id,
      name: String(f.name ?? '').trim() || 'Gia phả',
      note: typeof f.note === 'string' ? f.note : '',
    }));
    if (!data.families.length) {
      data.families.push({ id: Utils.uid('family'), name: 'Gia phả mới', note: '' });
    }
    const familyIds = new Set(data.families.map((f) => f.id));
    const fallbackFamilyId = data.families[0].id;

    /* --- Cây huyết thống --- */
    data.trees = (data.trees || []).map((t) => ({
      id: t.id,
      familyId: familyIds.has(t.familyId) ? t.familyId : fallbackFamilyId,
      name: String(t.name ?? '').trim() || 'Huyết thống',
      rootCharacterId: typeof t.rootCharacterId === 'string' ? t.rootCharacterId : null,
      note: typeof t.note === 'string' ? t.note : '',
    }));

    /* --- Nhân vật: bắt buộc thuộc một tree hợp lệ, familyId luôn suy ra từ tree --- */
    const treeById = new Map(data.trees.map((t) => [t.id, t]));
    data.characters = (data.characters || [])
      .map((c) => {
        const tree = treeById.get(c.treeId);
        if (!tree) return null; // nhân vật mồ côi tree -> loại bỏ, không thể đoán thuộc cây nào
        return {
          id: c.id,
          familyId: tree.familyId,
          treeId: tree.id,
          generation: Math.max(1, Math.round(Number(c.generation) || 1)),
          name: String(c.name ?? '').trim() || 'Vô Danh',
          gender: GENDER_LABELS[c.gender] ? c.gender : 'unknown',
          title: typeof c.title === 'string' ? c.title : '',
          realmId: c.realmId && realmById.has(c.realmId) ? c.realmId : null,
          status: STATUS_LABELS[c.status] ? c.status : 'alive',
          note: typeof c.note === 'string' ? c.note : '',
        };
      })
      .filter(Boolean);
    const charById = new Map(data.characters.map((c) => [c.id, c]));

    /* --- Quan hệ: bỏ quan hệ mồ côi / tự trỏ / khác tree / trùng lặp --- */
    const relSeen = new Set();
    data.relationships = (data.relationships || [])
      .map((r) => {
        const from = charById.get(r.from);
        const to = charById.get(r.to);
        if (!from || !to) return null;
        if (from.id === to.id) return null;
        if (from.treeId !== to.treeId) return null; // §1: không có quan hệ giữa hai tree
        const type = r.type === 'spouse' ? 'spouse' : 'parent';
        const key =
          type === 'spouse'
            ? `spouse:${[from.id, to.id].sort().join('|')}`
            : `parent:${from.id}|${to.id}`;
        if (relSeen.has(key)) return null;
        relSeen.add(key);
        const role =
          type === 'spouse'
            ? (SPOUSE_ROLE_LABELS[r.role] ? r.role : 'partner')
            : (CHILD_ROLE_LABELS[r.role] ? r.role : 'son');
        return { id: r.id, treeId: from.treeId, type, from: from.id, to: to.id, role };
      })
      .filter(Boolean);

    /* --- Mỗi tree cần rootCharacterId hợp lệ (nếu còn thành viên) --- */
    for (const tree of data.trees) {
      const members = data.characters.filter((c) => c.treeId === tree.id);
      const rootValid = tree.rootCharacterId && charById.get(tree.rootCharacterId)?.treeId === tree.id;
      if (!rootValid) {
        tree.rootCharacterId = members.length
          ? members.slice().sort((a, b) => a.generation - b.generation)[0].id
          : null;
      }
    }

    /* --- Mỗi gia phả cần ít nhất một cây để UI luôn có chỗ hiển thị --- */
    for (const family of data.families) {
      const hasTree = data.trees.some((t) => t.familyId === family.id);
      if (!hasTree) {
        data.trees.push({ id: Utils.uid('tree'), familyId: family.id, name: 'Huyết thống chính', rootCharacterId: null, note: '' });
      }
    }

    if (!data.families.some((f) => f.id === data.ui.activeFamilyId)) {
      data.ui.activeFamilyId = data.families[0].id;
    }
    const activeFamilyTrees = data.trees.filter((t) => t.familyId === data.ui.activeFamilyId);
    if (!activeFamilyTrees.some((t) => t.id === data.ui.activeTreeId)) {
      data.ui.activeTreeId = activeFamilyTrees[0]?.id ?? null;
    }

    const store = new Store();
    store.state = data;
    for (const tree of data.trees) store.recomputeGenerations(tree.id);
    return data;
  }

  /* ------------------------------------------------------------------ *
   * Truy vấn cơ bản
   * ------------------------------------------------------------------ */

  get families() {
    return this.state.families;
  }

  get trees() {
    return this.state.trees;
  }

  get characters() {
    return this.state.characters;
  }

  get relationships() {
    return this.state.relationships;
  }

  get realms() {
    return this.state.realms;
  }

  get activeFamilyId() {
    return this.state.ui.activeFamilyId;
  }

  get activeTreeId() {
    return this.state.ui.activeTreeId;
  }

  setActiveFamily(familyId) {
    if (!this.getFamily(familyId)) return;
    this.state.ui.activeFamilyId = familyId;
    const trees = this.treesOfFamily(familyId);
    this.state.ui.activeTreeId = trees[0]?.id ?? null;
    this.commit();
  }

  setActiveTree(treeId) {
    const tree = this.getTree(treeId);
    if (!tree) return;
    this.state.ui.activeFamilyId = tree.familyId;
    this.state.ui.activeTreeId = treeId;
    this.commit();
  }

  getFamily(id) {
    return this.state.families.find((f) => f.id === id) || null;
  }

  getTree(id) {
    return this.state.trees.find((t) => t.id === id) || null;
  }

  getCharacter(id) {
    return this.state.characters.find((c) => c.id === id) || null;
  }

  charactersOfFamily(familyId) {
    return this.state.characters.filter((c) => c.familyId === familyId);
  }

  charactersOfTree(treeId) {
    return this.state.characters.filter((c) => c.treeId === treeId);
  }

  treesOfFamily(familyId) {
    return this.state.trees.filter((t) => t.familyId === familyId);
  }

  /** @returns {{id:string, role:string, relId:string}[]} vợ/chồng của một nhân vật */
  spousesOf(id) {
    const out = [];
    for (const rel of this.state.relationships) {
      if (rel.type !== 'spouse') continue;
      if (rel.from === id) out.push({ id: rel.to, role: rel.role, relId: rel.id });
      else if (rel.to === id) out.push({ id: rel.from, role: Store.mirrorSpouseRole(rel.role, this.getCharacter(rel.from)), relId: rel.id });
    }
    return out;
  }

  /** Vai trò ngược lại: nếu B là "vợ" của A thì A là "chồng" của B (suy từ giới tính khi cần) */
  static mirrorSpouseRole(role, character) {
    if (character?.gender === 'male') return 'husband';
    if (character?.gender === 'female') return 'wife';
    return role === 'wife' ? 'husband' : role === 'husband' ? 'wife' : 'partner';
  }

  /** @returns {{id:string, role:string, relId:string}[]} con của một nhân vật */
  childrenOf(id) {
    return this.state.relationships
      .filter((r) => r.type === 'parent' && r.from === id)
      .map((r) => ({ id: r.to, role: r.role, relId: r.id }));
  }

  /** @returns {{id:string, role:string, relId:string}[]} cha/mẹ của một nhân vật */
  parentsOf(id) {
    return this.state.relationships
      .filter((r) => r.type === 'parent' && r.to === id)
      .map((r) => ({ id: r.from, role: r.role, relId: r.id }));
  }

  /** Cha/mẹ đã có, phân theo giới tính (dùng để quyết định hiện nút "+ Thêm cha/mẹ") */
  parentsByGender(id) {
    const parents = this.parentsOf(id).map((p) => this.getCharacter(p.id)).filter(Boolean);
    return {
      father: parents.find((c) => c.gender === 'male') || null,
      mother: parents.find((c) => c.gender === 'female') || null,
      total: parents.length,
    };
  }

  /** Vai trò hiển thị trên node: Vợ / Chồng / Con trai ... */
  displayRoleOf(id) {
    const parents = this.parentsOf(id);
    if (parents.length) return CHILD_ROLE_LABELS[parents[0].role] || null;
    const spouses = this.spousesOf(id);
    if (spouses.length) {
      const char = this.getCharacter(id);
      if (char?.gender === 'female') return 'Vợ';
      if (char?.gender === 'male') return 'Chồng';
      return 'Bạn đời';
    }
    return null;
  }

  /** A có phải tổ tiên của B? Dùng để chặn quan hệ vòng. */
  isAncestor(ancestorId, descendantId) {
    const stack = [descendantId];
    const seen = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      for (const parent of this.parentsOf(current)) {
        if (parent.id === ancestorId) return true;
        stack.push(parent.id);
      }
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   * Đời (generation)
   * ------------------------------------------------------------------ */

  /**
   * Tính lại `generation` cho các nhân vật trong MỘT tree.
   * BFS xuất phát từ root của tree, dùng đúng generation HIỆN TẠI của root
   * làm điểm khởi đầu (không ép về 1) - root có thể là đời 1, 4, 8...
   */
  recomputeGenerations(treeId) {
    const tree = this.getTree(treeId);
    if (!tree) return;
    const members = this.charactersOfTree(treeId);
    if (!members.length) return;

    const gen = new Map();
    const bfs = (startId, startGen) => {
      const queue = [[startId, startGen]];
      let guard = 0;
      const limit = members.length * members.length + 100;
      while (queue.length && guard < limit) {
        guard += 1;
        const [id, g] = queue.shift();
        if (gen.has(id) && gen.get(id) >= g) continue;
        gen.set(id, g);
        for (const spouse of this.spousesOf(id)) {
          const sc = this.getCharacter(spouse.id);
          if (sc?.treeId === treeId && !gen.has(spouse.id)) queue.push([spouse.id, g]);
        }
        for (const child of this.childrenOf(id)) {
          const cc = this.getCharacter(child.id);
          if (cc?.treeId === treeId && (!gen.has(child.id) || gen.get(child.id) < g + 1)) {
            queue.push([child.id, g + 1]);
          }
        }
      }
    };

    const root = tree.rootCharacterId ? this.getCharacter(tree.rootCharacterId) : null;
    if (root && root.treeId === treeId) bfs(root.id, root.generation);
    // Các nhánh rời rạc (do xoá node ở giữa): giữ đời hiện tại làm gốc
    for (const member of members.slice().sort((a, b) => a.generation - b.generation)) {
      if (!gen.has(member.id)) bfs(member.id, Math.max(1, member.generation));
    }
    for (const member of members) {
      if (gen.has(member.id)) member.generation = gen.get(member.id);
    }
  }

  /** Khoảng đời [min,max] đang tồn tại trong TOÀN BỘ gia phả (mọi tree cộng lại) */
  familyGenerationRange(familyId) {
    const chars = this.charactersOfFamily(familyId);
    if (!chars.length) return { min: 1, max: 1 };
    return chars.reduce(
      (acc, c) => ({ min: Math.min(acc.min, c.generation), max: Math.max(acc.max, c.generation) }),
      { min: Infinity, max: -Infinity },
    );
  }

  /* ------------------------------------------------------------------ *
   * Gia phả
   * ------------------------------------------------------------------ */

  createFamily(name, rootName = 'Thủy tổ') {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Tên gia phả không được để trống.');
    const family = { id: Utils.uid('family'), name: cleanName, note: '' };
    const tree = { id: Utils.uid('tree'), familyId: family.id, name: 'Huyết thống chính', rootCharacterId: null, note: '' };
    const root = {
      id: Utils.uid('char'),
      familyId: family.id,
      treeId: tree.id,
      generation: 1,
      name: String(rootName || '').trim() || 'Thủy tổ',
      gender: 'unknown',
      title: 'Gia chủ',
      realmId: null,
      status: 'alive',
      note: '',
    };
    tree.rootCharacterId = root.id;
    this.state.families.push(family);
    this.state.trees.push(tree);
    this.state.characters.push(root);
    this.state.ui.activeFamilyId = family.id;
    this.state.ui.activeTreeId = tree.id;
    this.commit();
    return family;
  }

  updateFamily(id, patch) {
    const family = this.getFamily(id);
    if (!family) return;
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new Error('Tên gia phả không được để trống.');
      family.name = name;
    }
    if (patch.note !== undefined) family.note = String(patch.note);
    this.commit();
  }

  deleteFamily(id) {
    if (this.state.families.length <= 1) {
      throw new Error('Phải còn ít nhất một gia phả.');
    }
    const treeIds = new Set(this.treesOfFamily(id).map((t) => t.id));
    this.state.families = this.state.families.filter((f) => f.id !== id);
    this.state.trees = this.state.trees.filter((t) => t.familyId !== id);
    this.state.characters = this.state.characters.filter((c) => c.familyId !== id);
    this.state.relationships = this.state.relationships.filter((r) => !treeIds.has(r.treeId));
    if (this.state.ui.activeFamilyId === id) {
      this.state.ui.activeFamilyId = this.state.families[0].id;
      this.state.ui.activeTreeId = this.treesOfFamily(this.state.ui.activeFamilyId)[0]?.id ?? null;
    }
    this.commit();
  }

  /* ------------------------------------------------------------------ *
   * Cây huyết thống
   * ------------------------------------------------------------------ */

  /** Tạo một cây huyết thống mới, root có thể bắt đầu ở BẤT KỲ đời nào (§6). */
  createTree(familyId, name, startGeneration, rootName = 'Thủy tổ') {
    const family = this.getFamily(familyId);
    if (!family) throw new Error('Không tìm thấy gia phả.');
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Tên cây huyết thống không được để trống.');
    const generation = Math.max(1, Math.round(Number(startGeneration) || 1));
    const tree = { id: Utils.uid('tree'), familyId, name: cleanName, rootCharacterId: null, note: '' };
    const root = {
      id: Utils.uid('char'),
      familyId,
      treeId: tree.id,
      generation,
      name: String(rootName || '').trim() || 'Thủy tổ',
      gender: 'unknown',
      title: '',
      realmId: null,
      status: 'alive',
      note: '',
    };
    tree.rootCharacterId = root.id;
    this.state.trees.push(tree);
    this.state.characters.push(root);
    this.state.ui.activeFamilyId = familyId;
    this.state.ui.activeTreeId = tree.id;
    this.commit();
    return tree;
  }

  renameTree(id, name) {
    const tree = this.getTree(id);
    if (!tree) return;
    const clean = String(name || '').trim();
    if (!clean) throw new Error('Tên cây huyết thống không được để trống.');
    tree.name = clean;
    this.commit();
  }

  deleteTree(id) {
    const tree = this.getTree(id);
    if (!tree) return;
    this.state.trees = this.state.trees.filter((t) => t.id !== id);
    this.state.characters = this.state.characters.filter((c) => c.treeId !== id);
    this.state.relationships = this.state.relationships.filter((r) => r.treeId !== id);
    if (this.state.ui.activeTreeId === id) {
      this.state.ui.activeTreeId = this.treesOfFamily(tree.familyId)[0]?.id ?? null;
    }
    this.commit();
  }

  /* ------------------------------------------------------------------ *
   * Nhân vật
   * ------------------------------------------------------------------ */

  static validateCharacterInput(input) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('Tên nhân vật không được để trống.');
    return {
      name,
      gender: GENDER_LABELS[input.gender] ? input.gender : 'unknown',
      title: String(input.title ?? '').trim(),
      realmId: input.realmId || null,
      status: STATUS_LABELS[input.status] ? input.status : 'alive',
      note: String(input.note ?? ''),
    };
  }

  updateCharacter(id, patch) {
    const character = this.getCharacter(id);
    if (!character) throw new Error('Không tìm thấy nhân vật.');
    const clean = Store.validateCharacterInput({ ...character, ...patch });
    Object.assign(character, clean);
    if (character.realmId && !this.state.realms.some((r) => r.id === character.realmId)) {
      character.realmId = null;
    }
    // Chỉ root của tree mới được sửa trực tiếp generation (đây là điểm neo BFS).
    const tree = this.getTree(character.treeId);
    if (patch.generation !== undefined && tree?.rootCharacterId === character.id) {
      character.generation = Math.max(1, Math.round(Number(patch.generation) || 1));
    }
    this.recomputeGenerations(character.treeId);
    this.commit();
    return character;
  }

  /**
   * Thêm thành viên phụ thuộc từ một nhân vật đang chọn (vợ/chồng/con - §8, §9).
   * Nhân vật mới LUÔN cùng `treeId` với nhân vật gốc.
   *
   * @param {string} fromId     nhân vật đang được click
   * @param {string} relation   'wife' | 'husband' | 'partner' | 'son' | 'daughter' | 'adopted'
   * @param {object} input      thông tin nhân vật mới
   * @param {string|null} secondParentId  cha/mẹ còn lại (chỉ dùng cho quan hệ con)
   */
  addRelative(fromId, relation, input, secondParentId = null) {
    const anchor = this.getCharacter(fromId);
    if (!anchor) throw new Error('Không tìm thấy nhân vật gốc.');
    const option = RELATION_OPTIONS.find((o) => o.value === relation);
    if (!option) throw new Error('Loại quan hệ không hợp lệ.');
    const clean = Store.validateCharacterInput(input);

    const isSpouse = option.kind === 'spouse';
    const character = {
      id: Utils.uid('char'),
      familyId: anchor.familyId,
      treeId: anchor.treeId,
      generation: isSpouse ? anchor.generation : anchor.generation + 1,
      ...clean,
    };
    this.state.characters.push(character);

    if (isSpouse) {
      this.state.relationships.push({
        id: Utils.uid('rel'),
        treeId: anchor.treeId,
        type: 'spouse',
        from: anchor.id,
        to: character.id,
        role: relation,
      });
    } else {
      // Nhánh con LUÔN xuất phát từ nhân vật vừa click (§9)
      this.state.relationships.push({
        id: Utils.uid('rel'),
        treeId: anchor.treeId,
        type: 'parent',
        from: anchor.id,
        to: character.id,
        role: relation,
      });
      const other = secondParentId ? this.getCharacter(secondParentId) : null;
      if (other && other.id !== anchor.id && other.treeId === anchor.treeId) {
        this.state.relationships.push({
          id: Utils.uid('rel'),
          treeId: anchor.treeId,
          type: 'parent',
          from: other.id,
          to: character.id,
          role: relation,
        });
      }
    }

    this.recomputeGenerations(anchor.treeId);
    this.commit();
    return character;
  }

  /**
   * Thêm cha hoặc mẹ MỚI cho một nhân vật chưa có cha/mẹ đó (§10-§14).
   * Cha/mẹ mới luôn cùng `treeId` với con (§12), generation = con.generation - 1.
   * @param {string} childId
   * @param {'male'|'female'} parentGender
   * @param {object} input
   * @param {boolean} adopted
   */
  addNewParent(childId, parentGender, input, adopted = false) {
    const child = this.getCharacter(childId);
    if (!child) throw new Error('Không tìm thấy nhân vật.');
    if (child.generation <= 1) {
      throw new Error('Không thể thêm cha/mẹ: nhân vật đang ở đời thấp nhất (Đời 1).');
    }
    const { father, mother, total } = this.parentsByGender(childId);
    if (total >= 2) throw new Error('Nhân vật đã có đủ 2 cha/mẹ.');
    if (parentGender === 'male' && father) throw new Error('Nhân vật đã có cha.');
    if (parentGender === 'female' && mother) throw new Error('Nhân vật đã có mẹ.');

    const clean = Store.validateCharacterInput({ ...input, gender: input.gender || parentGender });
    const parent = {
      id: Utils.uid('char'),
      familyId: child.familyId,
      treeId: child.treeId,
      generation: child.generation - 1,
      ...clean,
    };
    this.state.characters.push(parent);
    this.state.relationships.push({
      id: Utils.uid('rel'),
      treeId: child.treeId,
      type: 'parent',
      from: parent.id,
      to: child.id,
      role: adopted ? 'adopted' : (child.gender === 'female' ? 'daughter' : 'son'),
    });
    this.recomputeGenerations(child.treeId);
    this.commit();
    return parent;
  }

  /**
   * Nối một nhân vật CÓ SẴN (cùng tree) làm cha/mẹ của một nhân vật khác,
   * tránh tạo nhân vật trùng lặp (§14).
   */
  linkExistingParent(childId, existingParentId, adopted = false) {
    const child = this.getCharacter(childId);
    const parent = this.getCharacter(existingParentId);
    if (!child || !parent) throw new Error('Không tìm thấy nhân vật.');
    if (parent.id === child.id) throw new Error('Không thể chọn chính nhân vật này.');
    if (parent.treeId !== child.treeId) throw new Error('Cha/mẹ phải thuộc cùng cây huyết thống.');
    if (this.parentsOf(child.id).some((p) => p.id === parent.id)) throw new Error('Quan hệ này đã tồn tại.');
    if (this.parentsOf(child.id).length >= 2) throw new Error('Nhân vật đã có đủ 2 cha/mẹ.');
    if (this.isAncestor(child.id, parent.id)) throw new Error('Quan hệ này tạo thành vòng lặp trong cây huyết thống.');

    this.state.relationships.push({
      id: Utils.uid('rel'),
      treeId: child.treeId,
      type: 'parent',
      from: parent.id,
      to: child.id,
      role: adopted ? 'adopted' : (child.gender === 'female' ? 'daughter' : 'son'),
    });
    this.recomputeGenerations(child.treeId);
    this.commit();
    return parent;
  }

  /** Danh sách nhân vật cùng tree, đúng đời (con.generation - 1), có thể chọn làm cha/mẹ có sẵn */
  parentCandidatesFor(childId) {
    const child = this.getCharacter(childId);
    if (!child) return [];
    const targetGen = child.generation - 1;
    return this.charactersOfTree(child.treeId).filter(
      (c) => c.id !== childId && c.generation === targetGen && !this.isAncestor(child.id, c.id),
    );
  }

  /**
   * Tập nhân vật sẽ bị xoá theo khi xoá cả nhánh (trong cùng một tree):
   *  - con cháu mà TẤT CẢ cha/mẹ đều nằm trong tập bị xoá
   *  - vợ/chồng cưới vào nhánh (không có cha/mẹ trong tree)
   */
  cascadeTargets(rootId) {
    const root = this.getCharacter(rootId);
    if (!root) return [];
    const members = this.charactersOfTree(root.treeId);
    const del = new Set();
    const isDeleted = (id) => id === rootId || del.has(id);
    let changed = true;
    let guard = 0;
    while (changed && guard < members.length + 5) {
      changed = false;
      guard += 1;
      for (const c of members) {
        if (isDeleted(c.id)) continue;
        const parents = this.parentsOf(c.id).map((p) => p.id);
        if (parents.length && parents.every(isDeleted)) {
          del.add(c.id);
          changed = true;
          continue;
        }
        const spouses = this.spousesOf(c.id).map((s) => s.id);
        if (!parents.length && spouses.length && spouses.every(isDeleted)) {
          del.add(c.id);
          changed = true;
        }
      }
    }
    return [...del];
  }

  /** Thống kê ảnh hưởng trước khi xoá (dùng cho hộp thoại xác nhận) */
  deletionImpact(characterId) {
    const character = this.getCharacter(characterId);
    if (!character) return null;
    const cascade = this.cascadeTargets(characterId);
    const children = this.childrenOf(characterId);
    const orphaned = children.filter((c) => this.parentsOf(c.id).length === 1);
    const tree = this.getTree(character.treeId);
    return {
      character,
      isRoot: tree?.rootCharacterId === characterId,
      spouseCount: this.spousesOf(characterId).length,
      childCount: children.length,
      orphanedChildren: orphaned.map((c) => this.getCharacter(c.id)).filter(Boolean),
      cascadeCount: cascade.length,
      cascadeNames: cascade.map((id) => this.getCharacter(id)?.name).filter(Boolean),
    };
  }

  /**
   * Xoá nhân vật (§17). Không tự động xoá cả tree - nếu tree hết thành viên,
   * tree vẫn tồn tại (rỗng, rootCharacterId = null) để người dùng tự quyết định.
   * @param {string} characterId
   * @param {'single'|'cascade'} mode  'single' chỉ xoá 1 người, con cái trở thành nhánh rời;
   *                                   'cascade' xoá cả nhánh con cháu.
   */
  deleteCharacter(characterId, mode = 'single') {
    const character = this.getCharacter(characterId);
    if (!character) throw new Error('Không tìm thấy nhân vật.');
    const treeId = character.treeId;
    const tree = this.getTree(treeId);

    const ids = new Set([characterId]);
    if (mode === 'cascade') for (const id of this.cascadeTargets(characterId)) ids.add(id);

    const remaining = this.charactersOfTree(treeId).filter((c) => !ids.has(c.id));

    // Nhân vật gốc bị xoá -> chọn người kế thừa (ưu tiên con còn lại); nếu
    // không còn ai, tree trở thành tree rỗng thay vì bị xoá tự động.
    if (tree && ids.has(tree.rootCharacterId)) {
      const heir =
        this.childrenOf(characterId).map((c) => c.id).find((id) => !ids.has(id)) ||
        remaining.slice().sort((a, b) => a.generation - b.generation)[0]?.id;
      tree.rootCharacterId = heir ?? null;
    }

    this.state.characters = this.state.characters.filter((c) => !ids.has(c.id));
    this.state.relationships = this.state.relationships.filter((r) => !ids.has(r.from) && !ids.has(r.to));
    if (remaining.length) this.recomputeGenerations(treeId);
    this.commit();
    return ids.size;
  }

  /** Xoá một quan hệ cụ thể (không xoá nhân vật) */
  deleteRelationship(relId) {
    const rel = this.state.relationships.find((r) => r.id === relId);
    if (!rel) return;
    this.state.relationships = this.state.relationships.filter((r) => r.id !== relId);
    this.recomputeGenerations(rel.treeId);
    this.commit();
  }

  /* ------------------------------------------------------------------ *
   * Cảnh giới
   * ------------------------------------------------------------------ */

  /** Cây cảnh giới 2 cấp: [{...realm, children: [...]}] */
  realmTree() {
    const majors = this.state.realms
      .filter((r) => !r.parentId)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return majors.map((major) => ({
      ...major,
      children: this.state.realms
        .filter((r) => r.parentId === major.id)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    }));
  }

  getRealm(id) {
    return this.state.realms.find((r) => r.id === id) || null;
  }

  /** "Trúc Cơ - Hậu kỳ" hoặc "Trúc Cơ" */
  realmLabel(id) {
    const realm = this.getRealm(id);
    if (!realm) return null;
    if (!realm.parentId) return realm.name;
    const parent = this.getRealm(realm.parentId);
    return parent ? `${parent.name} - ${realm.name}` : realm.name;
  }

  /**
   * Thứ tự đại cảnh giới (1 = đại cảnh giới đầu tiên, 2 = thứ hai...), dùng
   * để chọn kiểu khung cho node. 0 = phàm nhân (chưa có cảnh giới).
   */
  majorRealmTierOf(realmId) {
    if (!realmId) return 0;
    const realm = this.getRealm(realmId);
    if (!realm) return 0;
    const majorId = realm.parentId || realm.id;
    const index = this.realmTree().findIndex((m) => m.id === majorId);
    return index === -1 ? 0 : index + 1;
  }

  createRealm(name, parentId = null) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('Tên cảnh giới không được để trống.');
    if (parentId && !this.getRealm(parentId)) throw new Error('Không tìm thấy đại cảnh giới.');
    if (parentId && this.getRealm(parentId).parentId) {
      throw new Error('Chỉ hỗ trợ 2 cấp: đại cảnh giới và tiểu cảnh giới.');
    }
    const siblings = this.state.realms.filter((r) => (r.parentId ?? null) === (parentId ?? null));
    const realm = {
      id: Utils.uid('realm'),
      name: clean,
      parentId: parentId ?? null,
      order: siblings.reduce((max, r) => Math.max(max, r.order), -1) + 1,
    };
    this.state.realms.push(realm);
    this.commit();
    return realm;
  }

  renameRealm(id, name) {
    const realm = this.getRealm(id);
    if (!realm) return;
    const clean = String(name || '').trim();
    if (!clean) throw new Error('Tên cảnh giới không được để trống.');
    realm.name = clean;
    this.commit();
  }

  /** Số nhân vật đang dùng cảnh giới này (tính cả tiểu cảnh giới con) */
  realmUsage(id) {
    const ids = new Set([id, ...this.state.realms.filter((r) => r.parentId === id).map((r) => r.id)]);
    return this.state.characters.filter((c) => c.realmId && ids.has(c.realmId));
  }

  deleteRealm(id) {
    const realm = this.getRealm(id);
    if (!realm) return;
    const users = this.realmUsage(id);
    if (users.length) {
      const names = users.slice(0, 5).map((c) => c.name).join(', ');
      throw new Error(
        `Không thể xoá: còn ${users.length} nhân vật đang dùng cảnh giới này (${names}${users.length > 5 ? '…' : ''}).`,
      );
    }
    const ids = new Set([id, ...this.state.realms.filter((r) => r.parentId === id).map((r) => r.id)]);
    this.state.realms = this.state.realms.filter((r) => !ids.has(r.id));
    this.commit();
  }

  /** Đổi thứ tự cảnh giới trong cùng một cấp */
  moveRealm(id, delta) {
    const realm = this.getRealm(id);
    if (!realm) return;
    const siblings = this.state.realms
      .filter((r) => (r.parentId ?? null) === (realm.parentId ?? null))
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((r) => r.id === id);
    const target = index + delta;
    if (target < 0 || target >= siblings.length) return;
    [siblings[index].order, siblings[target].order] = [siblings[target].order, siblings[index].order];
    this.commit();
  }

  /* ------------------------------------------------------------------ *
   * Import / Export
   * ------------------------------------------------------------------ */

  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  /** @throws {Error} nếu JSON sai định dạng - không làm crash app */
  importJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error('Import thất bại: Dữ liệu JSON không hợp lệ (lỗi cú pháp).');
    }
    const check = Store.validate(parsed);
    if (!check.ok) {
      throw new Error(`Import thất bại: Dữ liệu JSON không hợp lệ.\n- ${check.errors.join('\n- ')}`);
    }
    this.state = Store.normalize(parsed);
    this.commit();
  }
}
