import { useState } from 'react';

export default function FeedbackRating({ schema, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const max = schema.max || 5;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    await onSubmit({ value: rating });
  };

  return (
    <div style={styles.container}>
      <p style={styles.prompt}>{schema.prompt}</p>
      <div style={styles.stars}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{
              ...styles.star,
              color: n <= (hover || rating)
                ? 'var(--vds-colors-warning)'
                : 'var(--vds-colors-border)'
            }}
          >
            {'\u2605'}
          </button>
        ))}
        {rating > 0 && <span style={styles.ratingLabel}>{rating}/{max}</span>}
      </div>
      <button
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
        style={{
          ...styles.submitBtn,
          ...(rating === 0 ? styles.submitBtnDisabled : {})
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
  stars: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '16px',
  },
  star: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    padding: '2px',
    transition: 'color 0.1s',
  },
  ratingLabel: {
    marginLeft: '8px',
    fontSize: '14px',
    color: 'var(--vds-colors-text-secondary)',
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
