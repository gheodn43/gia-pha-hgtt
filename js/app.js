/**
 * App - điểm khởi động, nối Store <-> Sidebar <-> TreeView <-> Modals.
 */
(function bootstrap() {
  const app = {
    store: new Store(),
    tree: null,
  };
  window.app = app; // hữu ích khi debug qua console

  app.refreshTree = () => {
    app.tree.render(app.store.activeFamilyId);
  };

  document.addEventListener('DOMContentLoaded', async () => {
    app.tree = new TreeView(app.store, {
      canvas: document.getElementById('canvas'),
      viewport: document.getElementById('viewport'),
      laneLayer: document.getElementById('lane-layer'),
      linkLayer: document.getElementById('link-layer'),
      nodeLayer: document.getElementById('node-layer'),
      emptyState: document.getElementById('empty-state'),
      zoomLabels: [document.getElementById('zoom-label'), document.getElementById('zoom-label-m')],
      onNodeClick: (characterId) => CharacterModal.open(app, characterId),
      onLaneClick: (generation, anchorEl) => {
        UI.popover(anchorEl, [
          {
            label: `+ Tạo cây huyết thống tại đời ${generation}`,
            onSelect: () => CreateTreeModal.open(app, app.store.activeFamilyId, generation),
          },
        ]);
      },
    });

    bindHeader(app);
    bindToolbar(app);
    bindSidebarDrawer();

    const source = await app.store.init();
    if (source === 'seed') {
      Utils.toast('Đã nạp dữ liệu mẫu (chưa có dữ liệu trước đó trong trình duyệt).', 'info');
    }

    app.store.subscribe(() => {
      Sidebar.render(app);
      updateFamilyLabel(app);
      app.refreshTree();
    });

    Sidebar.render(app);
    updateFamilyLabel(app);
    app.refreshTree();

    // Trên di động, thanh địa chỉ ẩn/hiện và bàn phím ảo bật lên đều bắn sự
    // kiện resize - fit lại mỗi lần như vậy sẽ ném đi khung nhìn người dùng
    // vừa kéo/zoom. Chỉ fit lại khi bề rộng thực sự đổi (xoay máy, resize cửa
    // sổ desktop), và có debounce.
    let lastWidth = window.innerWidth;
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => app.tree.fit({ readableFloor: true }), 150);
    });
  });

  function updateFamilyLabel(app) {
    const family = app.store.getFamily(app.store.activeFamilyId);
    const label = document.getElementById('active-family-label');
    label.textContent = family
      ? `${family.name} · ${app.store.charactersOfFamily(family.id).length} nhân vật`
      : '—';
  }

  function bindHeader(app) {
    document.getElementById('btn-new-family').addEventListener('click', () => {
      Sidebar.openCreateFamilyModal(app);
    });

    document.getElementById('btn-new-tree').addEventListener('click', () => {
      CreateTreeModal.open(app, app.store.activeFamilyId);
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const json = app.store.exportJSON();
      const stamp = new Date().toISOString().slice(0, 10);
      Utils.downloadText(`family-tree-${stamp}.json`, json);
      Utils.toast('Đã xuất file family-tree.json', 'success');
    });

    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      try {
        const text = await Utils.readFileAsText(file);
        app.store.importJSON(text);
        Utils.toast('Import thành công. Đã khôi phục toàn bộ gia phả.', 'success');
      } catch (err) {
        Utils.toast(err.message, 'error', 5000);
      }
    });
  }

  function bindToolbar(app) {
    // Mỗi hành động có 2 nút: trên toolbar (desktop) và nút nổi trên canvas (mobile).
    const on = (ids, handler) => {
      for (const id of ids) document.getElementById(id)?.addEventListener('click', handler);
    };
    on(['btn-zoom-in', 'btn-zoom-in-m'], () => app.tree.zoomBy(1.2));
    on(['btn-zoom-out', 'btn-zoom-out-m'], () => app.tree.zoomBy(1 / 1.2));
    on(['btn-zoom-reset'], () => app.tree.resetZoom());
    on(['btn-fit', 'btn-fit-m'], () => app.tree.fit());
  }

  /**
   * Sidebar trên mobile là ngăn kéo trượt từ trái. Đóng khi: bấm nền mờ, bấm
   * nút ×, nhấn Escape, hoặc vừa chọn xong một gia phả / cây huyết thống.
   */
  function bindSidebarDrawer() {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    const menuBtn = document.getElementById('btn-menu');

    const setOpen = (open) => {
      document.body.classList.toggle('has-drawer', open);
      sidebar.classList.toggle('is-open', open);
      scrim.hidden = !open;
      menuBtn.setAttribute('aria-expanded', String(open));
    };

    menuBtn.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));
    scrim.addEventListener('click', () => setOpen(false));
    document.getElementById('btn-sidebar-close').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
    sidebar.addEventListener('click', (event) => {
      if (event.target.closest('.family-item__main')) setOpen(false);
    });
    // Quay lại desktop: bỏ trạng thái ngăn kéo để sidebar hiển thị bình thường.
    window.matchMedia('(min-width: 881px)').addEventListener('change', (e) => {
      if (e.matches) setOpen(false);
    });
  }
})();
