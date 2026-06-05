import 'react-native';

declare module 'react-native' {
  // Augment core component props to support declarative AI priorities
  interface ViewProps {
    aiPriority?: 'high' | 'low';
  }
  interface TextProps {
    aiPriority?: 'high' | 'low';
  }
  interface PressableProps {
    aiPriority?: 'high' | 'low';
  }
  interface TextInputProps {
    aiPriority?: 'high' | 'low';
  }
  interface ImageProps {
    aiPriority?: 'high' | 'low';
  }
}
