import { useSettings } from '../hooks/useSettings';

export default function Footer() {
  const { platform } = useSettings();

  if (!platform.slogan) return null;

  return (
    <footer style={styles.outer}>
      <div style={styles.inner}>
        <div style={styles.text}>{platform.slogan}</div>
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
};
