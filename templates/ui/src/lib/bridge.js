/**
 * Visual Delivery Bridge Script
 *
 * Injected into every generated-HTML iframe by the platform.
 * Provides:
 *   1. Annotation feedback  – global text-selection → postMessage to parent
 *   2. Interactive feedback  – data-vd-feedback-* elements → postMessage
 *   3. Height sync           – ResizeObserver → postMessage
 *   4. Token update listener – parent sends updated CSS vars
 *
 * Communication protocol (iframe → parent):
 *   { type: 'vd:annotation',  payload }
 *   { type: 'vd:interactive', payload }
 *   { type: 'vd:resize',      height  }
 *
 * Communication protocol (parent → iframe):
 *   { type: 'vd:tokens-update', css }
 *   { type: 'vd:highlight',     target }
 */
export function getBridgeScript() {
  return `
<script>
(function() {
  'use strict';

  var ORIGIN = '*';

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
      '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;margin-bottom:6px">Selected text</div>',
      '<div id="vd-sel-text" style="font-size:13px;line-height:1.5;max-height:56px;overflow:auto;margin-bottom:8px;color:#1e293b"></div>',
      '<textarea id="vd-sel-note" rows="2" placeholder="Add feedback for this selection..." style="width:100%;resize:vertical;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"></textarea>',
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">',
        '<button id="vd-sel-submit" style="border:none;border-radius:8px;padding:6px 10px;background:var(--vds-colors-primary,#3b82f6);color:#fff;font-size:13px;cursor:pointer;font-family:inherit">Add to sidebar</button>',
        '<button id="vd-sel-cancel" style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;background:#fff;color:#64748b;font-size:13px;cursor:pointer;font-family:inherit">Close</button>',
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
    if (e.key === 'Escape') dismissToolbar();
  });

  /* ------------------------------------------------------------------ */
  /*  2. Interactive feedback: data-vd-feedback-* elements               */
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
    if (!el) return;
    var data = collectFeedbackData(el);
    var action = data.action || 'click';
    delete data.action;
    window.parent.postMessage({
      type: 'vd:interactive',
      payload: {
        kind: 'interactive',
        payload: { action: action, ...data },
        target: {
          target_type: 'interactive_element',
          anchor: el.textContent.trim().slice(0, 80) || action,
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
      // Optional: highlight a feedback target element
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
  });

})();
</script>`;
}
