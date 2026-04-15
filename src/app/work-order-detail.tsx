import { useLocation } from '@/hooks/useLocation';
import { dumpstersApi } from '@/lib/api';
import {
  enqueueWorkOrderComplete,
  enqueueWorkOrderStart,
} from '@/lib/db/outboxRepository';
import {
  getWorkOrderById,
  upsertWorkOrder,
} from '@/lib/db/workOrdersRepository';
import {
  applyOptimisticComplete,
  applyOptimisticStart,
} from '@/lib/sync/optimisticWorkOrder';
import { runSyncEngine } from '@/lib/sync/syncEngine';
import { pullDriverWorkOrders } from '@/lib/sync/pullDriverWorkOrders';
import type { CompleteMutationPayload } from '@/lib/sync/payloads';
import { Dumpster, DumpsterStatus, WorkOrder, WorkOrderType } from '@/shared';
import { formatDateBr, formatWorkOrderDeliveryDuration } from '@/utils/date';
import { getWorkOrderScheduledDateLabel } from '@/utils/work-order-labels';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function WorkOrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.id as string;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { location, getCurrentLocation, loading: locationLoading } = useLocation();
  const [returnLoad, setReturnLoad] = useState<'EMPTY' | 'WITH_RESIDUE' | null>(null);
  const [notes, setNotes] = useState('');
  const [timer, setTimer] = useState<number>(0);
  const [availableDumpsters, setAvailableDumpsters] = useState<Dumpster[]>([]);
  const [selectedDumpsterId, setSelectedDumpsterId] = useState<string | null>(null);

  useEffect(() => {
    setReturnLoad(null);
    void loadWorkOrder();
  }, [orderId]);

  const needsDriverDumpsterChoice =
    workOrder?.status === 'PENDING' &&
    workOrder.type === WorkOrderType.DROP_OFF &&
    !workOrder.dumpsterId;

  useEffect(() => {
    if (!needsDriverDumpsterChoice) {
      setAvailableDumpsters([]);
      setSelectedDumpsterId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await dumpstersApi.getAll();
        const list = (res.data as Dumpster[]).filter(
          (d) => d.status === DumpsterStatus.AVAILABLE,
        );
        if (!cancelled) setAvailableDumpsters(list);
      } catch {
        if (!cancelled) setAvailableDumpsters([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsDriverDumpsterChoice, workOrder?.id]);

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

  const loadWorkOrder = async () => {
    setLoading(true);
    try {
      try {
        await runSyncEngine();
      } catch {
        // continua com snapshot local
      }
      let wo = await getWorkOrderById(orderId);
      if (!wo) {
        try {
          await pullDriverWorkOrders();
          wo = await getWorkOrderById(orderId);
        } catch {
          // pull falhou; mantém wo null
        }
      }
      if (!wo) {
        Alert.alert(
          'Tarefa',
          'Não foi possível carregar esta tarefa. Volte à lista e atualize.',
        );
        router.back();
        return;
      }
      setWorkOrder(wo);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!workOrder) return;

    if (needsDriverDumpsterChoice) {
      if (!selectedDumpsterId) {
        Alert.alert('Caçamba', 'Selecione o número da caçamba antes de iniciar.');
        return;
      }
    }

    setStarting(true);
    try {
      const selectedDumpster =
        needsDriverDumpsterChoice && selectedDumpsterId
          ? availableDumpsters.find((d) => d.id === selectedDumpsterId)
          : undefined;
      const optimistic = applyOptimisticStart(workOrder, {
        dumpsterId:
          needsDriverDumpsterChoice && selectedDumpsterId
            ? selectedDumpsterId
            : undefined,
        dumpster: selectedDumpster,
      });
      setWorkOrder(optimistic);
      await upsertWorkOrder(optimistic);
      await enqueueWorkOrderStart(workOrder.id, {
        dumpsterId:
          needsDriverDumpsterChoice && selectedDumpsterId
            ? selectedDumpsterId
            : undefined,
      });
      void runSyncEngine();
      Alert.alert('Sucesso', 'Tarefa iniciada!');
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      Alert.alert('Erro', message || 'Não foi possível registar o início da tarefa');
    } finally {
      setStarting(false);
    }
  };

  const handleGetLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      Alert.alert('Sucesso', 'Localização capturada!');
    } else {
      Alert.alert('Erro', 'Não foi possível obter a localização');
    }
  };

  const handleComplete = async () => {
    if (!workOrder) return;
    if (!location) {
      Alert.alert('Atenção', 'É necessário capturar a localização GPS para concluir a tarefa');
      return;
    }

    const exchangeLeg =
      workOrder.type === WorkOrderType.EXCHANGE ? (workOrder.exchangeLeg ?? 1) : null;
    const needsReturnLoad =
      workOrder.type === WorkOrderType.PICK_UP ||
      (workOrder.type === WorkOrderType.EXCHANGE && exchangeLeg === 2);
    if (needsReturnLoad && !returnLoad) {
      Alert.alert(
        'Atenção',
        'Informe se a caçamba retirada do local está vazia ou com resíduos.',
      );
      return;
    }

    setCompleting(true);

    try {
      const completeBody: CompleteMutationPayload = {
        lat: location.lat,
        lng: location.lng,
        ...(location.accuracy != null ? { accuracy: location.accuracy } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(needsReturnLoad && returnLoad ? { returnLoad } : {}),
      };

      const prevExchangeLeg1 =
        workOrder.type === WorkOrderType.EXCHANGE &&
        (workOrder.exchangeLeg ?? 1) === 1;

      const optimistic = applyOptimisticComplete(workOrder, completeBody);
      setWorkOrder(optimistic);
      await upsertWorkOrder(optimistic);
      await enqueueWorkOrderComplete(workOrder.id, completeBody);
      void runSyncEngine();

      if (prevExchangeLeg1) {
        setReturnLoad(null);
        Alert.alert(
          'Sucesso',
          'Entrega da caçamba nova registrada. Agora retire a caçamba antiga do local e informe se está vazia ou com resíduos.',
        );
        return;
      }

      Alert.alert('Sucesso', 'Tarefa concluída!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Erro',
        message || 'Não foi possível registar a conclusão localmente.',
      );
    } finally {
      setCompleting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDestination = (): { address: string; lat?: number; lng?: number } | null => {
    if (!workOrder) return null;
    if (workOrder.jobSite?.address) {
      return {
        address: `${workOrder.jobSite.name || 'Endereço'} - ${workOrder.jobSite.address}`,
        lat: workOrder.jobSite.latitude,
        lng: workOrder.jobSite.longitude,
      };
    }
    if (workOrder.yard?.address) {
      return {
        address: workOrder.yard.address,
        lat: workOrder.yard.latitude,
        lng: workOrder.yard.longitude,
      };
    }
    return null;
  };

  const handleOpenMaps = async () => {
    const destination = getDestination();
    if (!destination) {
      Alert.alert('Erro', 'Nenhum endereço de destino disponível para esta tarefa.');
      return;
    }

    const query = destination.lat != null && destination.lng != null
      ? `${destination.lat},${destination.lng}`
      : encodeURIComponent(destination.address);

    const urls = {
      apple: `https://maps.apple.com/?daddr=${query}`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    };

    const urlToOpen = Platform.OS === 'ios' ? urls.apple : urls.google;

    try {
      const canOpen = await Linking.canOpenURL(urlToOpen);
      if (canOpen) {
        await Linking.openURL(urlToOpen);
      } else {
        await Linking.openURL(urls.google);
      }
    } catch {
      try {
        await Linking.openURL(urls.google);
      } catch (err) {
        Alert.alert(
          'Erro',
          'Não foi possível abrir o aplicativo de mapas. Tente copiar o endereço manualmente.',
        );
      }
    }
  };

  const getTypeLabel = (type: WorkOrderType) => {
    switch (type) {
      case 'DROP_OFF':
        return 'Entrega';
      case 'PICK_UP':
        return 'Retirada';
      case 'EXCHANGE':
        return 'Troca';
      case 'DUMP':
        return 'Outro';
      default:
        return type;
    }
  };

  if (loading || !workOrder) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#0ea5e9" />
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
  const needsReturnLoadForUi =
    workOrder.type === WorkOrderType.PICK_UP ||
    (workOrder.type === WorkOrderType.EXCHANGE && exchangeLeg === 2);

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
              <Text style={styles.label}>Caçamba</Text>
              <Text style={styles.value}>
                {workOrder.dumpster?.code ??
                  (workOrder.type === WorkOrderType.DROP_OFF
                    ? 'A definir ao iniciar'
                    : '—')}
              </Text>
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

            {workOrder.jobSite && (
              <View style={styles.infoSection}>
                <Text style={styles.label}>Obra</Text>
                <Text style={styles.value}>{workOrder.jobSite.name || 'Endereço'} - {workOrder.jobSite.address}</Text>
                {workOrder.jobSite.customer && (
                  <Text style={styles.subValue}>Cliente: {workOrder.jobSite.customer.name}</Text>
                )}
              </View>
            )}

            {workOrder.yard && (
              <View style={styles.infoSection}>
                <Text style={styles.label}>Terreno</Text>
                <Text style={styles.value}>{workOrder.yard.name}</Text>
                <Text style={styles.subValue}>{workOrder.yard.address}</Text>
              </View>
            )}

            {getDestination() && (
              <TouchableOpacity
                style={styles.mapsButton}
                onPress={handleOpenMaps}
              >
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

            {workOrder.status === 'PENDING' && needsDriverDumpsterChoice && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Caçamba para esta entrega *</Text>
                <Text style={styles.subValue}>
                  O pedido foi aberto sem número. Escolha a caçamba disponível antes de dar partida.
                </Text>
                {availableDumpsters.length === 0 ? (
                  <Text style={styles.subValue}>Carregando caçambas disponíveis…</Text>
                ) : (
                  availableDumpsters.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[
                        styles.dumpsterOption,
                        selectedDumpsterId === d.id && styles.dumpsterOptionSelected,
                      ]}
                      onPress={() => setSelectedDumpsterId(d.id)}
                    >
                      <Text
                        style={
                          selectedDumpsterId === d.id
                            ? styles.dumpsterOptionTextSelected
                            : styles.dumpsterOptionText
                        }
                      >
                        {d.code}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {workOrder.status === 'PENDING' && (
              <TouchableOpacity
                style={[
                  styles.startButton,
                  needsDriverDumpsterChoice && !selectedDumpsterId && styles.startButtonDisabled,
                ]}
                onPress={handleStart}
                disabled={starting || (needsDriverDumpsterChoice && !selectedDumpsterId)}
              >
                {starting ? (
                  <ActivityIndicator color="#fff" />
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
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>
                        {location ? 'Localização capturada ✓' : 'Capturar localização'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {location && (
                    <Text style={styles.locationText}>
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                      {location.accuracy && ` (${location.accuracy.toFixed(0)}m)`}
                    </Text>
                  )}
                </View>

                {needsReturnLoadForUi && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Caçamba retirada do local *</Text>
                    <Text style={styles.subValue}>
                      A caçamba que sai do cliente está vazia ou ainda com resíduos?
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.dumpsterOption,
                        returnLoad === 'EMPTY' && styles.dumpsterOptionSelected,
                      ]}
                      onPress={() => setReturnLoad('EMPTY')}
                    >
                      <Text
                        style={
                          returnLoad === 'EMPTY'
                            ? styles.dumpsterOptionTextSelected
                            : styles.dumpsterOptionText
                        }
                      >
                        Vazia
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.dumpsterOption,
                        returnLoad === 'WITH_RESIDUE' && styles.dumpsterOptionSelected,
                      ]}
                      onPress={() => setReturnLoad('WITH_RESIDUE')}
                    >
                      <Text
                        style={
                          returnLoad === 'WITH_RESIDUE'
                            ? styles.dumpsterOptionTextSelected
                            : styles.dumpsterOptionText
                        }
                      >
                        Com resíduos
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Observações (Opcional)</Text>
                  <TextInput
                    style={styles.textArea}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Digite observações..."
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.completeButton,
                    (!location || (needsReturnLoadForUi && !returnLoad)) &&
                      styles.completeButtonDisabled,
                  ]}
                  onPress={handleComplete}
                  disabled={
                    completing || !location || (needsReturnLoadForUi && !returnLoad)
                  }
                >
                  {completing ? (
                    <ActivityIndicator color="#fff" />
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

            {workOrder.status === 'DONE' && (
              <View style={styles.completedSection}>
                <Text style={styles.completedText}>✓ Tarefa Concluída</Text>
                {deliveryDuration && (
                  <Text style={styles.completedDuration}>Tempo de entrega: {deliveryDuration}</Text>
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
    backgroundColor: '#f5f5f5',
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
  sequence: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#666',
  },
  type: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#0ea5e9',
  },
  headerTypeCol: {
    alignItems: 'flex-end',
    maxWidth: '72%',
  },
  exchangeStepHint: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#64748b',
    marginTop: 4,
    textAlign: 'right',
  },
  infoSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  mapsButton: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  mapsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#333',
  },
  subValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  timerSection: {
    backgroundColor: '#e0f2fe',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  timerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  timer: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    color: '#0ea5e9',
  },
  timerSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  startButton: {
    backgroundColor: '#0ea5e9',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  startButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  dumpsterOption: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  dumpsterOptionSelected: {
    borderColor: '#0ea5e9',
    backgroundColor: '#e0f2fe',
  },
  dumpsterOptionText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Inter_600SemiBold',
  },
  dumpsterOptionTextSelected: {
    fontSize: 16,
    color: '#0369a1',
    fontFamily: 'Inter_700Bold',
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
    color: '#333',
  },
  actionButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  completeButton: {
    backgroundColor: '#0ea5e9',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  completeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  completedSection: {
    backgroundColor: '#d1fae5',
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
    color: '#047857',
    marginBottom: 6,
  },
  completedDate: {
    fontSize: 14,
    color: '#666',
  },
  proofSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    width: '100%',
  },
  proofTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#333',
    marginBottom: 8,
  },
  proofText: {
    fontSize: 12,
    color: '#666',
  },
  proofNotes: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
