import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSettings, updateSettings } from '../lib/api';
import { t } from '../lib/i18n';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings()
      .then((data) => setSettings(data))
      .catch((err) => setMessage(t('errorLoadingSettings', { message: err.message })));
  }, []);

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    setMessage('');
    try {
      const result = await updateSettings(settings);
      setSettings(result);
      setMessage(t('settingsSaved'));
    } catch (err) {
      setMessage(t('saveFailed', { message: err.message }));
    } finally {
      setSaving(false);
    }
  }

  function updatePlatformField(field, value) {
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
        <Link to="/" style={styles.backLink}>{t('back')}</Link>
        <h1 style={styles.title}>{t('settingsTitle')}</h1>
      </header>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{t('platformBranding')}</h2>
        {!settings ? (
          <p style={styles.description}>{t('loadingSettings')}</p>
        ) : (
          <div style={styles.form}>
            <label style={styles.label}>
              {t('language')}
              <div style={styles.langDisplay}>{t('languageName')}</div>
            </label>

            <label style={styles.label}>
              {t('platformName')}
              <input
                value={settings.platform?.name || ''}
                onChange={(e) => updatePlatformField('name', e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              {t('logoUrl')}
              <input
                value={settings.platform?.logo_url || ''}
                onChange={(e) => updatePlatformField('logo_url', e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              {t('slogan')}
              <input
                value={settings.platform?.slogan || ''}
                onChange={(e) => updatePlatformField('slogan', e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              {t('visualStyle')}
              <input
                value={settings.platform?.visual_style || ''}
                onChange={(e) => updatePlatformField('visual_style', e.target.value)}
                style={styles.input}
              />
            </label>

            <button onClick={handleSave} style={styles.saveBtn} disabled={saving}>
              {saving ? t('saving') : t('savePlatformSettings')}
            </button>
            {message && <div style={styles.message}>{message}</div>}
          </div>
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
  langDisplay: {
    padding: '8px 10px',
    fontSize: '14px',
    color: 'var(--vds-colors-text)',
    background: 'var(--vds-colors-surface)',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
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
};
