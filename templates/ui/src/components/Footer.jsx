import { useEffect, useState } from 'react';
import { fetchSettings } from '../lib/api';

export default function Footer() {
  const [slogan, setSlogan] = useState('');

  useEffect(() => {
    fetchSettings()
      .then((data) => setSlogan(data?.platform?.slogan || ''))
      .catch(() => {});
  }, []);

  if (!slogan) return null;

  return (
    <footer style={styles.footer}>
      <div style={styles.text}>{slogan}</div>
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
