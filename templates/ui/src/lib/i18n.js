const locales = {
  en: {
    appTitle: 'Task Delivery',
    settings: 'Settings',
    loading: 'Loading deliveries...',
    noDeliveries: 'No deliveries yet. The agent will create them as needed.',
    agentWaiting: 'Agent is waiting for your response',
    all: 'All',
    passive: 'Passive',
    interactive: 'Interactive',
    blocking: 'Blocking',
    backToList: '\u2190 Back to list',
    backToDashboard: '\u2190 Back to dashboard',
    yourFeedback: 'Your Feedback',
    feedbackSubmitted: 'Feedback submitted',
    annotations: 'Annotations',
    addComment: '+ Add Comment',
    submit: 'Submit',
    cancel: 'Cancel',
    addCommentPlaceholder: 'Add a comment...',
    justNow: 'just now',
    minAgo: '{n} min ago',
    hoursAgo: '{n}h ago',
    daysAgo: '{n}d ago',
    deliveryNotFound: 'Delivery not found',
    designSystem: 'Design System',
    designDesc: 'Edit the design specification or tokens to customize the UI appearance. Changes to tokens.json take effect immediately.',
    designSpec: 'Design Spec',
    designTokens: 'Design Tokens',
    currentTokenValues: 'Current Token Values',
    loadingTokens: 'Loading tokens...',
  },
  zh: {
    appTitle: '\u4efb\u52a1\u4ea4\u4ed8\u5e73\u53f0',
    settings: '\u8bbe\u7f6e',
    loading: '\u6b63\u5728\u52a0\u8f7d\u4ea4\u4ed8\u4efb\u52a1...',
    noDeliveries: '\u6682\u65e0\u4ea4\u4ed8\u4efb\u52a1\u3002Agent \u5b8c\u6210\u4efb\u52a1\u540e\u4f1a\u81ea\u52a8\u521b\u5efa\u3002',
    agentWaiting: 'Agent \u6b63\u5728\u7b49\u5f85\u60a8\u7684\u56de\u590d',
    all: '\u5168\u90e8',
    passive: '\u5c55\u793a',
    interactive: '\u4ea4\u4e92',
    blocking: '\u5f85\u51b3\u7b56',
    backToList: '\u2190 \u8fd4\u56de\u5217\u8868',
    backToDashboard: '\u2190 \u8fd4\u56de\u4eea\u8868\u76d8',
    yourFeedback: '\u60a8\u7684\u53cd\u9988',
    feedbackSubmitted: '\u53cd\u9988\u5df2\u63d0\u4ea4',
    annotations: '\u6279\u6ce8',
    addComment: '+ \u6dfb\u52a0\u8bc4\u8bba',
    submit: '\u63d0\u4ea4',
    cancel: '\u53d6\u6d88',
    addCommentPlaceholder: '\u6dfb\u52a0\u8bc4\u8bba...',
    justNow: '\u521a\u521a',
    minAgo: '{n} \u5206\u949f\u524d',
    hoursAgo: '{n} \u5c0f\u65f6\u524d',
    daysAgo: '{n} \u5929\u524d',
    deliveryNotFound: '\u4ea4\u4ed8\u4efb\u52a1\u672a\u627e\u5230',
    designSystem: '\u8bbe\u8ba1\u7cfb\u7edf',
    designDesc: '\u7f16\u8f91\u8bbe\u8ba1\u89c4\u8303\u6216 tokens \u6765\u81ea\u5b9a\u4e49 UI \u5916\u89c2\u3002\u4fee\u6539 tokens.json \u540e\u7acb\u5373\u751f\u6548\u3002',
    designSpec: '\u8bbe\u8ba1\u89c4\u8303',
    designTokens: '\u8bbe\u8ba1 Tokens',
    currentTokenValues: '\u5f53\u524d Token \u503c',
    loadingTokens: '\u6b63\u5728\u52a0\u8f7d Tokens...',
  }
};

let currentLang = 'en';

export function setLang(lang) {
  currentLang = locales[lang] ? lang : 'en';
}

export function t(key, params = {}) {
  const str = (locales[currentLang] && locales[currentLang][key]) || locales.en[key] || key;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
}

export function getLang() {
  return currentLang;
}
