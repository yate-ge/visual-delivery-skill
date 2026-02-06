import FeedbackConfirm from './FeedbackConfirm';
import FeedbackSelect from './FeedbackSelect';
import FeedbackForm from './FeedbackForm';
import FeedbackRating from './FeedbackRating';

export default function FeedbackRenderer({ schema, onSubmit }) {
  if (!schema) return null;

  switch (schema.type) {
    case 'confirm':
      return <FeedbackConfirm schema={schema} onSubmit={onSubmit} />;
    case 'select':
      return <FeedbackSelect schema={schema} onSubmit={onSubmit} />;
    case 'form':
      return <FeedbackForm schema={schema} onSubmit={onSubmit} />;
    case 'rating':
      return <FeedbackRating schema={schema} onSubmit={onSubmit} />;
    default:
      return <div style={{ color: 'var(--vds-colors-danger)' }}>Unknown feedback type: {schema.type}</div>;
  }
}
