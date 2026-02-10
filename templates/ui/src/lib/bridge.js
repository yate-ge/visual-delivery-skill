/**
 * Visual Delivery Bridge Script
 *
 * Injected into every generated-HTML iframe by the platform.
 * Provides:
 *   1. Annotation feedback  – global text-selection → postMessage to parent
 *   2. Interactive feedback  – data-vd-feedback-* elements → postMessage
 *      - Button clicks (predefined options) and form submissions ("Other..." text)
 *      - Mutual exclusion: same item-id allows only one action at a time
 *   3. Height sync           – ResizeObserver → postMessage
 *   4. Token update listener – parent sends updated CSS vars
 *   5. Feedback reset        – parent can reset selected states
 *
 * Communication protocol (iframe → parent):
 *   { type: 'vd:annotation',  payload }
 *   { type: 'vd:interactive', payload }
 *   { type: 'vd:resize',      height  }
 *
 * Communication protocol (parent → iframe):
 *   { type: 'vd:tokens-update', css }
 *   { type: 'vd:highlight',     target }
 *   { type: 'vd:feedback-reset', action, itemId }
 *   { type: 'vd:feedback-reset-all' }
 */
export function getBridgeScript(lang) {
  const isZh = lang === 'zh';
  const i18n = {
    selectedText: isZh ? '选中文本' : 'Selected Text',
    notePlaceholder: isZh ? '为选中内容添加反馈...' : 'Add feedback for this selection...',
    addToSidebar: isZh ? '加入侧边栏' : 'Add to sidebar',
    close: isZh ? '关闭' : 'Close',
  };

  return `
<script>
(function() {
  'use strict';

  var ORIGIN = '*';
  var I18N = ${JSON.stringify(i18n)};

  /* ------------------------------------------------------------------ */
  /*  Selected state tracking for interactive feedback                    */
  /* ------------------------------------------------------------------ */

  // Track by action:itemId -> true
  var selectedFeedback = {};
  // Track by itemId -> action (for mutual exclusion)
  var itemIdActions = {};

  function feedbackKey(action, itemId) {
    return action + ':' + (itemId || '_');
  }

  function deselectByKey(action, itemId) {
    var key = feedbackKey(action, itemId);
    delete selectedFeedback[key];
    // Find and reset the element visually
    var selector = '[data-vd-feedback-action="' + action + '"]';
    if (itemId) selector += '[data-vd-feedback-item-id="' + itemId + '"]';
    var els = document.querySelectorAll(selector);
    for (var i = 0; i < els.length; i++) {
      els[i].classList.remove('vd-selected');
    }
  }

  function markSelected(el, action, itemId) {
    var key = feedbackKey(action, itemId);
    if (selectedFeedback[key]) return false; // already selected

    // Mutual exclusion: if same itemId has a different action, deselect it first
    if (itemId && itemIdActions[itemId] && itemIdActions[itemId] !== action) {
      var prevAction = itemIdActions[itemId];
      deselectByKey(prevAction, itemId);
      // Notify parent to remove old draft
      window.parent.postMessage({
        type: 'vd:interactive-replace',
        oldAction: prevAction,
        newAction: action,
        itemId: itemId,
      }, ORIGIN);
    }

    selectedFeedback[key] = true;
    if (itemId) itemIdActions[itemId] = action;
    el.classList.add('vd-selected');
    return true;
  }

  function markDeselected(action, itemId) {
    deselectByKey(action, itemId);
    if (itemId && itemIdActions[itemId] === action) {
      delete itemIdActions[itemId];
    }
  }

  /* Inject feedback option CSS */
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    /* Base pill/chip style for all feedback buttons (fallback if agent omits inline styles) */
    'button[data-vd-feedback-action] { position:relative; padding:6px 16px; border:1px solid var(--vds-colors-border, #e2e8f0); border-radius:8px; background:var(--vds-colors-surface, #f8fafc); color:var(--vds-colors-text, #1e293b); font-size:13px; font-family:inherit; cursor:pointer; transition:all .15s; user-select:none; }',
    'button[data-vd-feedback-action]:hover:not(.vd-selected) { border-color:var(--vds-colors-primary, #3b82f6); color:var(--vds-colors-primary, #3b82f6); }',
    /* Selected state: primary border + checkmark badge, still readable */
    '.vd-selected { border-color:var(--vds-colors-primary, #3b82f6) !important; background:rgba(59,130,246,.08) !important; color:var(--vds-colors-primary, #3b82f6) !important; pointer-events:none; }',
    '.vd-selected::after { content:"\\u2713"; margin-left:6px; font-size:13px; font-weight:700; color:var(--vds-colors-primary, #3b82f6); }',
    /* Form-based feedback (agent-generated "Other..." text input) */
    'form[data-vd-feedback-action].vd-selected { opacity:.7; pointer-events:none; }',
    'form[data-vd-feedback-action].vd-selected::after { content:"\\u2713"; margin-left:6px; font-size:13px; font-weight:700; color:var(--vds-colors-primary, #3b82f6); }',
  ].join('\\n');
  document.head.appendChild(styleEl);

  /* ------------------------------------------------------------------ */
  /*  1. Annotation: text selection toolbar                              */
  /* ------------------------------------------------------------------ */

  var toolbar = null;
  var currentSelection = null;

  function createToolbar() {
    var el = document.createElement('div');
    el.id = 'vd-annotation-toolbar';
    el.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'display:none',
      'width:280px', 'background:#fff',
      'border:1px solid var(--vds-colors-border, #e2e8f0)',
      'border-radius:10px',
      'box-shadow:0 8px 24px rgba(15,23,42,.18)',
      'padding:10px', 'font-family:system-ui,sans-serif',
    ].join(';');
    el.innerHTML = [
      '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;margin-bottom:6px">' + I18N.selectedText + '</div>',
      '<div id="vd-sel-text" style="font-size:13px;line-height:1.5;max-height:56px;overflow:auto;margin-bottom:8px;color:#1e293b"></div>',
      '<textarea id="vd-sel-note" rows="2" placeholder="' + I18N.notePlaceholder + '" style="width:100%;resize:vertical;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"></textarea>',
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">',
        '<button id="vd-sel-submit" style="border:none;border-radius:8px;padding:6px 10px;background:var(--vds-colors-primary,#3b82f6);color:#fff;font-size:13px;cursor:pointer;font-family:inherit">' + I18N.addToSidebar + '</button>',
        '<button id="vd-sel-cancel" style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;background:#fff;color:#64748b;font-size:13px;cursor:pointer;font-family:inherit">' + I18N.close + '</button>',
      '</div>',
    ].join('');
    document.body.appendChild(el);
    el.querySelector('#vd-sel-submit').addEventListener('click', submitAnnotation);
    el.querySelector('#vd-sel-cancel').addEventListener('click', dismissToolbar);
    return el;
  }

  function showToolbar(text, x, y) {
    if (!toolbar) toolbar = createToolbar();
    currentSelection = text;
    toolbar.querySelector('#vd-sel-text').textContent = text;
    toolbar.querySelector('#vd-sel-note').value = '';
    toolbar.style.left = Math.max(8, Math.min(x - 140, window.innerWidth - 296)) + 'px';
    toolbar.style.top  = Math.min(y + 8, window.innerHeight - 200) + 'px';
    toolbar.style.display = 'block';
  }

  function dismissToolbar() {
    if (toolbar) toolbar.style.display = 'none';
    currentSelection = null;
  }

  function submitAnnotation() {
    if (!currentSelection) return;
    var note = (toolbar.querySelector('#vd-sel-note').value || '').trim();
    if (!note) return;
    window.parent.postMessage({
      type: 'vd:annotation',
      payload: {
        kind: 'annotation',
        payload: { text: note, selected_text: currentSelection },
        target: { target_type: 'selected_text', anchor: currentSelection },
      },
    }, ORIGIN);
    dismissToolbar();
    var sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }

  document.addEventListener('mouseup', function() {
    var sel = window.getSelection();
    var text = sel ? sel.toString().trim() : '';
    if (!text || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    showToolbar(text, rect.left + rect.width / 2, rect.bottom);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      dismissToolbar();
    }
  });

  /* ------------------------------------------------------------------ */
  /*  2. Interactive feedback: data-vd-feedback-* elements               */
  /*     Buttons = direct selection; forms = "Other..." text input       */
  /* ------------------------------------------------------------------ */

  function collectFeedbackData(el) {
    var data = {};
    var attrs = el.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      if (name.indexOf('data-vd-feedback-') === 0) {
        var key = name.slice(17); // len('data-vd-feedback-')
        var val = attrs[i].value;
        try { val = JSON.parse(val); } catch(e) { /* keep string */ }
        data[key] = val;
      }
    }
    return data;
  }

  function handleFeedbackClick(e) {
    var el = e.target.closest('[data-vd-feedback-action]');
    if (!el || el.tagName === 'FORM') return;
    // Skip if inside a form with feedback action (form handles submit)
    var closestForm = el.closest('form[data-vd-feedback-action]');
    if (closestForm && closestForm !== el) return;

    var data = collectFeedbackData(el);
    var action = data.action || 'click';
    var itemId = data['item-id'] || null;

    var label = el.getAttribute('data-vd-feedback-label') || el.textContent.trim().slice(0, 80) || action;

    // Try to select (handles mutual exclusion)
    if (!markSelected(el, action, itemId)) return;

    delete data.action;
    var payload = { action: action };
    for (var k in data) {
      if (data.hasOwnProperty(k)) payload[k] = data[k];
    }

    window.parent.postMessage({
      type: 'vd:interactive',
      payload: {
        kind: 'interactive',
        payload: payload,
        target: {
          target_type: 'interactive_element',
          anchor: label,
        },
      },
    }, ORIGIN);
  }

  function handleFeedbackSubmit(e) {
    var form = e.target.closest('[data-vd-feedback-action]');
    if (!form) return;
    e.preventDefault();
    var data = collectFeedbackData(form);
    var action = data.action || 'form_submit';
    var itemId = data['item-id'] || null;

    delete data.action;

    // Collect form field values
    var fields = {};
    var inputs = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var fieldName = input.name || input.id;
      if (!fieldName) continue;
      if (input.type === 'checkbox') { fields[fieldName] = input.checked; }
      else if (input.type === 'radio') { if (input.checked) fields[fieldName] = input.value; }
      else { fields[fieldName] = input.value; }
    }

    // Mutual exclusion for same itemId
    if (itemId && itemIdActions[itemId] && itemIdActions[itemId] !== action) {
      var prevAction = itemIdActions[itemId];
      deselectByKey(prevAction, itemId);
      window.parent.postMessage({
        type: 'vd:interactive-replace',
        oldAction: prevAction,
        newAction: action,
        itemId: itemId,
      }, ORIGIN);
    }

    markSelected(form, action, itemId);

    window.parent.postMessage({
      type: 'vd:interactive',
      payload: {
        kind: 'interactive',
        payload: { action: action, fields: fields, ...data },
        target: {
          target_type: 'interactive_form',
          anchor: form.getAttribute('data-vd-feedback-label') || action,
        },
      },
    }, ORIGIN);
  }

  document.addEventListener('click', handleFeedbackClick);
  document.addEventListener('submit', handleFeedbackSubmit);

  /* ------------------------------------------------------------------ */
  /*  3. Height sync via ResizeObserver                                  */
  /* ------------------------------------------------------------------ */

  var lastHeight = 0;
  function sendHeight() {
    var h = document.documentElement.scrollHeight;
    if (h !== lastHeight) {
      lastHeight = h;
      window.parent.postMessage({ type: 'vd:resize', height: h }, ORIGIN);
    }
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(sendHeight).observe(document.body);
  }
  window.addEventListener('load', sendHeight);
  setTimeout(sendHeight, 100);
  setTimeout(sendHeight, 500);
  setTimeout(sendHeight, 2000);

  /* ------------------------------------------------------------------ */
  /*  4. Listen for messages from parent                                 */
  /* ------------------------------------------------------------------ */

  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data.type !== 'string') return;

    if (e.data.type === 'vd:tokens-update' && typeof e.data.css === 'string') {
      var styleId = 'vd-design-tokens';
      var existing = document.getElementById(styleId);
      if (existing) { existing.textContent = e.data.css; }
      else {
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = e.data.css;
        document.head.appendChild(style);
      }
    }

    if (e.data.type === 'vd:highlight' && e.data.target) {
      var target = e.data.target;
      if (target.anchor) {
        var allEls = document.querySelectorAll('[data-vd-feedback-action]');
        for (var i = 0; i < allEls.length; i++) {
          allEls[i].style.outline = '';
        }
        var match = document.querySelector('[data-vd-feedback-label="' + CSS.escape(target.anchor) + '"]');
        if (match) {
          match.style.outline = '2px solid var(--vds-colors-primary, #3b82f6)';
          match.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    // Reset a specific feedback element's selected state
    if (e.data.type === 'vd:feedback-reset') {
      markDeselected(e.data.action || '', e.data.itemId || '');
    }

    // Reset all feedback selected states
    if (e.data.type === 'vd:feedback-reset-all') {
      selectedFeedback = {};
      itemIdActions = {};
      var allSelected = document.querySelectorAll('.vd-selected');
      for (var j = 0; j < allSelected.length; j++) {
        allSelected[j].classList.remove('vd-selected');
      }
    }
  });

})();
</script>`;
}
