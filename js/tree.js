/**
 * TreeView - vẽ cây gia phả từ kết quả của Layout.
 *
 * Kiến trúc render: 3 lớp chồng nhau trong một "viewport" được transform chung
 *   1. lane layer  : dải nền + nhãn "Đời N"  (HTML)
 *   2. link layer  : đường nối vợ/chồng, cha/mẹ - con  (SVG)
 *   3. node layer  : các thẻ nhân vật  (HTML, dễ style + bắt sự kiện)
 *
 * Pan/zoom thực hiện bằng CSS transform trên viewport nên rất nhẹ.
 */
class TreeView {
  static MIN_SCALE = 0.15;
  static MAX_SCALE = 2.5;
  /**
   * Tỉ lệ nhỏ nhất mà chữ trên thẻ nhân vật còn đọc được trên điện thoại.
   * Thẻ ngang chữ nhỏ hơn thẻ "bài vị" nên cần sàn cao hơn.
   */
  static READABLE_SCALE = { vertical: 0.42, flat: 0.5 };

  constructor(store, options) {
    this.store = store;
    this.canvas = options.canvas;
    this.viewport = options.viewport;
    this.laneLayer = options.laneLayer;
    this.linkLayer = options.linkLayer;
    this.nodeLayer = options.nodeLayer;
    this.emptyState = options.emptyState;
    this.zoomLabels = (options.zoomLabels || [options.zoomLabel]).filter(Boolean);
    this.onNodeClick = options.onNodeClick || (() => {});
    this.onLaneClick = options.onLaneClick || (() => {});

    this.transform = { x: 0, y: 0, scale: 1 };
    this.layout = null;
    this.currentFamilyId = null;
    this.highlightId = null;

    this.#bindPanZoom();
  }

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */

  /**
   * @param {string} familyId
   * @param {object} [options]
   * @param {boolean} [options.refit] ép đưa cây về vừa khung nhìn sau khi vẽ
   */
  render(familyId, { refit = false } = {}) {
    const cardModeChanged = TreeView.syncCardMode();
    const isNewFamily = familyId !== this.currentFamilyId;
    this.currentFamilyId = familyId;
    this.layout = Layout.compute(this.store, familyId);

    this.laneLayer.replaceChildren();
    this.nodeLayer.replaceChildren();
    this.linkLayer.replaceChildren();

    const { NODE_W, NODE_H } = Layout.CONST;
    const layout = this.layout;

    if (!layout.nodes.length) {
      this.emptyState.hidden = false;
      this.viewport.style.width = '0px';
      this.viewport.style.height = '0px';
      return;
    }
    this.emptyState.hidden = true;

    this.viewport.style.width = `${layout.width}px`;
    this.viewport.style.height = `${layout.height}px`;

    /* ----- 1. Dải đời ----- */
    for (const lane of layout.lanes) {
      const padY = Layout.CONST.LANE_PAD_Y;
      const band = Utils.el('div', {
        class: `lane${lane.generation % 2 === 0 ? ' lane--alt' : ''}`,
        style: {
          top: `${lane.y - padY}px`,
          height: `${lane.height + padY * 2}px`,
          width: `${layout.width}px`,
        },
      });
      const label = Utils.el('button', {
        type: 'button',
        class: 'lane__label',
        style: { left: `${lane.labelX}px`, width: `${lane.labelW}px` },
        title: `Đời ${lane.generation} — bấm để tạo cây huyết thống mới tại đời này`,
        onclick: (event) => {
          event.stopPropagation();
          this.onLaneClick(lane.generation, event.currentTarget);
        },
      }, [
        Utils.el('span', { class: 'lane__label-text', text: `Đời ${lane.generation}` }),
        Utils.el('span', { class: 'lane__label-plus', text: '+' }),
      ]);
      band.append(label);
      this.laneLayer.append(band);
    }

    /* ----- 1b. Nhãn tên cây huyết thống ----- */
    for (const label of layout.treeLabels) {
      this.laneLayer.append(
        Utils.el('div', {
          class: 'tree-label',
          style: { left: `${label.x}px`, top: `${label.y - Layout.CONST.TREE_LABEL_H}px`, width: `${label.width}px` },
          title: label.name,
        }, [
          Utils.el('span', { class: 'tree-label__text', text: label.name }),
        ]),
      );
    }

    /* ----- 2. Đường nối ----- */
    const svg = this.linkLayer;
    svg.setAttribute('width', layout.width);
    svg.setAttribute('height', layout.height);
    svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);

