/**
 * CharacterModal - popup chi tiết nhân vật (§21).
 *
 * Sections: Thông tin -> Quan hệ (Cha/Mẹ/Vợ/Chồng/Con) -> Thêm quan hệ -> Xoá.
 * Mở lại modal cùng nhân vật sau mỗi thay đổi để danh sách Quan hệ cập nhật ngay.
 */
const CharacterModal = (() => {
  function open(app, characterId) {
    const { store } = app;
    const character = store.getCharacter(characterId);
    if (!character) return;

    const tree = store.getTree(character.treeId);
    const isRoot = tree?.rootCharacterId === characterId;

    const modal = UI.openModal({
      title: character.name,
      subtitle: [`Đời ${character.generation}`, tree?.name],
      size: 'lg',
      theme: 'scroll',
    });

    const refresh = () => {
      modal.close();
      open(app, characterId);
    };

    /* ---------------- Thông tin ---------------- */

    const nameInput = UI.input({ value: character.name, placeholder: 'Tên nhân vật' });
    const genderSelect = UI.select(
      Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label })),
      character.gender,
    );
    const titleInput = UI.input({ value: character.title, placeholder: 'VD: Gia chủ, Trưởng lão...' });
    const realmSelect = UI.realmSelect(store, character.realmId);
    const statusSelect = UI.select(
      Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
      character.status,
    );
    const noteArea = UI.textarea({ placeholder: 'Ghi chú tự do...' });
    noteArea.value = character.note;
    const generationInput = isRoot
      ? UI.input({ type: 'number', min: '1', value: character.generation })
      : null;

    const noteField = UI.field('Ghi chú', noteArea);
    noteField.classList.add('field--wide');

    const infoGrid = Utils.el('div', { class: 'form-grid' }, [
      UI.field('Tên', nameInput),
      UI.field('Giới tính', genderSelect),
      UI.field('Chức danh', titleInput, 'Nhập tự do, không giới hạn danh sách.'),
      UI.field('Cảnh giới (tu vi)', realmSelect),
      UI.field('Trạng thái', statusSelect),
      generationInput
        ? UI.field('Đời gốc của cây', generationInput, 'Đây là nhân vật gốc của cây — đổi đời sẽ dịch chuyển cả cây này.')
        : null,
      noteField,
    ]);

    const errorBox = Utils.el('p', { class: 'form-error', style: { display: 'none' } });

    modal.body.append(UI.section('Thông tin', [infoGrid, errorBox]));

    /* ---------------- Quan hệ ---------------- */

    const spouses = store.spousesOf(characterId);
    const children = store.childrenOf(characterId);
    const { father, mother } = store.parentsByGender(characterId);

    const relationRows = [];
    relationRows.push(
      Utils.el('div', { class: 'rel-row' }, [
        Utils.el('span', { class: 'rel-row__label', text: 'Cha' }),
        father
          ? Utils.el('div', { class: 'rel-row__chips' }, [
              relationChip(app, father, refresh, () => removeParentRelation(app, characterId, father.id, refresh)),
            ])
          : Utils.el('button', {
              type: 'button', class: 'btn btn--soft btn--sm',
              onclick: () => AddParentModal.open(app, characterId, 'male', refresh),
            }, '+ Thêm cha'),
      ]),
    );
    relationRows.push(
      Utils.el('div', { class: 'rel-row' }, [
        Utils.el('span', { class: 'rel-row__label', text: 'Mẹ' }),
        mother
          ? Utils.el('div', { class: 'rel-row__chips' }, [
              relationChip(app, mother, refresh, () => removeParentRelation(app, characterId, mother.id, refresh)),
            ])
          : Utils.el('button', {
              type: 'button', class: 'btn btn--soft btn--sm',
              onclick: () => AddParentModal.open(app, characterId, 'female', refresh),
            }, '+ Thêm mẹ'),
      ]),
    );
    relationRows.push(
      Utils.el('div', { class: 'rel-row' }, [
        Utils.el('span', { class: 'rel-row__label', text: character.gender === 'female' ? 'Chồng' : 'Vợ/Chồng' }),
        spouses.length
          ? Utils.el('div', { class: 'rel-row__chips' },
              spouses.map((s) => relationChip(
                app, store.getCharacter(s.id), refresh,
                () => removeRelationship(app, s.relId, refresh),
              )))
          : Utils.el('span', { class: 'rel-row__empty', text: 'Chưa có' }),
      ]),
    );
    relationRows.push(
      Utils.el('div', { class: 'rel-row' }, [
        Utils.el('span', { class: 'rel-row__label', text: 'Con' }),
        children.length
          ? Utils.el('div', { class: 'rel-row__chips' },
              children.map((c) => relationChip(
                app, store.getCharacter(c.id), refresh,
                () => removeRelationship(app, c.relId, refresh),
              )))
          : Utils.el('span', { class: 'rel-row__empty', text: 'Chưa có' }),
      ]),
    );

    modal.body.append(UI.section('Quan hệ', relationRows));

    /* ---------------- Thêm quan hệ ---------------- */

    modal.body.append(
      UI.section('Thêm quan hệ', [
        Utils.el('p', { class: 'section__desc', text: 'Vợ/chồng cùng đời với nhân vật này; con bắt đầu một đời mới, xuất phát từ chính nhân vật này.' }),
        Utils.el('div', { class: 'btn-row' }, [
          Utils.el('button', {
            type: 'button', class: 'btn btn--primary',
            onclick: () => AddRelativeModal.open(app, characterId, 'spouse', refresh),
          }, '+ Thêm vợ/chồng'),
          Utils.el('button', {
            type: 'button', class: 'btn btn--soft',
            onclick: () => AddRelativeModal.open(app, characterId, 'child', refresh),
          }, '+ Thêm con'),
        ]),
      ], null, { variant: 'callout' }),
    );

    /* ---------------- Footer ---------------- */

    modal.footer.append(
      Utils.el('button', {
        type: 'button', class: 'btn btn--danger',
        onclick: () => handleDelete(app, characterId, modal.close),
      }, 'Xoá'),
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: modal.close }, 'Đóng'),
      Utils.el('button', {
        type: 'button', class: 'btn btn--primary',
        onclick: () => {
          errorBox.style.display = 'none';
          try {
            store.updateCharacter(characterId, {
              name: nameInput.value,
              gender: genderSelect.value,
              title: titleInput.value,
              realmId: realmSelect.value || null,
              status: statusSelect.value,
              note: noteArea.value,
              generation: generationInput ? generationInput.value : undefined,
            });
            Utils.toast('Đã lưu thay đổi.', 'success');
            modal.close();
            app.tree.focusCharacter(characterId);
          } catch (err) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
          }
        },
      }, 'Lưu'),
    );
  }

  function relationChip(app, character, onNavigate, onRemove) {
    if (!character) return null;
    const chip = Utils.el('span', { class: 'chip' }, [
      Utils.el('button', {
        type: 'button', class: 'chip__name',
        onclick: () => { UI.closeTopModal(); open(app, character.id); },
      }, character.name),
      onRemove
        ? Utils.el('button', {
            type: 'button', class: 'chip__remove', title: 'Gỡ quan hệ này',
            onclick: onRemove,
          }, '×')
        : null,
    ]);
    return chip;
  }

  async function removeRelationship(app, relId, refresh) {
    const choice = await UI.confirm({
      title: 'Gỡ quan hệ',
      message: 'Gỡ quan hệ này sẽ không xoá nhân vật, chỉ huỷ liên kết trong cây.',
      actions: [{ key: 'remove', label: 'Gỡ quan hệ', variant: 'danger' }],
      theme: 'scroll',
    });
    if (choice !== 'remove') return;
    app.store.deleteRelationship(relId);
    Utils.toast('Đã gỡ quan hệ.', 'success');
    refresh();
  }

  function removeParentRelation(app, childId, parentId, refresh) {
    const rel = app.store.relationships.find((r) => r.type === 'parent' && r.from === parentId && r.to === childId);
    if (!rel) return;
    removeRelationship(app, rel.id, refresh);
  }

  async function handleDelete(app, characterId, closeModal) {
    const { store } = app;
    const impact = store.deletionImpact(characterId);
    if (!impact) return;

    if (impact.isRoot) {
      Utils.toast('Nhân vật gốc của cây: nếu xoá, người kế thừa (nếu có) sẽ tự động lên làm gốc mới.', 'info');
    }

    const lines = [`Bạn có chắc muốn xoá "${impact.character.name}"?`];
    if (impact.spouseCount) lines.push(`- Sẽ gỡ ${impact.spouseCount} quan hệ vợ/chồng.`);
    if (impact.childCount) {
      lines.push(`- Nhân vật này có ${impact.childCount} con.`);
      if (impact.orphanedChildren.length) {
        lines.push(`  Nếu chỉ xoá riêng, ${impact.orphanedChildren.map((c) => c.name).join(', ')} sẽ mất cha/mẹ còn lại nhưng vẫn ở nguyên vị trí trong cây.`);
      }
    }
    if (impact.cascadeCount > 1) {
      lines.push(`- Xoá cả nhánh sẽ xoá thêm ${impact.cascadeCount - 1} người: ${impact.cascadeNames.slice(1, 6).join(', ')}${impact.cascadeCount - 1 > 5 ? '…' : ''}.`);
    }

    const actions = [{ key: 'single', label: 'Chỉ xoá người này', variant: 'danger' }];
    if (impact.childCount) actions.push({ key: 'cascade', label: 'Xoá cả nhánh con cháu', variant: 'danger' });

    const choice = await UI.confirm({ title: 'Xác nhận xoá', message: lines.join('\n'), actions, theme: 'scroll' });
    if (!choice) return;

    try {
      store.deleteCharacter(characterId, choice);
      Utils.toast('Đã xoá nhân vật.', 'success');
      closeModal();
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  return { open };
})();

