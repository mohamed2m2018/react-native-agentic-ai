export interface RichUIColorScale {
  canvas: string;
  chatCanvas: string;
  blockSurface: string;
  raisedSurface: string;
  mutedSurface: string;
  overlaySurface: string;
  inputSurface: string;
  primaryText: string;
  secondaryText: string;
  mutedText: string;
  inverseText: string;
  successText: string;
  warningText: string;
  dangerText: string;
  linkText: string;
  border: string;
  subtleBorder: string;
  strongBorder: string;
  focusBorder: string;
  selectedBorder: string;
  errorBorder: string;
  successBorder: string;
  primaryAccent: string;
  secondaryAccent: string;
  tertiaryAccent: string;
  highlightAccent: string;
  ctaAccent: string;
  selectionAccent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  trust: string;
  price: string;
  discount: string;
  soldOut: string;
  unavailable: string;
  imagePlaceholder: string;
  imageScrim: string;
  mediaBorder: string;
  priceTagBackground: string;
  priceTagBorder: string;
  priceTagText: string;
  strikeThroughPrice: string;
  discountBadge: string;
  chipFilledBackground: string;
  chipFilledText: string;
  chipOutlinedBorder: string;
  chipOutlinedText: string;
  chipSelectedBackground: string;
  chipSelectedText: string;
  chipMutedBackground: string;
  chipMutedText: string;
  destructiveChipBackground: string;
  destructiveChipText: string;
  fieldBackground: string;
  fieldBorder: string;
  cursor: string;
  placeholder: string;
  helperText: string;
  validationError: string;
  validationSuccess: string;
  toggleTrack: string;
  toggleThumb: string;
  assistantBubble: string;
  userBubble: string;
  transcriptDivider: string;
  timestamp: string;
  typingState: string;
  richMessageContainer: string;
  zoneWrapper: string;
  zoneDismissBackground: string;
  zoneDismissText: string;
  floatingControls: string;
}

export interface RichUIShapeScale {
  cardRadius: number;
  controlRadius: number;
  mediaRadius: number;
  chipRadius: number;
  pillRadius: number;
}

export interface RichUISpacingScale {
  xxs: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface RichUITypographyScale {
  titleSize: number;
  subtitleSize: number;
  bodySize: number;
  metaSize: number;
  captionSize: number;
  priceSize: number;
}

export interface RichUITheme {
  colors: RichUIColorScale;
  shape: RichUIShapeScale;
  spacing: RichUISpacingScale;
  typography: RichUITypographyScale;
}

export type RichUIThemeOverride = Partial<{
  colors: Partial<RichUIColorScale>;
  shape: Partial<RichUIShapeScale>;
  spacing: Partial<RichUISpacingScale>;
  typography: Partial<RichUITypographyScale>;
}>;

export const DEFAULT_RICH_UI_THEME: RichUITheme = {
  colors: {
    canvas: '#f7f4ef',
    chatCanvas: '#1d2230',
    blockSurface: '#ffffff',
    raisedSurface: '#f7efe6',
    mutedSurface: '#efe7dc',
    overlaySurface: 'rgba(15, 18, 25, 0.9)',
    inputSurface: '#fff9f3',
    primaryText: '#1e1d1a',
    secondaryText: '#4c4b45',
    mutedText: '#7b776d',
    inverseText: '#fffaf4',
    successText: '#0f5132',
    warningText: '#6d4b00',
    dangerText: '#7b1f26',
    linkText: '#0b6bcb',
    border: '#dccfbe',
    subtleBorder: '#efe5d9',
    strongBorder: '#bda88d',
    focusBorder: '#2856d8',
    selectedBorder: '#cf5a4d',
    errorBorder: '#cf5a4d',
    successBorder: '#1e8f61',
    primaryAccent: '#cf5a4d',
    secondaryAccent: '#c98d56',
    tertiaryAccent: '#6f8f7c',
    highlightAccent: '#f1c56b',
    ctaAccent: '#cf5a4d',
    selectionAccent: '#e58c3b',
    success: '#1e8f61',
    warning: '#d19a20',
    danger: '#cf5a4d',
    info: '#5c82ff',
    trust: '#3f6fd1',
    price: '#a73822',
    discount: '#d76b42',
    soldOut: '#8b867d',
    unavailable: '#9c958a',
    imagePlaceholder: '#eadfd1',
    imageScrim: 'rgba(16, 16, 12, 0.16)',
    mediaBorder: '#ead9c5',
    priceTagBackground: '#fff1e2',
    priceTagBorder: '#f0c399',
    priceTagText: '#93361f',
    strikeThroughPrice: '#9e8f82',
    discountBadge: '#ffe1d5',
    chipFilledBackground: '#f4e4d6',
    chipFilledText: '#5b3c20',
    chipOutlinedBorder: '#d2baa2',
    chipOutlinedText: '#6b4f34',
    chipSelectedBackground: '#cf5a4d',
    chipSelectedText: '#fff7f0',
    chipMutedBackground: '#ede6dc',
    chipMutedText: '#726b61',
    destructiveChipBackground: '#f8d7da',
    destructiveChipText: '#7b1f26',
    fieldBackground: '#fffaf5',
    fieldBorder: '#ddcdbc',
    cursor: '#cf5a4d',
    placeholder: '#9b9489',
    helperText: '#766e64',
    validationError: '#cf5a4d',
    validationSuccess: '#1e8f61',
    toggleTrack: '#e4d0b3',
    toggleThumb: '#ffffff',
    assistantBubble: 'rgba(255,255,255,0.08)',
    userBubble: '#7c68f5',
    transcriptDivider: 'rgba(255,255,255,0.16)',
    timestamp: 'rgba(255,255,255,0.56)',
    typingState: 'rgba(255,255,255,0.4)',
    richMessageContainer: 'rgba(255,255,255,0.06)',
    zoneWrapper: '#fffaf5',
    zoneDismissBackground: '#2f343d',
    zoneDismissText: '#fffaf4',
    floatingControls: '#f0e3d6',
  },
  shape: {
    cardRadius: 24,
    controlRadius: 18,
    mediaRadius: 20,
    chipRadius: 999,
    pillRadius: 999,
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
  },
  typography: {
    titleSize: 22,
    subtitleSize: 16,
    bodySize: 14,
    metaSize: 12,
    captionSize: 11,
    priceSize: 18,
  },
};

export function resolveRichUITheme(
  ...overrides: Array<RichUIThemeOverride | undefined>
): RichUITheme {
  return overrides.reduce<RichUITheme>(
    (theme, override) => {
      if (!override) return theme;
      return {
        colors: { ...theme.colors, ...(override.colors || {}) },
        shape: { ...theme.shape, ...(override.shape || {}) },
        spacing: { ...theme.spacing, ...(override.spacing || {}) },
        typography: { ...theme.typography, ...(override.typography || {}) },
      };
    },
    DEFAULT_RICH_UI_THEME
  );
}
