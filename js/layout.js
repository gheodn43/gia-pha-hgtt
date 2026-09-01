/**
 * Layout - tính toạ độ cho TOÀN BỘ workspace của một gia phả.
 *
 * Nguyên tắc bố cục:
 *  - Một gia phả có thể có NHIỀU cây huyết thống độc lập. Mỗi cây được dựng
 *    bằng thuật toán "đo bề rộng từ dưới lên rồi gán toạ độ từ trên xuống"
 *    (giống hệt nhau cho mọi cây), sau đó các cây được xếp CẠNH NHAU theo
 *    trục X, không có edge nối giữa chúng.
 *  - Trục Y = đời (generation) và LÀ TRỤC DÙNG CHUNG cho mọi cây trong cùng
 *    một gia phả: node ở đời N của cây A và đời N của cây B luôn nằm trên
 *    cùng một hàng, bất kể cây nào có gốc ở đời nào. generation không được
 *    suy ra từ depth cục bộ của từng cây.
 *  - Vợ/chồng nằm SÁT NHAU trên cùng hàng với nhân vật chính.
 *  - Con được vẽ từ điểm neo của đúng cha/mẹ đã sinh ra nhánh đó:
 *      + nếu con có cả cha lẫn mẹ trong cụm -> neo ở giữa cặp đôi
 *      + nếu con chỉ có 1 cha/mẹ trong cụm  -> neo ngay dưới người đó
 */
