import { useState } from 'react';

export default function FeedbackSelect({ schema, onSubmit }) {
  const [selected, setSelected] = useState(schema.multiple ? [] : null);
  const [submitting, setSubmitting] = useState(false);

  const handleToggle = (option) => {
    if (schema.multiple) {
      setSelected(prev =>
        prev.includes(option)
          ? prev.filter(o => o !== option)
          : [...prev, option]
      );
    } else {
      setSelected(option);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit({ value: selected });
  };

  const isValid = schema.multiple ? selected.length > 0 : selected !== null;

  return (
    <div style={styles.container}>
      <p style={styles.prompt}>{schema.prompt}</p>
      <div style={styles.options}>
        {(schema.options || []).map(option => {
          const isSelected = schema.multiple
            ? selected.includes(option)
            : selected === option;
          return (
            <button
              key={option}
              onClick={() => handleToggle(option)}
              style={{
                ...styles.option,
                ...(isSelected ? styles.optionSelected : {})
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        style={{
          ...styles.submitBtn,
          ...(!isValid ? styles.submitBtnDisabled : {})
        }}
      >
        Submit
      </button>
    </div>
  );
}

const styles = {
  container: {},
  prompt: {
    marginBottom: '16px',
    fontSize: '15px',
  },
  options: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px',
  },
  option: {
    padding: '10px 20px',
    background: 'var(--vds-colors-surface)',
    border: '2px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  optionSelected: {
    borderColor: 'var(--vds-colors-primary)',
    background: '#EFF6FF',
    color: 'var(--vds-colors-primary)',
    fontWeight: '500',
  },
  submitBtn: {
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
  submitBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
