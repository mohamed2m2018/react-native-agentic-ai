import 'react-native';

declare module 'react-native' {
  // Augment core component props to support declarative AI priorities
  interface ViewProps {
    aiPriority?: 'high' | 'low';
    aiConfirm?: boolean;
    aiIgnore?: boolean;
  }
  interface TextProps {
    aiPriority?: 'high' | 'low';
    aiConfirm?: boolean;
    aiIgnore?: boolean;
  }
  interface PressableProps {
    aiPriority?: 'high' | 'low';
    aiConfirm?: boolean;
    aiIgnore?: boolean;
  }
  interface TextInputProps {
    aiPriority?: 'high' | 'low';
    aiConfirm?: boolean;
    aiIgnore?: boolean;
  }
  interface ImageProps {
    aiPriority?: 'high' | 'low';
    aiConfirm?: boolean;
    aiIgnore?: boolean;
  }
}
