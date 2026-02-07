import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDesignTokens } from '../hooks/useDesignTokens';
import { flattenTokens } from '../lib/theme';
import { fetchSettings, updateSettings } from '../lib/api';

export default function Settings() {
  const tokens = useDesignTokens();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const flatTokens = useMemo(() => (tokens ? flattenTokens(tokens) : {}), [tokens]);

  useEffect(() => {
    fetchSettings()
      .then((data) => setSettings(data))
      .catch((err) => setMessage(`Error loading settings: ${err.message}`));
  }, []);

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    setMessage('');
    try {
      const next = await updateSettings(settings);
      setSettings(next);
      setMessage('Platform settings saved.');
    } catch (err) {
      setMessage(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function updateField(field, value) {
    setSettings((prev) => ({
      ...prev,
      platform: {
        ...(prev?.platform || {}),
        [field]: value,
      },
    }));
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.backLink}>&larr; Back</Link>
        <h1 style={styles.title}>Settings</h1>
      </header>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Platform Branding</h2>
        {!settings ? (
          <p style={styles.description}>Loading settings...</p>
        ) : (
          <div style={styles.form}>
            <label style={styles.label}>
              Platform Name
              <input
                value={settings.platform?.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Logo URL
              <input
                value={settings.platform?.logo_url || ''}
                onChange={(e) => updateField('logo_url', e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Slogan
              <input
                value={settings.platform?.slogan || ''}
                onChange={(e) => updateField('slogan', e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Visual Style
              <input
                value={settings.platform?.visual_style || ''}
                onChange={(e) => updateField('visual_style', e.target.value)}
                style={styles.input}
              />
            </label>

            <button onClick={handleSave} style={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save Platform Settings'}
            </button>
            {message && <div style={styles.message}>{message}</div>}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Design Files</h2>
        <div style={styles.pathList}>
          <code style={styles.path}>.visual-delivery/design/design-spec.md</code>
          <code style={styles.path}>.visual-delivery/design/tokens.json</code>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Current Token Values</h2>
        {tokens ? (
          <div style={styles.tokenList}>
            {Object.entries(flatTokens).map(([key, value]) => (
              <div key={key} style={styles.tokenItem}>
                <code style={styles.tokenKey}>--vds-{key}</code>
                <span style={styles.tokenValue}>
                  {value.startsWith('#') && <span style={{ ...styles.swatch, background: value }} />}
                  {value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.description}>Loading design tokens...</p>
        )}
      </section>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '920px',
    margin: '0 auto',
    padding: 'var(--vds-spacing-page-padding)',
  },
  header: {
    marginBottom: '26px',
  },
  backLink: {
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '14px',
    display: 'inline-block',
    marginBottom: '10px',
  },
  title: {
    fontSize: '24px',
    color: 'var(--vds-colors-text)',
  },
  section: {
    marginBottom: '28px',
  },
  sectionTitle: {
    fontSize: '18px',
    marginBottom: '10px',
    color: 'var(--vds-colors-text)',
  },
  description: {
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '14px',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '12px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
  },
  input: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '8px 10px',
    fontFamily: 'inherit',
    fontSize: '14px',
    outline: 'none',
  },
  saveBtn: {
    gridColumn: '1 / -1',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    background: 'var(--vds-colors-primary)',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  message: {
    gridColumn: '1 / -1',
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
  },
  pathList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  path: {
    background: 'var(--vds-colors-surface)',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '8px 10px',
    fontSize: '12px',
  },
  tokenList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  tokenItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    borderBottom: '1px solid var(--vds-colors-border)',
    padding: '6px 0',
    fontSize: '12px',
  },
  tokenKey: {
    color: 'var(--vds-colors-text-secondary)',
  },
  tokenValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  swatch: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    border: '1px solid var(--vds-colors-border)',
  },
};
