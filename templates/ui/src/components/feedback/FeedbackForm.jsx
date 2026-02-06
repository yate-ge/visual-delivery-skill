import { useState } from 'react';

export default function FeedbackForm({ schema, onSubmit }) {
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ values });
  };

  const isValid = (schema.fields || []).every(field => {
    if (!field.required) return true;
    const val = values[field.name];
    return val !== undefined && val !== '';
  });

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {(schema.fields || []).map(field => (
        <div key={field.name} style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {field.required && <span style={styles.required}> *</span>}
          </label>
          {renderField(field, values[field.name], (val) => handleChange(field.name, val))}
        </div>
      ))}
      <button
        type="submit"
        disabled={!isValid || submitting}
        style={{
          ...styles.submitBtn,
          ...(!isValid ? styles.submitBtnDisabled : {})
        }}
      >
        Submit
      </button>
    </form>
  );
}

function renderField(field, value, onChange) {
  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          style={styles.input}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          style={styles.input}
        />
      );
    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          rows={4}
          style={styles.textarea}
        />
      );
    case 'select':
      return (
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={styles.select}
        >
          <option value="">Select...</option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'checkbox':
      return (
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            style={styles.checkbox}
          />
          {field.placeholder || field.label}
        </label>
      );
    default:
      return (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={styles.input}
        />
      );
  }
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--vds-colors-text)',
  },
  required: {
    color: 'var(--vds-colors-danger)',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  textarea: {
    padding: '8px 12px',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    background: 'white',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  checkbox: {
    width: '16px',
    height: '16px',
  },
  submitBtn: {
    alignSelf: 'flex-start',
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