/* ------------------------------------------------------------------ *
 * AddRelativeModal - thêm vợ/chồng hoặc con (§8, §9)
 * ------------------------------------------------------------------ */
const AddRelativeModal = (() => {
  function open(app, anchorId, kindFilter, onDone) {
    const { store } = app;
    const anchor = store.getCharacter(anchorId);
    if (!anchor) return;

    const options = RELATION_OPTIONS.filter((o) => o.kind === kindFilter);

    const modal = UI.openModal({
      title: kindFilter === 'spouse' ? '+ Thêm vợ/chồng' : '+ Thêm con',
      subtitle: `Xuất phát từ: ${anchor.name}`,
      size: 'md',
      theme: 'scroll',
    });

    const relationSelect = UI.select(
      options.map((o) => ({ value: o.value, label: o.label })),
      options[0].value,
    );
    const nameInput = UI.input({ placeholder: 'Tên nhân vật mới' });
    const genderSelect = UI.select(
      Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label })),
      options[0].defaultGender,
    );
    const titleInput = UI.input({ placeholder: 'Chức danh (tuỳ chọn)' });
    const realmSelect = UI.realmSelect(store, null);
    const statusSelect = UI.select(
      Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
      'alive',
    );
    const noteArea = UI.textarea({ placeholder: 'Ghi chú (tuỳ chọn)' });

    relationSelect.addEventListener('change', () => {
      const option = options.find((o) => o.value === relationSelect.value);
      genderSelect.value = option.defaultGender;
    });

    // Nếu thêm con và nhân vật gốc có nhiều vợ/chồng -> cho chọn thêm cha/mẹ còn lại
    const spouseOptions = store.spousesOf(anchorId)
      .map((s) => store.getCharacter(s.id))
      .filter(Boolean);
    const secondParentSelect = UI.select(
      [{ value: '', label: '— Không chọn —' }, ...spouseOptions.map((c) => ({ value: c.id, label: c.name }))],
      '',
    );
    const secondParentField = UI.field('Cha/mẹ còn lại (nếu có)', secondParentSelect, 'Chỉ áp dụng khi thêm con.');
    secondParentField.style.display = kindFilter === 'child' ? '' : 'none';

    const errorBox = Utils.el('p', { class: 'form-error', style: { display: 'none' } });

    modal.body.append(
      UI.field('Quan hệ', relationSelect),
      UI.field('Tên', nameInput),
      Utils.el('div', { class: 'form-grid' }, [
        UI.field('Giới tính', genderSelect),
        UI.field('Chức danh', titleInput),
        UI.field('Cảnh giới (tu vi)', realmSelect),
        UI.field('Trạng thái', statusSelect),
      ]),
      secondParentField,
      UI.field('Ghi chú', noteArea),
      errorBox,
    );

    modal.footer.append(
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: modal.close }, 'Huỷ'),
      Utils.el('button', {
        type: 'button', class: 'btn btn--primary',
        onclick: () => {
          errorBox.style.display = 'none';
          try {
            const created = store.addRelative(anchorId, relationSelect.value, {
              name: nameInput.value,
              gender: genderSelect.value,
              title: titleInput.value,
              realmId: realmSelect.value || null,
              status: statusSelect.value,
              note: noteArea.value,
            }, secondParentSelect.value || null);
            Utils.toast(`Đã thêm ${created.name}.`, 'success');
            modal.close();
            if (onDone) onDone();
            else app.refreshTree();
            app.tree.focusCharacter(created.id);
          } catch (err) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
          }
        },
      }, 'Thêm'),
    );
  }
  return { open };
})();

