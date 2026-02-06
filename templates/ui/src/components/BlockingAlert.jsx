import { Link } from 'react-router-dom';

export default function BlockingAlert({ deliveries }) {
  if (!deliveries || deliveries.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.icon}>!</div>
      <div style={styles.content}>
        <strong>Agent is waiting for your response</strong>
        <div style={styles.links}>
          {deliveries.map(d => (
            <Link key={d.id} to={`/d/${d.id}`} style={styles.link}>
              {d.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: 'var(--vds-colors-blocking-bg)',
    border: '1px solid var(--vds-colors-blocking-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    marginBottom: '24px',
  },
  icon: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'var(--vds-colors-danger)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  links: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '8px',
  },
  link: {
    color: 'var(--vds-colors-danger)',
    fontWeight: '500',
    fontSize: '14px',
  },
};
