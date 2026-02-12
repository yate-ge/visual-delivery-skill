import { useSettings } from '../hooks/useSettings';

export default function Footer() {
  const { platform } = useSettings();

  if (!platform.slogan) return null;

  return (
    <footer style={styles.footer}>
      <div style={styles.text}>{platform.slogan}</div>
    </footer>
  );
}

const styles = {
  footer: {
    borderTop: '1px solid var(--vds-colors-border)',
    padding: '16px 20px',
    textAlign: 'center',
    marginTop: 'auto',
  },
  text: {
    fontSize: '12px',
    color: 'var(--vds-colors-text-secondary)',
  },
};
