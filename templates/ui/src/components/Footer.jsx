import { useSettings } from '../hooks/useSettings';
import { t, has } from '../lib/i18n';

export default function Footer() {
  const { platform } = useSettings();
  const sloganText = platform.slogan || (has('platformSlogan') ? t('platformSlogan') : '');
  const icon = platform.favicon || '🐂';

  if (!sloganText) return null;

  return (
    <footer style={styles.outer}>
      <div style={styles.inner}>
        <div style={styles.text}><span style={styles.icon}>{icon}</span>{sloganText}</div>
      </div>
    </footer>
  );
}

const styles = {
  outer: {
    marginTop: 'auto',
  },
  inner: {
    maxWidth: '920px',
    margin: '0 auto',
    padding: '16px var(--vds-spacing-page-padding)',
    borderTop: '1px solid var(--vds-colors-border)',
    textAlign: 'center',
  },
  text: {
    fontSize: '12px',
    color: 'var(--vds-colors-text-secondary)',
  },
  icon: {
    marginRight: '6px',
    fontSize: '14px',
  },
};
