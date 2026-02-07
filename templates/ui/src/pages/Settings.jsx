import { Link } from 'react-router-dom';
import { useDesignTokens } from '../hooks/useDesignTokens';
import { flattenTokens } from '../lib/theme';
import { t } from '../lib/i18n';

export default function Settings() {
  const tokens = useDesignTokens();

  const flatTokens = tokens ? flattenTokens(tokens) : {};

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.backLink}>{t('backToDashboard')}</Link>
        <h1 style={styles.title}>{t('settings')}</h1>
      </header>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{t('designSystem')}</h2>
        <p style={styles.description}>
          {t('designDesc')}
        </p>

        <div style={styles.paths}>
          <div style={styles.pathItem}>
            <span style={styles.pathLabel}>{t('designSpec')}</span>
            <code style={styles.pathValue}>.visual-delivery/design/design-spec.md</code>
          </div>
          <div style={styles.pathItem}>
            <span style={styles.pathLabel}>{t('designTokens')}</span>
            <code style={styles.pathValue}>.visual-delivery/design/tokens.json</code>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{t('currentTokenValues')}</h2>
        {tokens ? (
          <div style={styles.tokenList}>
            {Object.entries(flatTokens).map(([key, value]) => (
              <div key={key} style={styles.tokenItem}>
                <code style={styles.tokenKey}>--vds-{key}</code>
                <span style={styles.tokenValue}>
                  {value.startsWith('#') && (
                    <span style={{
                      ...styles.colorSwatch,
                      background: value
                    }} />
                  )}
                  {value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.description}>{t('loadingTokens')}</p>
        )}
      </section>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: 'var(--vds-spacing-page-padding)',
  },
  header: {
    marginBottom: '32px',
  },
  backLink: {
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '14px',
    display: 'inline-block',
    marginBottom: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '12px',
  },
  description: {
    color: 'var(--vds-colors-text-secondary)',
    marginBottom: '16px',
  },
  paths: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  pathItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    background: 'var(--vds-colors-surface)',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
  },
  pathLabel: {
    fontSize: '13px',
    fontWeight: '500',
    minWidth: '100px',
  },
  pathValue: {
    fontSize: '13px',
    fontFamily: 'var(--vds-typography-font-family-mono)',
    color: 'var(--vds-colors-text-secondary)',
  },
  tokenList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  tokenItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    borderBottom: '1px solid var(--vds-colors-border)',
    fontSize: '13px',
  },
  tokenKey: {
    fontFamily: 'var(--vds-typography-font-family-mono)',
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '12px',
  },
  tokenValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  colorSwatch: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    borderRadius: '3px',
    border: '1px solid var(--vds-colors-border)',
  },
};
