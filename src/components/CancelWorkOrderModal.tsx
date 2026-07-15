import { AppText as Text, AppTextInput as TextInput } from '@/components/AppText';
import { WorkOrderCancellationReason } from '@/shared';
import { colors } from '@/theme';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

const REASONS: Array<{ value: WorkOrderCancellationReason; label: string }> = [
  {
    value: WorkOrderCancellationReason.STARTED_BY_MISTAKE,
    label: 'Iniciei por engano',
  },
  {
    value: WorkOrderCancellationReason.ACCESS_OBSTRUCTED,
    label: 'Acesso ou caçamba obstruída',
  },
  {
    value: WorkOrderCancellationReason.VEHICLE_PROBLEM,
    label: 'Problema no caminhão',
  },
  {
    value: WorkOrderCancellationReason.DUMPSTER_TOO_HEAVY,
    label: 'Caçamba muito pesada',
  },
  { value: WorkOrderCancellationReason.OTHER, label: 'Outro motivo' },
];

interface CancelWorkOrderModalProps {
  visible: boolean;
  canceling: boolean;
  isExchangePickupStage?: boolean;
  onClose: () => void;
  onConfirm: (reason: WorkOrderCancellationReason, notes?: string) => void;
}

export function CancelWorkOrderModal({
  visible,
  canceling,
  isExchangePickupStage = false,
  onClose,
  onConfirm,
}: CancelWorkOrderModalProps) {
  const [reason, setReason] = useState<WorkOrderCancellationReason | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setNotes('');
      setError(null);
    }
  }, [visible]);

  const handleConfirm = () => {
    if (!reason) {
      setError('Selecione o motivo do cancelamento.');
      return;
    }
    const trimmedNotes = notes.trim();
    if (reason === WorkOrderCancellationReason.OTHER && !trimmedNotes) {
      setError('Descreva o motivo do cancelamento.');
      return;
    }
    setError(null);
    onConfirm(reason, trimmedNotes || undefined);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!canceling) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={canceling ? undefined : onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Cancelar pedido</Text>
            <Text style={styles.description}>
              Informe o que impediu a execução. O administrativo poderá consultar este registro.
            </Text>
            {isExchangePickupStage && (
              <Text style={styles.warning}>
                A caçamba nova já entregue continuará registrada na obra. O cancelamento encerrará a retirada que não pôde ser realizada.
              </Text>
            )}

            <View style={styles.reasonList}>
              {REASONS.map((option) => {
                const selected = reason === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.reasonButton, selected && styles.reasonButtonSelected]}
                    onPress={() => {
                      setReason(option.value);
                      setError(null);
                    }}
                    disabled={canceling}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.notesLabel}>
              Detalhes {reason === WorkOrderCancellationReason.OTHER ? '*' : '(opcional)'}
            </Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Conte o que aconteceu..."
              placeholderTextColor={colors.textSubtle}
              multiline
              maxLength={1000}
              editable={!canceling}
            />
            <Text style={styles.counter}>{notes.length}/1000</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={onClose}
                disabled={canceling}
              >
                <Text style={styles.backButtonText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                disabled={canceling}
              >
                {canceling ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmar cancelamento</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: colors.appText,
  },
  description: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  warning: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fffbeb',
    color: '#92400e',
    fontSize: 13,
    lineHeight: 18,
  },
  reasonList: {
    marginTop: 18,
    gap: 8,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderWidth: 1,
    borderColor: colors.borderLighter,
    borderRadius: 10,
  },
  reasonButtonSelected: {
    borderColor: colors.danger,
    backgroundColor: '#fef2f2',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioSelected: {
    borderColor: colors.danger,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: colors.appText,
  },
  reasonTextSelected: {
    fontFamily: 'Inter_600SemiBold',
    color: '#991b1b',
  },
  notesLabel: {
    marginTop: 18,
    marginBottom: 7,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.appText,
  },
  notesInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    color: colors.appText,
  },
  counter: {
    marginTop: 4,
    textAlign: 'right',
    fontSize: 11,
    color: colors.textSubtle,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  backButton: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
  },
  confirmButton: {
    flex: 2,
    minHeight: 48,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  confirmButtonText: {
    color: colors.surface,
    fontFamily: 'Inter_700Bold',
  },
});
