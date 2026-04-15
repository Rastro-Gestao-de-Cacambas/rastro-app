import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { useSyncEngine } from '@/hooks/useSyncEngine';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function SyncEngineHost() {
  useSyncEngine();
  return null;
}

type TextDefaults = { allowFontScaling?: boolean; style?: unknown };
type WithDefaultProps<T> = T & { defaultProps?: TextDefaults };

const TextWithDefaults = Text as WithDefaultProps<typeof Text>;
const TextInputWithDefaults = TextInput as WithDefaultProps<typeof TextInput>;

if (!TextWithDefaults.defaultProps) {
  TextWithDefaults.defaultProps = {};
}

TextWithDefaults.defaultProps.allowFontScaling = false;
TextWithDefaults.defaultProps.style = [
  { fontFamily: 'Inter_400Regular' },
  TextWithDefaults.defaultProps.style,
];

if (!TextInputWithDefaults.defaultProps) {
  TextInputWithDefaults.defaultProps = {};
}

TextInputWithDefaults.defaultProps.allowFontScaling = false;
TextInputWithDefaults.defaultProps.style = [
  { fontFamily: 'Inter_400Regular' },
  TextInputWithDefaults.defaultProps.style,
];

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <SyncEngineHost />
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="home" />
        <Stack.Screen name="work-order-detail" />
      </Stack>
    </SafeAreaProvider>
  );
}