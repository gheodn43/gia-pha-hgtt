/**
 * Utils - các hàm tiện ích dùng chung.
 * Không phụ thuộc vào state của ứng dụng.
 */
const Utils = (() => {
  let idCounter = 0;

  /** Sinh id duy nhất dạng prefix_xxxxx */
  function uid(prefix) {
    idCounter += 1;
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rand}`;
  }

  /** Clone sâu bằng JSON (dữ liệu app luôn là JSON thuần, không circular) */
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Tạo element nhanh.
   * el('div', { class: 'x', dataset: {id: 1}, onclick: fn }, [child|string])
   */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, value);
    }
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  /** Tạo element trong namespace SVG */
  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined) continue;
      node.setAttribute(key, value);
    }
    return node;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** Thông báo nổi góc phải */
  function toast(message, type = 'info', timeout = 3200) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const box = el('div', { class: `toast toast--${type}`, text: message });
    root.append(box);
    requestAnimationFrame(() => box.classList.add('is-visible'));
    setTimeout(() => {
      box.classList.remove('is-visible');
      setTimeout(() => box.remove(), 250);
    }, timeout);
  }

  /** Tải một chuỗi text xuống máy dưới dạng file */
  function downloadText(filename, text, mime = 'application/json') {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Đọc file (input[type=file]) thành text */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Không đọc được file.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  return { uid, clone, el, svgEl, clamp, toast, downloadText, readFileAsText };
})();
