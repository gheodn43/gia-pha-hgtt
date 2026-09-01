/**
 * CreateTreeModal - "+ Tạo cây huyết thống" (§6, §24).
 *
 * Có thể mở từ Sidebar (tự nhập đời bắt đầu) hoặc bằng cách bấm vào nhãn
 * "Đời N" trên canvas (đời bắt đầu được điền sẵn = N). Root của cây mới
 * nhận đúng generation đã chọn - KHÔNG bị ép về đời 1.
 */
const CreateTreeModal = (() => {
  function open(app, familyId, presetGeneration = null) {
    const { store } = app;
    const family = store.getFamily(familyId);
    if (!family) return;

    const modal = UI.openModal({
      title: '+ Tạo cây huyết thống',
      subtitle: presetGeneration
        ? `Gia phả: ${family.name} · bắt đầu tại đời ${presetGeneration}`
        : `Gia phả: ${family.name}`,
      size: 'sm',
    });

    const nameInput = UI.input({ placeholder: 'VD: Huyết thống thứ hai' });
    const genInput = UI.input({ type: 'number', min: '1', value: presetGeneration || 1 });
    const rootInput = UI.input({ placeholder: 'VD: Tần Thiên', value: 'Thủy tổ' });
    const errorBox = Utils.el('p', { class: 'form-error', style: { display: 'none' } });

    modal.body.append(
      UI.field('Tên cây huyết thống', nameInput),
      UI.field('Generation bắt đầu (đời gốc)', genInput, 'Cây mới độc lập, không nối vào cây nào khác — đời gốc có thể là bất kỳ số nào.'),
      UI.field('Tên nhân vật gốc', rootInput),
      errorBox,
    );

    modal.footer.append(
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: modal.close }, 'Huỷ'),
      Utils.el('button', {
        type: 'button', class: 'btn btn--primary',
        onclick: () => {
          errorBox.style.display = 'none';
          try {
            const tree = store.createTree(familyId, nameInput.value, genInput.value, rootInput.value);
            Utils.toast(`Đã tạo cây huyết thống "${tree.name}".`, 'success');
            modal.close();
            app.tree.focusCharacter(tree.rootCharacterId);
          } catch (err) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
          }
        },
      }, 'Tạo cây'),
    );
  }
  return { open };
})();