    for (const dividerX of layout.dividerXs) {
      svg.append(
        Utils.svgEl('line', {
          class: 'link-divider',
          x1: dividerX, y1: 20,
          x2: dividerX, y2: layout.height - 20,
        }),
      );
    }

    for (const link of layout.parentLinks) {
      const xs = link.children.map((c) => c.x);
      const parts = [`M ${link.anchorX} ${link.anchorY} V ${link.busY}`];
      if (link.children.length > 1) {
        parts.push(`M ${Math.min(...xs)} ${link.busY} H ${Math.max(...xs)}`);
      } else {
        parts.push(`M ${link.anchorX} ${link.busY} H ${xs[0]}`);
      }
      for (const child of link.children) {
        parts.push(`M ${child.x} ${link.busY} V ${child.y}`);
      }
      svg.append(Utils.svgEl('path', { class: 'link link--parent', d: parts.join(' ') }));
      svg.append(Utils.svgEl('circle', { class: 'link-dot', cx: link.anchorX, cy: link.anchorY, r: 4 }));
    }

    for (const link of layout.spouseLinks) {
      svg.append(
        Utils.svgEl('path', {
          class: 'link link--spouse',
          d: `M ${link.x1} ${link.y - 3} H ${link.x2} M ${link.x1} ${link.y + 3} H ${link.x2}`,
        }),
      );
    }

    /* ----- 3. Thẻ nhân vật ----- */
    for (const node of layout.nodes) {
      const character = this.store.getCharacter(node.id);
      if (!character) continue;
      this.nodeLayer.append(this.#renderNode(character, node, NODE_W, NODE_H));
    }

    if (isNewFamily || refit || cardModeChanged) this.fit({ readableFloor: true });
    else this.#applyTransform();
  }

  #renderNode(character, node, width, height) {
    const store = this.store;
    const realm = store.realmLabel(character.realmId);
    const role = store.displayRoleOf(character.id);
    const isDead = character.status === 'deceased';

    const tier = store.majorRealmTierOf(character.realmId);
    const tierClass = tier > 0 ? `node--tier-${Math.min(tier, 10)}` : '';

    const classes = [
      'node',
      `node--${character.gender}`,
      isDead ? 'node--dead' : '',
      tierClass,
      this.highlightId === character.id ? 'is-highlight' : '',
    ].filter(Boolean).join(' ');

    const card = Utils.el('div', {
      class: classes,
      style: { left: `${node.x}px`, top: `${node.y}px`, width: `${width}px`, height: `${height}px` },
      dataset: { id: character.id },
      tabindex: '0',
      role: 'button',
      title: `${character.name} — bấm để xem chi tiết`,
    }, [
      role ? Utils.el('span', { class: 'node__flag', text: role }) : null,
      Utils.el('div', { class: 'node__body' }, [
        Utils.el('div', { class: 'node__name', text: character.name }),
        character.title ? Utils.el('div', { class: 'node__title', text: character.title }) : null,
        Utils.el('div', { class: 'node__realm', text: realm || 'Phàm nhân' }),
      ]),
      Utils.el('span', {
        class: `node__status node__status--${character.status}`,
        title: STATUS_LABELS[character.status],
      }, isDead ? '†' : '●'),
    ]);

