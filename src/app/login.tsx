import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { authStorage } from '@/lib/authStorage';
import { LoginDto } from '@/shared';
import { colors } from '@/theme';
import { getApiErrorMessage } from '@/utils/apiError';
import { maskCpfInput } from '@/utils/cpf';
import { AppText as Text, AppTextInput as TextInput } from '@/components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginDto>({ cpf: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    (async () => {
      const cpfDigits = await authStorage.getSavedCpf();
      setFormData((prev) => ({
        ...prev,
        ...(cpfDigits ? { cpf: maskCpfInput(cpfDigits) } : {}),
      }));
    })();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await authApi.login(formData);
      await login(response.accessToken, response.user, rememberMe);
      if (rememberMe) {
        await authStorage.saveLoginCredentials(formData.cpf);
      }
      router.replace('/home');
    } catch (error: unknown) {
      Alert.alert('Erro ao fazer login', getApiErrorMessage(error, 'Credenciais inválidas'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/login-background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
        accessible={false}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <Image
                source={require('../../assets/images/brand-logo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="Rastro"
              />
              <Text style={styles.subtitle}>App do Motorista</Text>

              <View style={styles.form}>
                <TextInput
                  style={styles.input}
                  placeholder="CPF"
                  placeholderTextColor={colors.textSubtle}
                  value={formData.cpf}
                  onChangeText={(text) => setFormData({ ...formData, cpf: maskCpfInput(text) })}
                  keyboardType="numeric"
                  maxLength={14}
                />

                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Senha"
                    placeholderTextColor={colors.textSubtle}
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.passwordToggle}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={22}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Ionicons name="checkmark" size={14} color={colors.surface} />}
                  </View>
                  <Text style={styles.rememberText}>Lembrar CPF e sessão</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    width: 190,
    height: 153,
    alignSelf: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: colors.textMuted,
  },
  form: {
    gap: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.appText,
  },
  passwordInputContainer: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: colors.appText,
  },
  passwordToggle: {
    padding: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  rememberText: {
    marginLeft: 10,
    fontSize: 15,
    color: colors.textMuted,
    flexShrink: 1,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    width: '100%',
    textAlign: 'center',
  },
});
