import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { authStorage } from '@/lib/authStorage';
import { LoginDto } from '@/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const formatCpf = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginDto>({
    cpf: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    (async () => {
      const [cpfDigits, password] = await Promise.all([
        authStorage.getSavedCpf(),
        authStorage.getSavedPassword(),
      ]);
      setFormData((prev) => ({
        ...prev,
        ...(cpfDigits ? { cpf: formatCpf(cpfDigits) } : {}),
        ...(password ? { password } : {}),
      }));
    })();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await authApi.login(formData);
      await login(response.accessToken, response.user, rememberMe);
      if (rememberMe) {
        await authStorage.saveLoginCredentials(formData.cpf, formData.password);
      }
      router.replace('/home');
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      Alert.alert('Erro ao fazer login', message || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
            <Text style={styles.title}>Gestão de Caçambas</Text>
            <Text style={styles.subtitle}>App do Motorista</Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="CPF"
                placeholderTextColor="#999"
                value={formData.cpf}
                onChangeText={(text) => setFormData({ ...formData, cpf: formatCpf(text) })}
                keyboardType="numeric"
                maxLength={14}
              />

              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Senha"
                  placeholderTextColor="#999"
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
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#666" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.rememberText}>Lembrar senha</Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#0ea5e9',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  form: {
    gap: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#111',
  },
  passwordInputContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#111',
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
    borderColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0ea5e9',
  },
  rememberText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#666',
    flexShrink: 1,
  },
  button: {
    backgroundColor: '#0ea5e9',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    width: '100%',
    textAlign: 'center',
  },
});