    card.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.pointerMoved) return;
      this.onNodeClick(character.id);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.onNodeClick(character.id);
      }
    });
    return card;
  }

  /* ------------------------------------------------------------------ *
   * Pan / Zoom
   * ------------------------------------------------------------------ */

  #bindPanZoom() {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    // Các ngón/con trỏ đang đặt trên canvas - cần cho cử chỉ pinch 2 ngón.
    const points = new Map();
    let pinch = null;
    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const midpoint = () => {
      const [a, b] = [...points.values()];
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        dist: Math.hypot(a.x - b.x, a.y - b.y),
      };
    };

    const startPinch = () => {
      dragging = false;
      this.pointerMoved = true;
      this.canvas.classList.remove('is-panning');
      const m = midpoint();
      const rect = this.canvas.getBoundingClientRect();
      pinch = { dist: m.dist || 1, cx: m.x - rect.left, cy: m.y - rect.top };
    };

    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      // Không bắt đầu pan/không setPointerCapture khi bấm vào node hoặc control
      // tương tác (button/select/input...) - nếu không, pointer capture sẽ
      // khiến sự kiện "click" bị chuyển hướng về canvas thay vì phần tử gốc,
      // làm mất click trên node/nút.
      if (event.target.closest('.node, button, select, input, textarea, a, .popover')) return;
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.size === 2) {
        startPinch();
        return;
      }
      if (points.size > 2) return;
      dragging = true;
      this.pointerMoved = false;
      startX = event.clientX;
      startY = event.clientY;
      originX = this.transform.x;
      originY = this.transform.y;
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.classList.add('is-panning');
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (points.has(event.pointerId)) {
        points.get(event.pointerId).x = event.clientX;
        points.get(event.pointerId).y = event.clientY;
      }

      // Pinch 2 ngón: vừa zoom quanh trung điểm, vừa pan theo trung điểm đó.
      if (pinch && points.size >= 2) {
        const m = midpoint();
        const rect = this.canvas.getBoundingClientRect();
        const cx = m.x - rect.left;
        const cy = m.y - rect.top;
        this.transform.x += cx - pinch.cx;
        this.transform.y += cy - pinch.cy;
        pinch.cx = cx;
        pinch.cy = cy;
        if (m.dist > 0) {
          this.zoomAt(m.dist / pinch.dist, cx, cy);
          pinch.dist = m.dist;
        } else {
          this.#applyTransform();
        }
        return;
      }

      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.pointerMoved = true;
      this.transform.x = originX + dx;
      this.transform.y = originY + dy;
      this.#applyTransform();
    });

    const endDrag = (event) => {
      const wasPinching = pinch !== null;
      points.delete(event.pointerId);
      if (points.size < 2) pinch = null;

      // Nhả 1 trong 2 ngón của cử chỉ pinch mà ngón kia còn trên màn hình:
      // chuyển tiếp mượt sang kéo bằng ngón còn lại thay vì "đơ" cho tới khi
      // người dùng nhấc tay ra rồi đặt lại.
      if (wasPinching && points.size === 1) {
        const [remaining] = points.values();
        dragging = true;
        startX = remaining.x;
        startY = remaining.y;
        originX = this.transform.x;
        originY = this.transform.y;
        return;
      }

      if (!dragging) {
        // Vừa nhả ngón cuối của cử chỉ pinch: chặn click "ảo" trên node.
        if (points.size === 0) setTimeout(() => { this.pointerMoved = false; }, 0);
        return;
      }
      dragging = false;
      this.canvas.classList.remove('is-panning');
      try { this.canvas.releasePointerCapture(event.pointerId); } catch (err) { /* noop */ }
      // Cho phép click node ngay sau khi thả chuột
      setTimeout(() => { this.pointerMoved = false; }, 0);
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);

    // Chạm 2 lần nhanh vào nền canvas => phóng to quanh điểm chạm (thay cho
    // double-click zoom mặc định của trình duyệt đã bị touch-action: none tắt).
    this.canvas.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'mouse') return;
      if (event.target.closest('.node, button, select, input, textarea, a, .popover')) return;
      if (this.pointerMoved) return;
      const now = Date.now();
      const isDoubleTap = now - lastTapAt < 320
        && Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < 32;
      lastTapAt = isDoubleTap ? 0 : now;
      lastTapX = event.clientX;
      lastTapY = event.clientY;
      if (!isDoubleTap) return;
      const rect = this.canvas.getBoundingClientRect();
      this.zoomAt(1.6, event.clientX - rect.left, event.clientY - rect.top);
    });

    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      // Trackpad pinch (hoặc Ctrl/Cmd + lăn chuột) => zoom, giống Figma.
      // Hệ số tỉ lệ theo chính deltaY của sự kiện (không phải bước cố định),
      // vì một cử chỉ pinch bắn ra rất nhiều sự kiện wheel liên tiếp - dùng
      // bước cố định sẽ khiến zoom dồn dập dù ngón tay chỉ di chuyển rất ít.
      if (event.ctrlKey || event.metaKey) {
        const rect = this.canvas.getBoundingClientRect();
        const factor = Math.exp(-event.deltaY * 0.008);
        this.zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
        return;
      }
      // Cử chỉ 2 ngón tay (hoặc lăn chuột thường) => pan, giống Figma.
      this.transform.x -= event.deltaX;
      this.transform.y -= event.deltaY;
      this.#applyTransform();
    }, { passive: false });
  }

  zoomAt(factor, cx, cy) {
    const { scale, x, y } = this.transform;
    const next = Utils.clamp(scale * factor, TreeView.MIN_SCALE, TreeView.MAX_SCALE);
    if (next === scale) return;
    this.transform.scale = next;
    this.transform.x = cx - (cx - x) * (next / scale);
    this.transform.y = cy - (cy - y) * (next / scale);
    this.#applyTransform();
  }

  zoomBy(factor) {
    const rect = this.canvas.getBoundingClientRect();
    this.zoomAt(factor, rect.width / 2, rect.height / 2);
  }

  resetZoom() {
    this.transform = { x: 40, y: 24, scale: 1 };
    this.#applyTransform();
  }

  /**
   * Thu toàn bộ cây vừa khung nhìn.
   *
   * @param {object} [options]
   * @param {boolean} [options.readableFloor] Trên màn hình hẹp, một cây lớn khi
   *   fit trọn vẹn sẽ nhỏ tới mức không đọc nổi chữ. Bật cờ này (dùng cho lần
   *   fit tự động khi đổi gia phả) để giữ tỉ lệ tối thiểu còn đọc được và neo
   *   khung nhìn vào đỉnh cây; nút "Fit vừa màn hình" vẫn fit đúng nghĩa.
   */
  fit({ readableFloor = false } = {}) {
    if (!this.layout || !this.layout.nodes.length) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const exact = Utils.clamp(
      Math.min(rect.width / this.layout.width, rect.height / this.layout.height) * 0.94,
      TreeView.MIN_SCALE,
      1,
    );
    const floor = readableFloor && TreeView.isCompactViewport()
      ? TreeView.READABLE_SCALE[Layout.getCardMode()] || 0
      : 0;
    const scale = Math.max(exact, floor);

    this.transform.scale = scale;
    if (scale > exact) {
      // Đã chạm sàn đọc được: cây tràn ra ngoài khung nhìn nên căn giữa sẽ cắt
      // cụt cả hai mép. Neo vào góc trên - trái để nhãn "Đời N" và gốc cây
      // hiện đầy đủ, người dùng kéo tiếp sang phải.
      this.transform.x = 16;
      this.transform.y = 16;
    } else {
      this.transform.x = (rect.width - this.layout.width * scale) / 2;
      this.transform.y = Math.max(16, (rect.height - this.layout.height * scale) / 2);
    }
    this.#applyTransform();
  }

  /** Màn hình hẹp / thiết bị cảm ứng - dùng để chọn hành vi khung nhìn */
  static isCompactViewport() {
    return window.matchMedia('(max-width: 880px), (pointer: coarse)').matches;
  }

  /**
   * Chọn kiểu thẻ nhân vật cho môi trường hiện tại và đồng bộ sang Layout +
   * class trên <body> (CSS dựa vào class này).
   *
   * Dùng thẻ ngang khi: màn hình hẹp / thiết bị cảm ứng, HOẶC trình duyệt
   * không hỗ trợ chữ dọc. Nhiều trình duyệt di động không dựng được
   * writing-mode dọc nên thẻ "bài vị" hiện ra trống trơn.
   *
   * @returns {boolean} true nếu kiểu thẻ vừa đổi (caller cần vẽ lại)
   */
  static syncCardMode() {
    const flat = TreeView.isCompactViewport() || !TreeView.supportsVerticalText();
    document.body.classList.toggle('cards-flat', flat);
    return Layout.setCardMode(flat ? 'flat' : 'vertical');
  }

  static supportsVerticalText() {
    return typeof CSS !== 'undefined'
      && typeof CSS.supports === 'function'
      && CSS.supports('writing-mode', 'vertical-rl')
      && CSS.supports('text-orientation', 'upright');
  }

  /** Đưa một nhân vật vào giữa khung nhìn và làm nổi bật */
  focusCharacter(id) {
    const node = this.layout?.nodes.find((n) => n.id === id);
    if (!node) return;
    const rect = this.canvas.getBoundingClientRect();
    const { scale } = this.transform;
    this.transform.x = rect.width / 2 - (node.x + Layout.CONST.NODE_W / 2) * scale;
    this.transform.y = rect.height / 2 - (node.y + Layout.CONST.NODE_H / 2) * scale;
    this.#applyTransform();
    this.setHighlight(id);
  }

  setHighlight(id) {
    this.highlightId = id;
    for (const el of this.nodeLayer.children) {
      el.classList.toggle('is-highlight', el.dataset.id === id);
    }
  }

  #applyTransform() {
    const { x, y, scale } = this.transform;
    this.viewport.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    const percent = `${Math.round(scale * 100)}%`;
    for (const label of this.zoomLabels) label.textContent = percent;
  }
}
