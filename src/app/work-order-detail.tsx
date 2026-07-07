import { useLocation } from '@/hooks/useLocation';
import { workOrdersApi } from '@/lib/api';
import { registerPickerCallback } from '@/lib/dumpster-picker-callback';
import { WorkOrder, WorkOrderDumpster, WorkOrderDumpsterRole, WorkOrderStatus, WorkOrderType } from '@/shared';
import { colors } from '@/theme';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatDateBr, formatWorkOrderDeliveryDuration } from '@/utils/date';
import { getTypeLabel, getWorkOrderScheduledDateLabel } from '@/utils/work-order-labels';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatTime(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function WorkOrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.id as string;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { location, getCurrentLocation, loading: locationLoading } = useLocation();
  const [notes, setNotes] = useState('');
  const [timer, setTimer] = useState<number>(0);
  const [assignments, setAssignments] = useState<Record<string, { id: string; code: string }>>({});

  const loadWorkOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workOrdersApi.getById(orderId);
      setWorkOrder(res.data);
    } catch {
      Alert.alert('Tarefa', 'Não foi possível carregar esta tarefa. Volte à lista e tente novamente.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    void loadWorkOrder();
  }, [loadWorkOrder]);

  const boxes = workOrder?.workOrderDumpsters ?? [];
  const unassignedBoxes = boxes.filter((b) => !b.dumpsterId);
  const allBoxesAssigned = unassignedBoxes.every((b) => assignments[b.id]);

  // Reset atribuições sempre que trocar de pedido ou não houver mais caixas para declarar
  useEffect(() => {
    if (unassignedBoxes.length === 0) {
      setAssignments({});
    }
  }, [workOrder?.id, unassignedBoxes.length]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (workOrder?.status === 'IN_PROGRESS' && workOrder.startedAt) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const started = new Date(workOrder.startedAt!).getTime();
        setTimer(Math.floor((now - started) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [workOrder?.status, workOrder?.startedAt]);

  const handleStart = async () => {
    if (!workOrder) return;
    if (unassignedBoxes.length > 0 && !allBoxesAssigned) {
      Alert.alert('Caçamba', 'Selecione a caçamba para todas as caixas antes de iniciar.');
      return;
    }
    setStarting(true);
    try {
      const boxAssignments = unassignedBoxes.map((box) => ({
        workOrderDumpsterId: box.id,
        dumpsterId: assignments[box.id]!.id,
      }));
      const body = boxAssignments.length > 0 ? { boxAssignments } : undefined;
      const res = await workOrdersApi.start(workOrder.id, body);
      setWorkOrder(res.data);
      Alert.alert('Sucesso', 'Tarefa iniciada!');
    } catch (error: unknown) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível registrar o início da tarefa.'));
    } finally {
      setStarting(false);
    }
  };

  const openBoxPicker = (box: WorkOrderDumpster) => {
    registerPickerCallback((id, code) => {
      setAssignments((prev) => ({ ...prev, [box.id]: { id, code } }));
    });
    const mode =
      box.role === WorkOrderDumpsterRole.OUT
        ? 'OUT'
        : workOrder?.type === WorkOrderType.DUMP
          ? 'DUMP'
          : 'IN';
    // Caçambas já definidas (por outras caixas já atribuídas ou já declaradas nesta sessão)
    // não podem ser escolhidas de novo para esta caixa.
    const usedDumpsterIds = new Set<string>();
    for (const b of boxes) {
      if (b.dumpsterId) usedDumpsterIds.add(b.dumpsterId);
    }
    for (const [boxId, picked] of Object.entries(assignments)) {
      if (boxId !== box.id) usedDumpsterIds.add(picked.id);
    }
    const query = new URLSearchParams({ mode });
    if (mode === 'IN' && workOrder?.jobSiteId) {
      query.set('jobSiteId', workOrder.jobSiteId);
    }
    if (usedDumpsterIds.size > 0) {
      query.set('excludeIds', Array.from(usedDumpsterIds).join(','));
    }
    router.push(`/dumpster-picker?${query.toString()}`);
  };

  const handleGetLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      Alert.alert('Sucesso', 'Localização capturada!');
    } else {
      Alert.alert('Erro', 'Não foi possível obter a localização.');
    }
  };

  const handleComplete = async () => {
    if (!workOrder) return;
    if (!location) {
      Alert.alert('Atenção', 'É necessário capturar a localização GPS para concluir a tarefa.');
      return;
    }
    setCompleting(true);
    const prevExchangeLeg1 =
      workOrder.type === WorkOrderType.EXCHANGE && (workOrder.exchangeLeg ?? 1) === 1;
    try {
      const res = await workOrdersApi.complete(workOrder.id, {
        lat: location.lat,
        lng: location.lng,
        ...(location.accuracy != null ? { accuracy: location.accuracy } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setWorkOrder(res.data);
      if (prevExchangeLeg1) {
        Alert.alert(
          'Sucesso',
          'Entrega da caçamba nova registrada. Agora retire a caçamba antiga — ela ficará marcada como "Para descartar".',
        );
        return;
      }
      Alert.alert('Sucesso', 'Tarefa concluída!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível registrar a conclusão da tarefa.'));
    } finally {
      setCompleting(false);
    }
  };

  const getDestinationQuery = (): string | null => {
    if (!workOrder) return null;
    if (workOrder.status === WorkOrderStatus.PENDING) return null;
    if (workOrder.type === WorkOrderType.DUMP) return null;
    if (workOrder.jobSite?.address) {
      const js = workOrder.jobSite;
      return [js.address, js.city, js.state, 'Brasil'].filter(Boolean).join(', ');
    }
    if (workOrder.yard?.address) {
      return [workOrder.yard.address, 'Brasil'].filter(Boolean).join(', ');
    }
    return null;
  };

  const handleOpenMaps = async () => {
    const query = getDestinationQuery();
    if (!query) {
      Alert.alert('Erro', 'Nenhum endereço de destino disponível para esta tarefa.');
      return;
    }

    const encoded = encodeURIComponent(query);
    const urls = {
      apple: `https://maps.apple.com/?daddr=${encoded}`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
    };
    const urlToOpen = Platform.OS === 'ios' ? urls.apple : urls.google;
    try {
      const canOpen = await Linking.canOpenURL(urlToOpen);
      await Linking.openURL(canOpen ? urlToOpen : urls.google);
    } catch {
      try {
        await Linking.openURL(urls.google);
      } catch {
        Alert.alert('Erro', 'Não foi possível abrir o aplicativo de mapas. Tente copiar o endereço manualmente.');
      }
    }
  };

  if (loading || !workOrder) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const deliveryDuration = formatWorkOrderDeliveryDuration(
    workOrder.startedAt,
    workOrder.completedAt,
    workOrder.status,
  );

  const exchangeLeg =
    workOrder.type === WorkOrderType.EXCHANGE ? (workOrder.exchangeLeg ?? 1) : null;
  const scheduledLabel = getWorkOrderScheduledDateLabel(workOrder.type);
  const vehicleLine = (() => {
    const v = workOrder.vehicle;
    if (!v) return '—';
    const extra = [v.marca, v.modelo].filter(Boolean).join(' ');
    return extra ? `${v.placa} · ${extra}` : v.placa;
  })();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.sequence}>{workOrder.sequence}</Text>
              <View style={styles.headerTypeCol}>
                <Text style={styles.type}>{getTypeLabel(workOrder.type)}</Text>
                {exchangeLeg != null && workOrder.status === 'IN_PROGRESS' && (
                  <Text style={styles.exchangeStepHint}>
                    {exchangeLeg === 1
                      ? 'Etapa 1: entregar caçamba nova'
                      : 'Etapa 2: retirar caçamba antiga'}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.label}>{boxes.length > 1 ? 'Caçambas' : 'Caçamba'}</Text>
              {boxes.length === 0 ? (
                <Text style={styles.value}>—</Text>
              ) : workOrder.type === WorkOrderType.EXCHANGE ? (
                <>
                  <Text style={styles.subValue}>Entregar</Text>
                  {boxes
                    .filter((b) => b.role === WorkOrderDumpsterRole.OUT)
                    .map((b) => (
                      <Text key={b.id} style={styles.value}>
                        {b.dumpster?.code ?? 'A definir ao iniciar'}
                      </Text>
                    ))}
                  <Text style={[styles.subValue, { marginTop: 8 }]}>Retirar</Text>
                  {boxes
                    .filter((b) => b.role === WorkOrderDumpsterRole.IN)
                    .map((b) => (
                      <Text key={b.id} style={styles.value}>
                        {b.dumpster?.code ?? 'A definir ao iniciar'}
                      </Text>
                    ))}
                </>
              ) : (
                boxes.map((b) => (
                  <Text key={b.id} style={styles.value}>
                    {b.dumpster?.code ?? 'A definir ao iniciar'}
                  </Text>
                ))
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.label}>Veículo</Text>
              <Text style={styles.value}>{vehicleLine}</Text>
            </View>

            {workOrder.scheduledAt && (
              <View style={styles.infoSection}>
                <Text style={styles.label}>{scheduledLabel}</Text>
                <Text style={styles.value}>{formatDateBr(workOrder.scheduledAt)}</Text>
              </View>
            )}

            {workOrder.returnDueDate && (
              <View style={styles.infoSection}>
                <Text style={styles.label}>Prazo de devolução</Text>
                <Text style={styles.value}>{formatDateBr(workOrder.returnDueDate)}</Text>
              </View>
            )}

            {workOrder.observations?.trim() ? (
              <View style={styles.infoSection}>
                <Text style={styles.label}>Observações do pedido</Text>
                <Text style={styles.value}>{workOrder.observations}</Text>
              </View>
            ) : null}

            {workOrder.jobSite?.customer && (
              <View style={styles.infoSection}>
                <Text style={styles.label}>Cliente</Text>
                <Text style={styles.value}>{workOrder.jobSite.customer.name}</Text>
              </View>
            )}

            {workOrder.jobSite && (
              <View style={styles.infoSection}>
                <Text style={styles.label}>Obra</Text>
                <Text style={styles.value}>
                  {workOrder.jobSite.name || 'Endereço'} - {workOrder.jobSite.address}
                </Text>
              </View>
            )}

            {workOrder.yard && (
              <View style={styles.infoSection}>
                <Text style={styles.label}>Terreno</Text>
                <Text style={styles.value}>{workOrder.yard.name}</Text>
                <Text style={styles.subValue}>{workOrder.yard.address}</Text>
              </View>
            )}

            {getDestinationQuery() && (
              <TouchableOpacity style={styles.mapsButton} onPress={handleOpenMaps}>
                <Text style={styles.mapsButtonText}>🗺️ Abrir no Maps</Text>
              </TouchableOpacity>
            )}

            {workOrder.status === 'IN_PROGRESS' && workOrder.startedAt && (
              <View style={styles.timerSection}>
                <Text style={styles.timerLabel}>Tempo decorrido</Text>
                <Text style={styles.timer}>{formatTime(timer)}</Text>
                <Text style={styles.timerSubtext}>
                  Iniciado: {new Date(workOrder.startedAt).toLocaleString('pt-BR')}
                </Text>
              </View>
            )}

            {workOrder.status === 'PENDING' && unassignedBoxes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {unassignedBoxes.length > 1 ? 'Caçambas para esta etapa *' : 'Caçamba para esta etapa *'}
                </Text>
                <Text style={styles.subValue}>
                  O pedido foi aberto sem número. Selecione a(s) caçamba(s) antes de dar partida.
                </Text>
                {unassignedBoxes.map((box) => {
                  const picked = assignments[box.id];
                  const placeholder =
                    workOrder.type === WorkOrderType.EXCHANGE
                      ? box.role === WorkOrderDumpsterRole.OUT
                        ? 'A entregar — toque para buscar…'
                        : 'A retirar — toque para buscar…'
                      : 'Toque para buscar a caçamba…';
                  return (
                    <TouchableOpacity
                      key={box.id}
                      style={[styles.pickerButton, picked && styles.pickerButtonSelected]}
                      onPress={() => openBoxPicker(box)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={picked ? 'checkmark-circle' : 'search'}
                        size={22}
                        color={picked ? colors.primaryDark : colors.textMuted}
                      />
                      <Text
                        style={[styles.pickerButtonText, picked && styles.pickerButtonTextSelected]}
                      >
                        {picked?.code ?? placeholder}
                      </Text>
                      {picked && (
                        <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {workOrder.status === 'PENDING' && (
              <TouchableOpacity
                style={[
                  styles.startButton,
                  unassignedBoxes.length > 0 && !allBoxesAssigned && styles.startButtonDisabled,
                ]}
                onPress={handleStart}
                disabled={starting || (unassignedBoxes.length > 0 && !allBoxesAssigned)}
              >
                {starting ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.startButtonText}>Dar Partida</Text>
                )}
              </TouchableOpacity>
            )}

            {workOrder.status === 'IN_PROGRESS' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Localização GPS (obrigatório)</Text>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleGetLocation}
                    disabled={locationLoading}
                  >
                    {locationLoading ? (
                      <ActivityIndicator color={colors.surface} />
                    ) : (
                      <Text style={styles.actionButtonText}>
                        {location ? 'Localização capturada ✓' : 'Capturar localização'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {location && (
                    <Text style={styles.locationText}>
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                      {location.accuracy != null && ` (${location.accuracy.toFixed(0)}m)`}
                    </Text>
                  )}
                  {location?.accuracy != null && location.accuracy > 50 && (
                    <Text style={styles.locationWarning}>
                      Precisão insuficiente ({location.accuracy.toFixed(0)}m). Máx. permitido: 50m. Tente capturar novamente ao ar livre.
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Observações (Opcional)</Text>
                  <TextInput
                    style={styles.textArea}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Digite observações..."
                    placeholderTextColor={colors.textSubtle}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.completeButton, !location && styles.completeButtonDisabled]}
                  onPress={handleComplete}
                  disabled={completing || !location}
                >
                  {completing ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.completeButtonText}>
                      {workOrder.type === WorkOrderType.EXCHANGE && exchangeLeg === 1
                        ? 'Concluir entrega (etapa 1)'
                        : 'Concluir tarefa'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {(workOrder.status === 'DONE' || workOrder.status === 'DELIVERED') && (
              <View style={styles.completedSection}>
                <Text style={styles.completedText}>✓ Tarefa Concluída</Text>
                {deliveryDuration && (
                  <Text style={styles.completedDuration}>
                    Tempo de entrega: {deliveryDuration}
                  </Text>
                )}
                {workOrder.completedAt && (
                  <Text style={styles.completedDate}>
                    Concluído em: {new Date(workOrder.completedAt).toLocaleString('pt-BR')}
                  </Text>
                )}
                {workOrder.proofs && workOrder.proofs.length > 0 && (
                  <View style={styles.proofSection}>
                    <Text style={styles.proofTitle}>Última Comprovação</Text>
                    <Text style={styles.proofText}>
                      {workOrder.proofs[0].lat.toFixed(6)}, {workOrder.proofs[0].lng.toFixed(6)}
                    </Text>
                    {workOrder.proofs[0].notes && (
                      <Text style={styles.proofNotes}>{workOrder.proofs[0].notes}</Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  sequence: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: colors.textMuted,
  },
  type: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  headerTypeCol: {
    alignItems: 'flex-end',
    maxWidth: '72%',
  },
  exchangeStepHint: {
    fontSize: 13,
    color: colors.textSlate,
    marginTop: 4,
    textAlign: 'right',
  },
  infoSection: {
    backgroundColor: colors.surface,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  mapsButton: {
    backgroundColor: colors.mapsBlue,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  mapsButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.appText,
  },
  subValue: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  timerSection: {
    backgroundColor: colors.primaryLight,
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  timerLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  timer: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  timerSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  startButton: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  startButtonText: {
    color: colors.surface,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  startButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderLighter,
    backgroundColor: colors.appBg,
    marginTop: 8,
  },
  pickerButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  pickerButtonTextSelected: {
    color: colors.primaryDark,
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  section: {
    backgroundColor: colors.surface,
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
    color: colors.appText,
  },
  actionButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  locationText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 5,
  },
  locationWarning: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.appText,
  },
  completeButton: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  completeButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  completeButtonText: {
    color: colors.surface,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  completedSection: {
    backgroundColor: colors.primaryLight,
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  completedText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#10b981',
    marginBottom: 8,
  },
  completedDuration: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primaryDark,
    marginBottom: 6,
  },
  completedDate: {
    fontSize: 14,
    color: colors.textMuted,
  },
  proofSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    width: '100%',
  },
  proofTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: colors.appText,
    marginBottom: 8,
  },
  proofText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  proofNotes: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
