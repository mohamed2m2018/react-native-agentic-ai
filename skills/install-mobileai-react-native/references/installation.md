# @mobileai/react-native Installation Reference

## Base Install

```bash
npm install @mobileai/react-native
```

Use the host project’s package manager if it is not npm.

Requirements:
- React Native `>=0.83.0 <0.84.0`
- Expo requires a development build or prebuild
- Expo Go is not supported after installing the SDK native modules

Expo rebuild:

```bash
npx expo prebuild
npx expo run:ios
npx expo run:android
```

React Native CLI rebuild:

```bash
cd ios && pod install && cd ..
npx react-native run-ios
npx react-native run-android
```

## Screen Mapping

Add this to `metro.config.js`:

```js
require('@mobileai/react-native/generate-map').autoGenerate(__dirname);
```

Or generate manually:

```bash
npx @mobileai/react-native generate-map
```

Then import `ai-screen-map.json` and pass it to `<AIAgent screenMap={screenMap} />`.

## React Navigation Wrapper

```tsx
import { AIAgent } from '@mobileai/react-native';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import screenMap from './ai-screen-map.json';

export default function App() {
  const navRef = useNavigationContainerRef();

  return (
    <AIAgent
      analyticsKey="mobileai_pub_xxxxxxxx"
      navRef={navRef}
      screenMap={screenMap}
    >
      <NavigationContainer ref={navRef}>
        {/* existing screens */}
      </NavigationContainer>
    </AIAgent>
  );
}
```

## Expo Router Wrapper

```tsx
import { AIAgent } from '@mobileai/react-native';
import { Slot, useNavigationContainerRef } from 'expo-router';
import screenMap from './ai-screen-map.json';

export default function RootLayout() {
  const navRef = useNavigationContainerRef();

  return (
    <AIAgent
      analyticsKey="mobileai_pub_xxxxxxxx"
      navRef={navRef}
      screenMap={screenMap}
    >
      <Slot />
    </AIAgent>
  );
}
```

## Optional Features

Text-mode dictation:

```bash
npx expo install expo-speech-recognition
```

Voice mode:

```bash
npm install react-native-audio-api
```

Expo permissions:

```json
{
  "expo": {
    "android": { "permissions": ["RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"] },
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Required for voice chat with AI assistant"
      }
    }
  }
}
```

Enable UI:

```tsx
<AIAgent analyticsKey="mobileai_pub_xxxxxxxx" navRef={navRef} enableVoice>
  {/* app */}
</AIAgent>
```

Optional consent persistence:

```bash
npx expo install @react-native-async-storage/async-storage
```

Use this only when the app sets `consent={{ persist: true }}` and needs the AI consent decision remembered across app restarts. Do not install it for hosted support tickets, discovery tooltip state, telemetry, or conversation history.

## Troubleshooting

- `RNViewShot could not be found`: rebuild the native app so `react-native-view-shot` autolinks.
- No floating chat bar: check that `<AIAgent>` wraps the visible app tree and `showChatBar` is not `false`.
- Navigation does nothing: pass a valid `navRef` and prefer `screenMap` for off-screen routes.
- Voice tab missing: set `enableVoice` and install/rebuild `react-native-audio-api`.
- Expo Go fails: use a development build because the SDK includes native modules.
