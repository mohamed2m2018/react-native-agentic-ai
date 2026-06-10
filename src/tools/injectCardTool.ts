import type { ToolDefinition } from '../core/types';
import { createRenderBlockTool } from './renderBlockTool';

export function createInjectCardTool(): ToolDefinition {
  const renderBlockTool = createRenderBlockTool();
  return {
    name: 'inject_card',
    description:
      'Deprecated compatibility alias for render_block(). Inject a pre-built React card template into a specific AIZone.',
    parameters: {
      zoneId: {
        type: 'string',
        description: 'The ID of the AIZone where the card should be rendered',
        required: true,
      },
      templateName: {
        type: 'string',
        description: 'The displayName of the whitelisted card template to render in that zone',
        required: true,
      },
      props: {
        type: 'string',
        description: 'JSON object string of props to pass into the selected template, for example {"title":"Free Delivery","body":"Orders over $20 get free delivery."}',
        required: false,
      },
    },
    execute: async (args) => {
      let result = await renderBlockTool.execute({
        zoneId: args.zoneId,
        blockType: args.templateName,
        props: args.props,
        lifecycle: 'dismissible',
      });
      result = result
        .replace('allowInjectBlock is false', 'allowInjectCard is false')
        .replace(`Block "${args.templateName}" is not registered for this zone.`, `Template "${args.templateName}" is not registered for this zone.`)
        .replace('Cannot render block', 'Cannot inject card')
        .replace('Rendered', 'Injected');
      if (result.startsWith('✅')) {
        return `${result} inject_card() is deprecated; prefer render_block().`;
      }
      return result;
    },
  };
}
