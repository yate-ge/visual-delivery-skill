import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSettings, updateSettings, fetchDesignTokens } from '../lib/api';
import { useSettings } from '../hooks/useSettings';
import { t } from '../lib/i18n';

const TRIGGER_MODES = ['auto', 'smart', 'manual'];

export default function Settings() {
  const { update: updateGlobal } = useSettings();
  const [settings, setSettings] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings()
      .then((data) => setSettings(data))
      .catch((err) => setMessage(t('errorLoadingSettings', { message: err.message })));
    fetchDesignTokens()
      .then((data) => setTokens(data))
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    setMessage('');
    try {
      const result = await updateSettings(settings);
      setSettings(result);
      updateGlobal(result);
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

  function updateTriggerMode(mode) {
    setSettings((prev) => ({ ...prev, trigger_mode: mode }));
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.backLink}>{t('back')}</Link>
        <h1 style={styles.title}>{t('settingsTitle')}</h1>
      </header>

      {!settings ? (
        <p style={styles.description}>{t('loadingSettings')}</p>
      ) : (
        <>
          {/* Trigger Mode */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>{t('triggerMode')}</h2>
            <p style={styles.hint}>{t('triggerModeDesc')}</p>
            <div style={styles.radioGroup}>
              {TRIGGER_MODES.map((mode) => {
                const selected = settings.trigger_mode === mode;
                return (
                  <div
                    key={mode}
                    style={{
                      ...styles.radioOption,
                      ...(selected ? styles.radioOptionSelected : {}),
                    }}
                    onClick={() => updateTriggerMode(mode)}
                  >
                    <input
                      type="radio"
                      name="trigger_mode"
                      value={mode}
                      checked={selected}
                      onChange={() => updateTriggerMode(mode)}
                      style={{ marginTop: '2px', accentColor: 'var(--vds-colors-primary)' }}
                    />
                    <div>
                      <div style={styles.radioLabel}>{t(`triggerMode_${mode}`)}</div>
                      <div style={styles.radioDesc}>{t(`triggerMode_${mode}_desc`)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Platform Branding */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>{t('platformBranding')}</h2>
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
                {t('slogan')}
                <input
                  value={settings.platform?.slogan || ''}
                  onChange={(e) => updatePlatformField('slogan', e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                {t('favicon')}
                <input
                  value={settings.platform?.favicon || ''}
                  onChange={(e) => updatePlatformField('favicon', e.target.value)}
                  placeholder="🐂"
                  style={{ ...styles.input, maxWidth: '120px' }}
                />
              </label>
            </div>
          </section>

          {/* Save button (shared for trigger mode + branding) */}
          <div style={styles.saveArea}>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving}>
              {saving ? t('saving') : t('savePlatformSettings')}
            </button>
            {message && <div style={styles.message}>{message}</div>}
          </div>

          {/* Visual Design (read-only) */}
          <section style={{ ...styles.section, marginTop: '36px' }}>
            <h2 style={styles.sectionTitle}>{t('visualDesign')}</h2>
            <p style={styles.hint}>{t('visualDesignHint')}</p>

            {tokens ? (
              <div>
                {/* Color palette */}
                {tokens.colors && (
                  <>
                    <div style={styles.subsectionLabel}>{t('colorPalette')}</div>
                    <div style={styles.colorGrid}>
                      {Object.entries(tokens.colors).map(([name, hex]) => (
                        <div key={name} style={styles.colorSwatch}>
                          <div style={{ ...styles.swatchBox, background: hex }} />
                          <div style={styles.swatchLabel}>{name}</div>
                          <div style={styles.swatchHex}>{hex}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Typography */}
                {tokens.typography && (
                  <>
                    <div style={styles.subsectionLabel}>{t('typographyLabel')}</div>
                    <div style={styles.tokenList}>
                      {Object.entries(tokens.typography).map(([key, val]) => (
                        <div key={key} style={styles.tokenRow}>
                          <span style={styles.tokenKey}>{key}</span>
                          <span style={styles.tokenValue}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Spacing */}
                {tokens.spacing && (
                  <>
                    <div style={styles.subsectionLabel}>{t('spacingLabel')}</div>
                    <div style={styles.tokenList}>
                      {Object.entries(tokens.spacing).map(([key, val]) => (
                        <div key={key} style={styles.tokenRow}>
                          <span style={styles.tokenKey}>{key}</span>
                          <span style={styles.tokenValue}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p style={styles.description}>{t('loadingDesignTokens')}</p>
            )}
          </section>
        </>
      )}
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
    marginBottom: '6px',
    color: 'var(--vds-colors-text)',
  },
  description: {
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '14px',
  },
  hint: {
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
    fontStyle: 'italic',
    marginBottom: '14px',
  },

  /* Trigger mode radio cards */
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  radioOption: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 14px',
    border: '1.5px solid var(--vds-colors-border)',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'white',
    transition: 'border-color 0.15s',
  },
  radioOptionSelected: {
    borderColor: 'var(--vds-colors-primary)',
    background: 'var(--vds-colors-surface)',
  },
  radioLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--vds-colors-text)',
  },
  radioDesc: {
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
    marginTop: '2px',
  },

  /* Platform branding form */
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

  /* Save area */
  saveArea: {
    marginBottom: '28px',
  },
  saveBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    background: 'var(--vds-colors-primary)',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  message: {
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
    marginTop: '8px',
  },

  /* Visual design tokens (read-only) */
  subsectionLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--vds-colors-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '16px',
    marginBottom: '8px',
  },
  colorGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '8px',
  },
  colorSwatch: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    width: '62px',
  },
  swatchBox: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid var(--vds-colors-border)',
  },
  swatchLabel: {
    fontSize: '10px',
    color: 'var(--vds-colors-text-secondary)',
    textAlign: 'center',
    wordBreak: 'break-all',
    lineHeight: '1.2',
  },
  swatchHex: {
    fontSize: '10px',
    color: 'var(--vds-colors-text-secondary)',
    opacity: 0.6,
  },
  tokenList: {
    marginBottom: '4px',
  },
  tokenRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '5px 0',
    borderBottom: '1px solid var(--vds-colors-border)',
    fontSize: '13px',
  },
  tokenKey: {
    color: 'var(--vds-colors-text-secondary)',
  },
  tokenValue: {
    color: 'var(--vds-colors-text)',
    fontFamily: 'var(--vds-typography-font-family-mono)',
    fontSize: '12px',
    maxWidth: '60%',
    textAlign: 'right',
    wordBreak: 'break-all',
  },
};
