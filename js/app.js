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
      zoomLabel: document.getElementById('zoom-label'),
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

    window.addEventListener('resize', () => app.tree.fit());
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
    document.getElementById('btn-zoom-in').addEventListener('click', () => app.tree.zoomBy(1.2));
    document.getElementById('btn-zoom-out').addEventListener('click', () => app.tree.zoomBy(1 / 1.2));
    document.getElementById('btn-zoom-reset').addEventListener('click', () => app.tree.resetZoom());
    document.getElementById('btn-fit').addEventListener('click', () => app.tree.fit());
  }
})();
