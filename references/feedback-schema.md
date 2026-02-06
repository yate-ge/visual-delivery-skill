# Feedback Schema Reference

## Table of Contents

- [confirm](#confirm)
- [select](#select)
- [form](#form)
- [rating](#rating)

---

## confirm

Binary yes/no decision.

```json
{
  "type": "confirm",
  "prompt": "Deploy to production?",
  "confirm_label": "Yes, deploy",
  "cancel_label": "Cancel"
}
```

Response: `{ "value": true }` or `{ "value": false }`

Optional fields: `confirm_label` (default: "Confirm"), `cancel_label` (default: "Cancel")

---

## select

Choose from options.

```json
{
  "type": "select",
  "prompt": "Choose deployment environment",
  "options": ["staging", "production", "dev"],
  "multiple": false
}
```

Single response: `{ "value": "staging" }`
Multiple response: `{ "value": ["staging", "dev"] }`

Optional fields: `multiple` (default: false)

---

## form

Structured form with multiple fields.

```json
{
  "type": "form",
  "fields": [
    {
      "name": "priority",
      "type": "select",
      "label": "Priority",
      "options": ["P0", "P1", "P2"],
      "required": true
    },
    {
      "name": "description",
      "type": "textarea",
      "label": "Description",
      "placeholder": "Describe the issue...",
      "required": false
    }
  ]
}
```

Response: `{ "values": { "priority": "P1", "description": "..." } }`

Field types: `text`, `number`, `textarea`, `select`, `checkbox`

---

## rating

Star rating.

```json
{
  "type": "rating",
  "prompt": "How satisfied are you with this result?",
  "max": 5
}
```

Response: `{ "value": 4 }`

Optional fields: `max` (default: 5)