/* ------------------------------------------------------------------ *
 * AddParentModal - "+ Thêm cha" / "+ Thêm mẹ" (§10-§14)
 * ------------------------------------------------------------------ */
const AddParentModal = (() => {
  function open(app, childId, parentGender, onDone) {
    const { store } = app;
    const child = store.getCharacter(childId);
    if (!child) return;
    const roleLabel = parentGender === 'male' ? 'cha' : 'mẹ';

    const modal = UI.openModal({
      title: `+ Thêm ${roleLabel}`,
      subtitle: `Cho: ${child.name} (đời ${child.generation})`,
      size: 'md',
      theme: 'scroll',
    });

    const candidates = store.parentCandidatesFor(childId);

    const modeSelect = UI.select(
      [
        { value: 'new', label: 'Tạo nhân vật mới' },
        ...(candidates.length ? [{ value: 'existing', label: 'Chọn nhân vật có sẵn' }] : []),
      ],
      'new',
    );

    const nameInput = UI.input({ placeholder: `Tên người ${roleLabel}` });
    const genderSelect = UI.select(
      Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label })),
      parentGender,
    );
    const titleInput = UI.input({ placeholder: 'Chức danh (tuỳ chọn)' });
    const realmSelect = UI.realmSelect(store, null);
    const statusSelect = UI.select(
      Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
      'alive',
    );
    const noteArea = UI.textarea({ placeholder: 'Ghi chú (tuỳ chọn)' });
    const newFields = Utils.el('div', { class: 'section__body' }, [
      UI.field('Tên', nameInput),
      Utils.el('div', { class: 'form-grid' }, [
        UI.field('Giới tính', genderSelect),
        UI.field('Chức danh', titleInput),
        UI.field('Cảnh giới (tu vi)', realmSelect),
        UI.field('Trạng thái', statusSelect),
      ]),
      UI.field('Ghi chú', noteArea),
    ]);

    const existingSelect = candidates.length
      ? UI.select(candidates.map((c) => ({ value: c.id, label: `${c.name} (đời ${c.generation})` })), candidates[0].id)
      : null;
    const existingField = existingSelect
      ? UI.field('Chọn nhân vật có sẵn', existingSelect, 'Chỉ hiện nhân vật cùng cây huyết thống, đúng đời liền trước - tránh tạo trùng nhân vật.')
      : null;

    const adoptedCheckbox = Utils.el('input', { type: 'checkbox', id: 'adopted-check' });
    const adoptedField = Utils.el('label', { class: 'field field--row' }, [
      adoptedCheckbox,
      Utils.el('span', { text: 'Là quan hệ nhận nuôi (con nuôi)' }),
    ]);

    const errorBox = Utils.el('p', { class: 'form-error', style: { display: 'none' } });

    function syncMode() {
      const mode = modeSelect.value;
      newFields.style.display = mode === 'new' ? '' : 'none';
      if (existingField) existingField.style.display = mode === 'existing' ? '' : 'none';
    }
    modeSelect.addEventListener('change', syncMode);

    // Lọc null: Node.append() sẽ chèn chuỗi "null" thay vì bỏ qua.
    modal.body.append(...[
      candidates.length ? UI.field('Cách thêm', modeSelect) : null,
      newFields,
      existingField,
      adoptedField,
      errorBox,
    ].filter(Boolean));
    syncMode();

    modal.footer.append(
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: modal.close }, 'Huỷ'),
      Utils.el('button', {
        type: 'button', class: 'btn btn--primary',
        onclick: () => {
          errorBox.style.display = 'none';
          try {
            let created;
            if (modeSelect.value === 'existing' && existingSelect) {
              created = store.linkExistingParent(childId, existingSelect.value, adoptedCheckbox.checked);
            } else {
              created = store.addNewParent(childId, parentGender, {
                name: nameInput.value,
                gender: genderSelect.value,
                title: titleInput.value,
                realmId: realmSelect.value || null,
                status: statusSelect.value,
                note: noteArea.value,
              }, adoptedCheckbox.checked);
            }
            Utils.toast(`Đã thêm ${roleLabel}: ${created.name}.`, 'success');
            modal.close();
            if (onDone) onDone();
            else app.refreshTree();
            app.tree.focusCharacter(created.id);
          } catch (err) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
          }
        },
      }, 'Thêm'),
    );
  }
  return { open };
})();
