import { useState } from 'react';

export default function FeedbackConfirm({ schema, onSubmit }) {
  const [submitting, setSubmitting] = useState(false);

  const handleClick = async (value) => {
    setSubmitting(true);
    await onSubmit({ value });
  };

  return (
    <div style={styles.container}>
      <p style={styles.prompt}>{schema.prompt}</p>
      <div style={styles.buttons}>
        <button
          onClick={() => handleClick(true)}
          disabled={submitting}
          style={styles.confirmBtn}
        >
          {schema.confirm_label || 'Confirm'}
        </button>
        <button
          onClick={() => handleClick(false)}
          disabled={submitting}
          style={styles.cancelBtn}
        >
          {schema.cancel_label || 'Cancel'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {},
  prompt: {
    marginBottom: '16px',
    fontSize: '15px',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
  },
  confirmBtn: {
    padding: '10px 24px',
    background: 'var(--vds-colors-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--vds-spacing-border-radius)',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  cancelBtn: {
    padding: '10px 24px',
    background: 'transparent',
    color: 'var(--vds-colors-text-secondary)',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
};
