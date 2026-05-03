# Rich UI

MobileAI can render structured assistant responses as text and app-defined blocks. Use this when the assistant should show product cards, summaries, forms, comparisons, or contextual help instead of plain chat text.

## Built-In Blocks

The package exports these built-in block definitions:

- `FactCard`
- `ProductCard`
- `ActionCard`
- `ComparisonCard`
- `FormCard`

```tsx
import {
  AIAgent,
  ProductCard,
  ActionCard,
} from '@mobileai/react-native';

<AIAgent blocks={[ProductCard, ActionCard]}>
  {children}
</AIAgent>;
```

## Custom Blocks

Define a block with a React component and a schema. The assistant only receives the block name, placement, and prop schema.

```tsx
import type { BlockDefinition } from '@mobileai/react-native';

function RefundStatusCard(props: { status: string; eta?: string }) {
  return null;
}

const RefundStatusBlock: BlockDefinition = {
  name: 'refund_status',
  component: RefundStatusCard,
  allowedPlacements: ['chat', 'zone'],
  propSchema: {
    status: {
      type: 'string',
      required: true,
      description: 'Current refund status',
    },
    eta: {
      type: 'string',
      description: 'Estimated refund completion time',
    },
  },
  previewTextBuilder: (props) => `Refund status: ${props.status}`,
};

<AIAgent blocks={[RefundStatusBlock]}>{children}</AIAgent>;
```

## Block Actions

Interactive blocks can call app-defined handlers through `blockActionHandlers`.

```tsx
<AIAgent
  blocks={[ProductCard]}
  blockActionHandlers={{
    open_product: async ({ productId }) => {
      navigation.navigate('Product', { id: productId });
    },
  }}
>
  {children}
</AIAgent>
```

Keep action handlers narrow and app-owned. For sensitive operations, route them through your normal app policy and confirmation flow.

## `RichContentRenderer`

Use `RichContentRenderer` when you build a custom chat UI and want to render assistant messages yourself.

```tsx
import { RichContentRenderer, useAI } from '@mobileai/react-native';

function Messages() {
  const { messages } = useAI();

  return messages.map((message) => (
    <RichContentRenderer
      key={message.id}
      content={message.content}
      surface="chat"
    />
  ));
}
```

## `AIZone`

`AIZone` is a declarative boundary that gives the assistant permission to modify a subtree in controlled ways.

```tsx
import { AIZone, ProductCard } from '@mobileai/react-native';

<AIZone
  id="product-recommendations"
  allowHighlight
  allowInjectHint
  allowInjectBlock
  blocks={[ProductCard]}
>
  <RecommendedProducts />
</AIZone>
```

Available zone permissions:

| Prop | Purpose |
| --- | --- |
| `allowHighlight` | The assistant may guide the user to elements in the zone. |
| `allowInjectHint` | The assistant may add contextual hints. |
| `allowSimplify` | The assistant may simplify low-priority content. |
| `allowInjectBlock` | The assistant may render registered rich blocks in the zone. |
| `interventionEligible` | The zone may be used for proactive interventions. |
| `proactiveIntervention` | The zone can be used for proactive help. |
| `blocks` | Blocks available inside this zone. |

Deprecated aliases `allowInjectCard` and `templates` still exist for compatibility. Prefer `allowInjectBlock` and `blocks`.

## Theme Tokens

Use `richUITheme` for global tokens and `richUISurfaceThemes` for per-surface overrides.

```tsx
<AIAgent
  richUITheme={{
    colors: {
      cardBackground: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#4b5563',
      accent: '#2563eb',
    },
  }}
  richUISurfaceThemes={{
    support: {
      colors: {
        accent: '#16a34a',
      },
    },
  }}
>
  {children}
</AIAgent>
```

Use `theme` or `accentColor` for the floating chat bar itself:

```tsx
<AIAgent
  accentColor="#2563eb"
  theme={{
    primaryColor: '#2563eb',
    backgroundColor: 'rgba(17, 24, 39, 0.96)',
    textColor: '#ffffff',
  }}
>
  {children}
</AIAgent>
```

## Placement Guidance

- Use chat blocks for explanations, summaries, and support artifacts.
- Use zone blocks when the UI should appear near the related app content.
- Keep block props structured and small.
- Avoid using rich blocks to bypass app permissions. Sensitive effects should still run through `useAction`, app code, or runtime guardrails.
