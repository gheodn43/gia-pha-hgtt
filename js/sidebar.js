/**
 * Sidebar - danh sách gia phả + cây huyết thống + quản lý cảnh giới.
 */
const Sidebar = (() => {
  function render(app) {
    renderFamilyList(app);
    renderTreeList(app);
    renderRealmTree(app);
  }

  /* ------------------------------------------------------------------ *
   * Gia phả
   * ------------------------------------------------------------------ */

  function renderFamilyList(app) {
    const { store } = app;
    const list = document.getElementById('family-list');
    list.replaceChildren();

    for (const family of store.families) {
      const isActive = family.id === store.activeFamilyId;
      const item = Utils.el('li', { class: `family-item${isActive ? ' is-active' : ''}` }, [
        Utils.el('button', {
          type: 'button', class: 'family-item__main',
          onclick: () => { store.setActiveFamily(family.id); },
        }, [
          Utils.el('span', { class: 'family-item__name', text: family.name }),
          Utils.el('span', { class: 'family-item__count', text: `${store.charactersOfFamily(family.id).length} nhân vật` }),
        ]),
        Utils.el('button', {
          type: 'button', class: 'family-item__more', title: 'Tuỳ chọn', 'aria-label': 'Tuỳ chọn',
          onclick: (event) => {
            event.stopPropagation();
            UI.popover(event.currentTarget, [
              { label: 'Đổi tên gia phả', onSelect: () => renameFamily(app, family) },
              {
                label: 'Xoá gia phả', variant: 'danger',
                onSelect: () => deleteFamily(app, family),
              },
            ]);
          },
        }, '⋯'),
      ]);
      list.append(item);
    }
  }

  function renameFamily(app, family) {
    const modal = UI.openModal({ title: 'Đổi tên gia phả', size: 'sm' });
    const nameInput = UI.input({ value: family.name });
    const errorBox = Utils.el('p', { class: 'form-error', style: { display: 'none' } });
    modal.body.append(UI.field('Tên gia phả', nameInput), errorBox);
    modal.footer.append(
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: modal.close }, 'Huỷ'),
      Utils.el('button', {
        type: 'button', class: 'btn btn--primary',
        onclick: () => {
          try {
            app.store.updateFamily(family.id, { name: nameInput.value });
            modal.close();
          } catch (err) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
          }
        },
      }, 'Lưu'),
    );
  }

  async function deleteFamily(app, family) {
    if (app.store.families.length <= 1) {
      Utils.toast('Phải còn ít nhất một gia phả.', 'error');
      return;
    }
    const choice = await UI.confirm({
      title: 'Xoá gia phả',
      message: `Xoá "${family.name}" sẽ xoá toàn bộ ${app.store.charactersOfFamily(family.id).length} nhân vật và quan hệ liên quan.\nHành động này không thể hoàn tác.`,
      actions: [{ key: 'confirm', label: 'Xoá gia phả', variant: 'danger' }],
    });
    if (choice !== 'confirm') return;
    app.store.deleteFamily(family.id);
    Utils.toast('Đã xoá gia phả.', 'success');
  }

  function openCreateFamilyModal(app) {
    const modal = UI.openModal({
      title: '+ Tạo gia phả mới',
      subtitle: 'Hệ thống sẽ tự tạo nhân vật đời 1 làm gốc cho gia phả.',
      size: 'sm',
    });
    const nameInput = UI.input({ placeholder: 'VD: Gia tộc Lý' });
    const rootInput = UI.input({ placeholder: 'VD: Lý Thiên', value: 'Thủy tổ' });
    const errorBox = Utils.el('p', { class: 'form-error', style: { display: 'none' } });
    modal.body.append(
      UI.field('Tên gia phả', nameInput),
      UI.field('Tên nhân vật đời 1', rootInput),
      errorBox,
    );
    modal.footer.append(
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: modal.close }, 'Huỷ'),
      Utils.el('button', {
        type: 'button', class: 'btn btn--primary',
        onclick: () => {
          try {
            const family = app.store.createFamily(nameInput.value, rootInput.value);
            Utils.toast(`Đã tạo gia phả "${family.name}".`, 'success');
            modal.close();
          } catch (err) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
          }
        },
      }, 'Tạo gia phả'),
    );
  }

  /* ------------------------------------------------------------------ *
   * Cây huyết thống (§6, §18) - các cây độc lập trong gia phả đang chọn
   * ------------------------------------------------------------------ */

  function renderTreeList(app) {
    const { store } = app;
    const list = document.getElementById('tree-list');
    if (!list) return;
    list.replaceChildren();

    const family = store.getFamily(store.activeFamilyId);
    if (!family) return;

    const trees = store.treesOfFamily(family.id);
    if (!trees.length) {
      list.append(Utils.el('p', { class: 'empty-hint', text: 'Chưa có cây huyết thống nào.' }));
    }

    for (const tree of trees) {
      const memberCount = store.charactersOfTree(tree.id).length;
      const root = tree.rootCharacterId ? store.getCharacter(tree.rootCharacterId) : null;
      const item = Utils.el('li', { class: 'family-item' }, [
        Utils.el('button', {
          type: 'button', class: 'family-item__main',
          onclick: () => {
            store.setActiveTree(tree.id);
            if (root) app.tree.focusCharacter(root.id);
          },
          title: 'Bấm để đưa cây này vào giữa khung nhìn',
        }, [
          Utils.el('span', { class: 'family-item__name', text: tree.name }),
          Utils.el('span', {
            class: 'family-item__count',
            text: memberCount ? `${memberCount} nhân vật · gốc đời ${root?.generation ?? '?'}` : 'Cây trống',
          }),
        ]),
        Utils.el('button', {
          type: 'button', class: 'family-item__more', title: 'Tuỳ chọn', 'aria-label': 'Tuỳ chọn',
          onclick: (event) => {
            event.stopPropagation();
            UI.popover(event.currentTarget, [
              { label: 'Đổi tên cây', onSelect: () => renameTree(app, tree) },
              {
                label: 'Xoá cây', variant: 'danger',
                onSelect: () => deleteTree(app, tree),
              },
            ]);
          },
        }, '⋯'),
      ]);
      list.append(item);
    }
  }

  function renameTree(app, tree) {
    const modal = UI.openModal({ title: 'Đổi tên cây huyết thống', size: 'sm' });
    const nameInput = UI.input({ value: tree.name });
    const errorBox = Utils.el('p', { class: 'form-error', style: { display: 'none' } });
    modal.body.append(UI.field('Tên cây', nameInput), errorBox);
    modal.footer.append(
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: modal.close }, 'Huỷ'),
      Utils.el('button', {
        type: 'button', class: 'btn btn--primary',
        onclick: () => {
          try {
            app.store.renameTree(tree.id, nameInput.value);
            modal.close();
          } catch (err) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
          }
        },
      }, 'Lưu'),
    );
  }

  async function deleteTree(app, tree) {
    const memberCount = app.store.charactersOfTree(tree.id).length;
    const choice = await UI.confirm({
      title: 'Xoá cây huyết thống',
      message: memberCount
        ? `Xoá "${tree.name}" sẽ xoá toàn bộ ${memberCount} nhân vật và quan hệ trong cây này.\nHành động này không thể hoàn tác.`
        : `Xoá cây trống "${tree.name}"?`,
      actions: [{ key: 'confirm', label: 'Xoá cây', variant: 'danger' }],
    });
    if (choice !== 'confirm') return;
    app.store.deleteTree(tree.id);
    Utils.toast('Đã xoá cây huyết thống.', 'success');
  }

  /* ------------------------------------------------------------------ *
   * Cảnh giới
   * ------------------------------------------------------------------ */

  function renderRealmTree(app) {
    const { store } = app;
    const root = document.getElementById('realm-tree');
    root.replaceChildren();

    const majors = store.realmTree();
    if (!majors.length) {
      root.append(Utils.el('p', { class: 'empty-hint', text: 'Chưa có cảnh giới nào.' }));
    }

    majors.forEach((major, index) => {
      const majorRow = Utils.el('div', { class: 'realm-row realm-row--major' }, [
        Utils.el('span', { class: 'realm-row__caret', text: '▾' }),
        Utils.el('span', { class: 'realm-row__name', text: major.name }),
        realmMenuButton(app, major, index, majors.length),
      ]);
      root.append(majorRow);

      const childList = Utils.el('div', { class: 'realm-children' });
      major.children.forEach((child, childIndex) => {
        childList.append(
          Utils.el('div', { class: 'realm-row realm-row--minor' }, [
            Utils.el('span', { class: 'realm-row__branch', text: childIndex === major.children.length - 1 ? '└─' : '├─' }),
            Utils.el('span', { class: 'realm-row__name', text: child.name }),
            realmMenuButton(app, child, childIndex, major.children.length),
          ]),
        );
      });
      childList.append(
        Utils.el('button', {
          type: 'button', class: 'realm-add-child',
          onclick: () => openRealmFormModal(app, { parentId: major.id }),
        }, `+ Tiểu cảnh giới trong "${major.name}"`),
      );
      root.append(childList);
    });

    root.append(
      Utils.el('button', {
        type: 'button', class: 'btn btn--soft btn--block',
        onclick: () => openRealmFormModal(app, { parentId: null }),
      }, '+ Đại cảnh giới mới'),
    );
  }

  function realmMenuButton(app, realm, index, siblingCount) {
    return Utils.el('button', {
      type: 'button', class: 'realm-row__more', title: 'Tuỳ chọn', 'aria-label': 'Tuỳ chọn',
      onclick: (event) => {
        event.stopPropagation();
        const items = [
          { label: 'Sửa tên', onSelect: () => openRealmFormModal(app, { realm }) },
        ];
        if (index > 0) items.push({ label: '↑ Lên trước', onSelect: () => app.store.moveRealm(realm.id, -1) });
        if (index < siblingCount - 1) items.push({ label: '↓ Xuống sau', onSelect: () => app.store.moveRealm(realm.id, 1) });
        items.push({
          label: 'Xoá', variant: 'danger',
          onSelect: async () => {
            const choice = await UI.confirm({
              title: 'Xoá cảnh giới',
              message: `Xoá "${realm.name}"? Không thể xoá nếu còn nhân vật đang dùng.`,
              actions: [{ key: 'confirm', label: 'Xoá', variant: 'danger' }],
            });
            if (choice !== 'confirm') return;
            try {
              app.store.deleteRealm(realm.id);
              Utils.toast('Đã xoá cảnh giới.', 'success');
            } catch (err) {
              Utils.toast(err.message, 'error');
            }
          },
        });
        UI.popover(event.currentTarget, items);
      },
    }, '⋯');
  }

  function openRealmFormModal(app, { realm, parentId } = {}) {
    const isEdit = Boolean(realm);
    const modal = UI.openModal({
      title: isEdit ? 'Sửa tên cảnh giới' : (parentId ? '+ Thêm tiểu cảnh giới' : '+ Thêm đại cảnh giới'),
      size: 'sm',
    });
    const nameInput = UI.input({ value: isEdit ? realm.name : '', placeholder: 'Tên cảnh giới' });
    const errorBox = Utils.el('p', { class: 'form-error', style: { display: 'none' } });
    modal.body.append(UI.field('Tên', nameInput), errorBox);
    modal.footer.append(
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: modal.close }, 'Huỷ'),
      Utils.el('button', {
        type: 'button', class: 'btn btn--primary',
        onclick: () => {
          try {
            if (isEdit) app.store.renameRealm(realm.id, nameInput.value);
            else app.store.createRealm(nameInput.value, parentId);
            modal.close();
          } catch (err) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
          }
        },
      }, isEdit ? 'Lưu' : 'Thêm'),
    );
  }

  return { render, openCreateFamilyModal };
})();
