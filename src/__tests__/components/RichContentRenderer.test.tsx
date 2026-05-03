import React from 'react';
import { render } from '@testing-library/react-native';
import {
  parseInlineMarkdown,
  RichContentRenderer,
} from '../../components/rich-content/RichContentRenderer';

describe('RichContentRenderer', () => {
  it('parses simple inline markdown segments', () => {
    expect(parseInlineMarkdown('Tap **Orders** then `Help`.')).toEqual([
      { text: 'Tap ' },
      { text: 'Orders', style: 'bold' },
      { text: ' then ' },
      { text: 'Help', style: 'code' },
      { text: '.' },
    ]);
  });

  it('renders markdown markers as styled text instead of literal asterisks', () => {
    const { getByText, queryByText } = render(
      <RichContentRenderer
        content="Tap **Orders** at the bottom."
        surface="chat"
      />
    );

    expect(queryByText('**Orders**')).toBeNull();
    expect(getByText('Orders')).toBeTruthy();
  });

  it('keeps malformed markdown visible', () => {
    expect(parseInlineMarkdown('Tap **Orders at the bottom.')).toEqual([
      { text: 'Tap ' },
      { text: '**Orders at the bottom.' },
    ]);
  });
});
