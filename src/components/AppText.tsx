import { forwardRef } from 'react';
import { Text, TextInput, TextInputProps, TextProps } from 'react-native';

export const AppText = forwardRef<Text, TextProps>(({ style, allowFontScaling = false, ...props }, ref) => (
  <Text ref={ref} allowFontScaling={allowFontScaling} style={[{ fontFamily: 'Inter_400Regular' }, style]} {...props} />
));
AppText.displayName = 'AppText';

export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  ({ style, allowFontScaling = false, ...props }, ref) => (
    <TextInput
      ref={ref}
      allowFontScaling={allowFontScaling}
      style={[{ fontFamily: 'Inter_400Regular' }, style]}
      {...props}
    />
  ),
);
AppTextInput.displayName = 'AppTextInput';