const Layout = (() => {
  const CONST = {
    NODE_W: 108, // thẻ dọc hẹp (kiểu bài vị) - chữ xếp dọc để tiết kiệm chiều ngang
    NODE_H: 335, // cao hơn để bù cho việc hẹp lại
    SPOUSE_GAP: 14, // khoảng cách giữa vợ/chồng trong cùng cụm
    SIB_GAP: 20, // khoảng cách giữa các anh em cùng cha mẹ
    GROUP_GAP: 40, // khoảng cách giữa các nhóm con khác mẹ
    ROOT_GAP: 70, // khoảng cách giữa các nhánh gốc rời rạc trong cùng một tree
    TREE_GAP: 120, // khoảng cách giữa hai cây huyết thống độc lập
    ROW_H: 475, // khoảng cách giữa 2 đời
    LANE_LABEL_W: 116, // bề rộng cột nhãn "Đời N"
    LANE_PAD_X: 28,
    TREE_LABEL_H: 40, // chiều cao vùng nhãn tên cây phía trên mỗi cụm
    PAD: 60,
  };

  /**
   * Dựng "rừng" cụm cho một tập nhân vật thuộc CÙNG MỘT tree: gom vợ/chồng
   * cùng cụm, neo nhánh con vào đúng cha/mẹ trong cụm đó, đo bề rộng
   * bottom-up rồi gán toạ độ top-down. Trả về thêm `width` để caller biết
   * chỗ đặt cây tiếp theo.
   *
   * @param {object} opts
   * @param {Store} opts.store
   * @param {Map} opts.byId
   * @param {(gen:number)=>number} opts.rowY  hàm đời -> toạ độ Y (DÙNG CHUNG cho mọi tree)
   * @param {(character:object)=>boolean} opts.isMember  nhân vật có thuộc tree này không
   * @param {string|null} opts.preferredRootId  ưu tiên xếp làm gốc đầu tiên (rootCharacterId của tree)
   * @param {number} opts.startX  toạ độ X bắt đầu của cây này trong workspace
   * @returns {{nodes:Array<{id:string,x:number,y:number}>, parentLinkSpecs:Array, spousePairs:Array, width:number}}
   */
  function buildForest({ store, byId, rowY, isMember, preferredRootId, startX = 0 }) {
    const placed = new Set();
    const nodes = [];
    const parentLinkSpecs = [];
    const spousePairs = [];

    function buildUnit(id) {
      if (placed.has(id)) return null;
      const character = byId.get(id);
      if (!character || !isMember(character)) return null;
      placed.add(id);

      // Cụm = nhân vật chính + toàn bộ vợ/chồng chưa được xếp (cùng tree)
      const members = [id];
      for (const spouse of store.spousesOf(id)) {
        const sc = byId.get(spouse.id);
        if (sc && isMember(sc) && !placed.has(spouse.id)) {
          placed.add(spouse.id);
          members.push(spouse.id);
        }
      }
      const memberIndex = new Map(members.map((m, i) => [m, i]));

      // Gom con của mọi thành viên trong cụm, giữ thứ tự xuất hiện
      const childIds = [];
      const seenChild = new Set();
      for (const member of members) {
        for (const child of store.childrenOf(member)) {
          if (seenChild.has(child.id)) continue;
          const cc = byId.get(child.id);
          if (!cc || !isMember(cc)) continue;
          seenChild.add(child.id);
          childIds.push(child.id);
        }
      }

      // Nhóm con theo "cặp cha mẹ" trong cụm -> quyết định điểm neo của nhánh
      const groupMap = new Map();
      for (const childId of childIds) {
        const idxs = store
          .parentsOf(childId)
          .map((p) => memberIndex.get(p.id))
          .filter((i) => i !== undefined)
          .sort((a, b) => a - b);
        const anchorIdxs = idxs.length ? idxs : [0];
        const key = anchorIdxs.join(',');
        if (!groupMap.has(key)) groupMap.set(key, { key, anchorIdxs, children: [], units: [], width: 0 });
        groupMap.get(key).children.push(childId);
      }
      const groups = [...groupMap.values()].sort(
        (a, b) => a.anchorIdxs[0] - b.anchorIdxs[0] || a.anchorIdxs.length - b.anchorIdxs.length,
      );

      for (const group of groups) {
        for (const childId of group.children) {
          const unit = buildUnit(childId);
          if (unit) group.units.push(unit);
        }
      }

      const selfWidth = members.length * CONST.NODE_W + (members.length - 1) * CONST.SPOUSE_GAP;
      let childrenWidth = 0;
      let groupCount = 0;
      for (const group of groups) {
        if (!group.units.length) continue;
        group.width = group.units.reduce((sum, u, i) => sum + u.width + (i ? CONST.SIB_GAP : 0), 0);
        childrenWidth += (groupCount ? CONST.GROUP_GAP : 0) + group.width;
        groupCount += 1;
      }

      return { members, groups, selfWidth, childrenWidth, width: Math.max(selfWidth, childrenWidth) };
    }

    function assign(unit, left) {
      const { members } = unit;
      const memberLeft = left + (unit.width - unit.selfWidth) / 2;
      members.forEach((memberId, i) => {
        const character = byId.get(memberId);
        const x = memberLeft + i * (CONST.NODE_W + CONST.SPOUSE_GAP);
        const y = rowY(character.generation);
        nodes.push({ id: memberId, x, y });
        if (i > 0) spousePairs.push({ a: members[i - 1], b: memberId });
      });

      let cursor = left + (unit.width - unit.childrenWidth) / 2;
      let first = true;
      for (const group of unit.groups) {
        if (group.units.length) {
          if (!first) cursor += CONST.GROUP_GAP;
          first = false;
          group.units.forEach((child, i) => {
            if (i) cursor += CONST.SIB_GAP;
            assign(child, cursor);
            cursor += child.width;
          });
        }
        // Ghi nhận liên kết cha/mẹ -> con (kể cả con đã được xếp ở nhánh khác)
        parentLinkSpecs.push({
          anchors: group.anchorIdxs.map((i) => members[i]).filter(Boolean),
          children: group.children.slice(),
        });
      }
    }

    const members = [...byId.values()].filter(isMember);
    const rootUnits = [];

    let firstRootId = preferredRootId && byId.has(preferredRootId) && isMember(byId.get(preferredRootId))
      ? preferredRootId
      : null;
    if (!firstRootId) {
      firstRootId = members.slice().sort((a, b) => a.generation - b.generation)[0]?.id ?? null;
    }
    if (firstRootId) {
      const unit = buildUnit(firstRootId);
      if (unit) rootUnits.push(unit);
    }
    // Các nhánh rời rạc chưa được xếp (do xoá node ở giữa), xử lý theo đời tăng dần.
    for (const character of members.slice().sort((a, b) => a.generation - b.generation)) {
      const unit = buildUnit(character.id);
      if (unit) rootUnits.push(unit);
    }

    let cursorX = startX;
    let first = true;
    for (const unit of rootUnits) {
      if (!first) cursorX += CONST.ROOT_GAP;
      first = false;
      assign(unit, cursorX);
      cursorX += unit.width;
    }

    return { nodes, parentLinkSpecs, spousePairs, width: rootUnits.length ? cursorX - startX : 0 };
  }

  /**
   * @param {Store} store
   * @param {string} familyId
   * @returns {{nodes:Array, spouseLinks:Array, parentLinks:Array, lanes:Array,
   *            treeLabels:Array, dividerXs:Array, width:number, height:number}}
   */
  function compute(store, familyId) {
    const empty = {
      nodes: [], spouseLinks: [], parentLinks: [], lanes: [], treeLabels: [], dividerXs: [],
      width: 0, height: 0,
    };
    const family = store.getFamily(familyId);
    if (!family) return empty;

    const chars = store.charactersOfFamily(familyId);
    if (!chars.length) return empty;

    const byId = new Map(chars.map((c) => [c.id, c]));
    const { min: globalMin, max: globalMax } = store.familyGenerationRange(familyId);
    // Trục Y dùng chung cho toàn bộ workspace: generation là toạ độ tuyệt đối,
    // KHÔNG suy ra từ depth cục bộ của từng cây.
    const rowY = (generation) => (generation - globalMin) * CONST.ROW_H;

    const trees = store.treesOfFamily(familyId);
    const nodes = [];
    const parentLinkSpecs = [];
    const spousePairs = [];
    const treeLabels = [];
    const clusterEdges = [];

    let cursorX = 0;
    let firstCluster = true;
    for (const tree of trees) {
      const treeChars = chars.filter((c) => c.treeId === tree.id);
      if (!treeChars.length) continue; // tree rỗng: không có gì để vẽ

      const startX = firstCluster ? 0 : cursorX + CONST.TREE_GAP;
      const forest = buildForest({
        store, byId, rowY,
        isMember: (c) => c.treeId === tree.id,
        preferredRootId: tree.rootCharacterId,
        startX,
      });
      if (!forest.width) continue;

      if (!firstCluster) clusterEdges.push(cursorX + CONST.TREE_GAP / 2);
      firstCluster = false;

      const minGenInTree = Math.min(...treeChars.map((c) => c.generation));
      treeLabels.push({
        id: tree.id,
        name: tree.name,
        x: startX,
        width: forest.width,
        y: rowY(minGenInTree),
      });

      for (const node of forest.nodes) nodes.push({ ...node, treeId: tree.id });
      parentLinkSpecs.push(...forest.parentLinkSpecs);
      spousePairs.push(...forest.spousePairs);

      cursorX = startX + forest.width;
    }

    if (!nodes.length) return empty;

    const positions = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

    /* ---------------- Giải toạ độ liên kết ---------------- */

    const parentLinks = [];
    for (const spec of parentLinkSpecs) {
      const anchorPositions = spec.anchors.map((id) => positions.get(id)).filter(Boolean);
      const childPositions = spec.children
        .map((id) => ({ id, pos: positions.get(id) }))
        .filter((c) => c.pos);
      if (!anchorPositions.length || !childPositions.length) continue;

      const anchorX =
        anchorPositions.reduce((sum, p) => sum + p.x + CONST.NODE_W / 2, 0) / anchorPositions.length;
      const anchorY = Math.max(...anchorPositions.map((p) => p.y)) + CONST.NODE_H;
      const childTop = Math.min(...childPositions.map((c) => c.pos.y));
      const busY = anchorY + (childTop - anchorY) / 2;

      parentLinks.push({
        anchorX,
        anchorY,
        busY,
        isCouple: anchorPositions.length > 1,
        children: childPositions.map((c) => ({
          id: c.id,
          x: c.pos.x + CONST.NODE_W / 2,
          y: c.pos.y,
        })),
      });
    }

    const resolvedSpouseLinks = spousePairs
      .map(({ a, b }) => {
        const pa = positions.get(a);
        const pb = positions.get(b);
        if (!pa || !pb) return null;
        return {
          x1: pa.x + CONST.NODE_W,
          x2: pb.x,
          y: Math.min(pa.y, pb.y) + CONST.NODE_H / 2,
        };
      })
      .filter(Boolean);

    /* ---------------- Hàng đời + dịch về gốc toạ độ ---------------- */

    const contentLeft = Math.min(...nodes.map((n) => n.x));
    const laneLeft = contentLeft - CONST.LANE_LABEL_W - CONST.LANE_PAD_X;
    const offsetX = CONST.PAD - laneLeft;
    const offsetY = CONST.PAD + CONST.TREE_LABEL_H;

    for (const node of nodes) {
      node.x += offsetX;
      node.y += offsetY;
    }
    for (const link of resolvedSpouseLinks) {
      link.x1 += offsetX;
      link.x2 += offsetX;
      link.y += offsetY;
    }
    for (const link of parentLinks) {
      link.anchorX += offsetX;
      link.anchorY += offsetY;
      link.busY += offsetY;
      for (const child of link.children) {
        child.x += offsetX;
        child.y += offsetY;
      }
    }
    for (const label of treeLabels) {
      label.x += offsetX;
      label.y += offsetY;
    }
    const dividerXs = clusterEdges.map((x) => x + offsetX);

    const contentRight = Math.max(...nodes.map((n) => n.x + CONST.NODE_W));
    const lanes = [];
    for (let g = globalMin; g <= globalMax; g += 1) {
      lanes.push({
        generation: g,
        y: rowY(g) + offsetY,
        labelX: CONST.PAD,
        labelW: CONST.LANE_LABEL_W,
        height: CONST.NODE_H,
      });
    }

    return {
      nodes,
      spouseLinks: resolvedSpouseLinks,
      parentLinks,
      lanes,
      treeLabels,
      dividerXs,
      width: contentRight + CONST.PAD,
      height: rowY(globalMax) + CONST.NODE_H + offsetY + CONST.PAD,
    };
  }

  return { compute, CONST };
})();
