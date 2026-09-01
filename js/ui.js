/**
 * UI - các thành phần giao diện dùng lại: modal, confirm, popover, form field.
 * Không biết gì về nghiệp vụ gia phả (trừ helper dựng select cảnh giới).
 */
const UI = (() => {
  const stack = [];

  function modalRoot() {
    return document.getElementById('modal-root');
  }

  /**
   * Dựng dòng phụ đề. Nhận string, hoặc mảng nhiều đoạn -> ngăn nhau bằng dấu tròn.
   */
  function subtitleNode(subtitle) {
    const parts = (Array.isArray(subtitle) ? subtitle : [subtitle])
      .filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
      .map(String);
    if (!parts.length) return null;

    const children = [];
    parts.forEach((part, index) => {
      if (index) children.push(Utils.el('span', { class: 'modal__subtitle-dot', 'aria-hidden': 'true' }));
      children.push(Utils.el('span', { text: part }));
    });
    return Utils.el('p', { class: 'modal__subtitle' }, children);
  }

  /**
   * Mở modal.
   * @param {object} [options]
   * @param {string|string[]} [options.subtitle] mảng -> các đoạn ngăn nhau bằng dấu tròn
   * @param {string} [options.theme] biến thể giao diện, VD 'scroll' (giấy thư tịch cổ)
   * @returns {{close:Function, body:HTMLElement, footer:HTMLElement, dialog:HTMLElement}}
   */
  function openModal({ title, subtitle, size = 'md', theme, onClose } = {}) {
    const body = Utils.el('div', { class: 'modal__body' });
    const footer = Utils.el('div', { class: 'modal__footer' });

    const closeBtn = Utils.el('button', {
      type: 'button', class: 'modal__close', title: 'Đóng', 'aria-label': 'Đóng',
    }, '×');

    const dialog = Utils.el('div', {
      class: `modal modal--${size}${theme ? ` modal--${theme}` : ''}`,
      role: 'dialog', 'aria-modal': 'true',
    }, [
      Utils.el('header', { class: 'modal__header' }, [
        Utils.el('div', { class: 'modal__heading' }, [
          Utils.el('h2', { class: 'modal__title', text: title || '' }),
          subtitleNode(subtitle),
        ]),
        closeBtn,
      ]),
      body,
      footer,
    ]);

    const backdrop = Utils.el('div', {
      class: `modal-backdrop${theme ? ` modal-backdrop--${theme}` : ''}`,
    }, [dialog]);
    modalRoot().append(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('is-open'));

    const entry = { backdrop, close };
    stack.push(entry);
    document.body.classList.add('has-modal');

    function close() {
      const index = stack.indexOf(entry);
      if (index === -1) return;
      stack.splice(index, 1);
      backdrop.classList.remove('is-open');
      setTimeout(() => backdrop.remove(), 180);
      if (!stack.length) document.body.classList.remove('has-modal');
      if (onClose) onClose();
    }

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) close();
    });

    setTimeout(() => {
      const first = dialog.querySelector('input, select, textarea, button:not(.modal__close)');
      if (first) first.focus();
    }, 60);

    return { close, body, footer, dialog };
  }

  function closeTopModal() {
    if (stack.length) stack[stack.length - 1].close();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePopover();
      closeTopModal();
    }
  });

  /**
   * Hộp thoại xác nhận, hỗ trợ nhiều lựa chọn hành động.
   * @returns {Promise<string|null>} key của hành động, null nếu huỷ
   */
  function confirm({ title, message, actions, cancelText = 'Huỷ', theme }) {
    return new Promise((resolve) => {
      let settled = false;
      const modal = openModal({
        title,
        size: 'sm',
        theme,
        onClose: () => { if (!settled) { settled = true; resolve(null); } },
      });

      const lines = String(message).split('\n');
      for (const line of lines) {
        modal.body.append(Utils.el('p', { class: 'confirm__line', text: line }));
      }

      const finish = (key) => {
        settled = true;
        modal.close();
        resolve(key);
      };

      modal.footer.append(
        Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => finish(null) }, cancelText),
      );
      const list = actions && actions.length ? actions : [{ key: 'confirm', label: 'Đồng ý', variant: 'danger' }];
      for (const action of list) {
        modal.footer.append(
          Utils.el('button', {
            type: 'button',
            class: `btn btn--${action.variant || 'primary'}`,
            onclick: () => finish(action.key),
          }, action.label),
        );
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Popover (menu nhỏ neo vào một element)
   * ------------------------------------------------------------------ */

  let activePopover = null;

  function closePopover() {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
    }
  }

  document.addEventListener('mousedown', (event) => {
    if (activePopover && !activePopover.contains(event.target)) closePopover();
  });

  function popover(anchor, items) {
    closePopover();
    const menu = Utils.el('div', { class: 'popover' },
      items.map((item) =>
        Utils.el('button', {
          type: 'button',
          class: `popover__item${item.variant ? ` popover__item--${item.variant}` : ''}`,
          onclick: () => { closePopover(); item.onSelect(); },
        }, item.label),
      ),
    );
    document.body.append(menu);
    const rect = anchor.getBoundingClientRect();
    const top = Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 12);
    const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - 12);
    menu.style.top = `${Math.max(8, top)}px`;
    menu.style.left = `${Math.max(8, left)}px`;
    activePopover = menu;
  }

  /* ------------------------------------------------------------------ *
   * Form helpers
   * ------------------------------------------------------------------ */

  function field(labelText, control, hint) {
    return Utils.el('label', { class: 'field' }, [
      Utils.el('span', { class: 'field__label', text: labelText }),
      control,
      hint ? Utils.el('span', { class: 'field__hint', text: hint }) : null,
    ]);
  }

  function input(attrs = {}) {
    return Utils.el('input', { class: 'input', type: 'text', ...attrs });
  }

  function textarea(attrs = {}) {
    return Utils.el('textarea', { class: 'input input--area', rows: 4, ...attrs });
  }

  function select(options, selected, attrs = {}) {
    const node = Utils.el('select', { class: 'input', ...attrs });
    for (const option of options) {
      node.append(Utils.el('option', { value: option.value, selected: option.value === selected }, option.label));
    }
    return node;
  }

  /** Select cảnh giới dạng nhóm: optgroup = đại cảnh giới (§15) */
  function realmSelect(store, selectedId, attrs = {}) {
    const node = Utils.el('select', { class: 'input', ...attrs });
    node.append(Utils.el('option', { value: '', selected: !selectedId }, '— Phàm nhân —'));
    for (const major of store.realmTree()) {
      const group = Utils.el('optgroup', { label: major.name });
      group.append(
        Utils.el('option', { value: major.id, selected: selectedId === major.id }, `${major.name} (đại cảnh giới)`),
      );
      for (const child of major.children) {
        group.append(
          Utils.el('option', { value: child.id, selected: selectedId === child.id }, `${major.name} / ${child.name}`),
        );
      }
      node.append(group);
    }
    return node;
  }

  function section(title, children, actions, { variant } = {}) {
    return Utils.el('section', { class: `section${variant ? ` section--${variant}` : ''}` }, [
      Utils.el('div', { class: 'section__head' }, [
        Utils.el('h3', { class: 'section__title', text: title }),
        actions || null,
      ]),
      Utils.el('div', { class: 'section__body' }, children),
    ]);
  }

  return {
    openModal, closeTopModal, confirm, popover, closePopover,
    field, input, textarea, select, realmSelect, section,
  };
})();
