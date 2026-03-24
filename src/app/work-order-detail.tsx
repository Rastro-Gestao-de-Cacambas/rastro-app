import { workOrdersApi } from '@/lib/api';
import { storageService } from '@/lib/storage';
import { WorkOrder, WorkOrderType } from '@/shared';
import { formatWorkOrderDeliveryDuration } from '@/utils/date';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [timer, setTimer] = useState<number>(0);

  useEffect(() => {
    loadWorkOrder();
  }, [orderId]);

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
    try {
      const response = await workOrdersApi.getById(orderId);
      setWorkOrder(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar a tarefa');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!workOrder) return;

    setStarting(true);
    try {
      const response = await workOrdersApi.start(workOrder.id);
      setWorkOrder(response.data);
      Alert.alert('Sucesso', 'Tarefa iniciada!');
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      Alert.alert('Erro', message || 'Não foi possível iniciar a tarefa');
    } finally {
      setStarting(false);
    }
  };

  const handleGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'É necessário permissão de localização');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
      });

      Alert.alert('Sucesso', 'Localização capturada!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível obter a localização');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'É necessário permissão para usar a câmera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível tirar a foto');
    }
  };

  const handleComplete = async () => {
    if (!workOrder) return;
    if (!location) {
      Alert.alert('Atenção', 'É necessário capturar a localização GPS para concluir a tarefa');
      return;
    }

    setCompleting(true);

    try {
      const formData = new FormData();
      if (photoUri) {
        formData.append('photo', {
          uri: photoUri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        } as unknown as Blob);
      }
      formData.append('lat', location.lat.toString());
      formData.append('lng', location.lng.toString());
      if (location.accuracy) {
        formData.append('accuracy', location.accuracy.toString());
      }
      if (notes) {
        formData.append('notes', notes);
      }

      await workOrdersApi.complete(workOrder.id, formData);
      Alert.alert('Sucesso', 'Tarefa concluída!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      const status = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { status?: number; data?: { message?: string } } }).response?.status
        : undefined;
      const message = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;

      if (status === 404) {
        Alert.alert(
          'Ordem não encontrada',
          'Esta ordem de serviço não foi encontrada no servidor. Ela pode ter sido removida ou já concluída.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }

      if (status === 400 && message) {
        Alert.alert('Localização', message);
        return;
      }

      try {
        const pendingData = {
          workOrderId: workOrder.id,
          photoUri,
          lat: location?.lat ?? 0,
          lng: location?.lng ?? 0,
          accuracy: location?.accuracy,
          notes,
          timestamp: new Date().toISOString(),
        };
        await storageService.savePendingCompletion(pendingData);
        Alert.alert(
          'Salvo offline',
          'A conclusão foi salva localmente e será sincronizada quando houver conexão.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } catch (offlineError) {
        Alert.alert('Erro', 'Não foi possível salvar a conclusão');
      }
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
        return 'Descarte';
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
              <Text style={styles.type}>{getTypeLabel(workOrder.type)}</Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.label}>Caçamba</Text>
              <Text style={styles.value}>{workOrder.dumpster?.code}</Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.label}>Veículo</Text>
              <Text style={styles.value}>
                {workOrder.vehicle?.placa} - {workOrder.vehicle?.marca || workOrder.vehicle?.placa}
              </Text>
            </View>

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

            {workOrder.status === 'PENDING' && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStart}
                disabled={starting}
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
                  <TouchableOpacity style={styles.actionButton} onPress={handleGetLocation}>
                    <Text style={styles.actionButtonText}>
                      {location ? 'Localização Capturada ✓' : 'Capturar Localização'}
                    </Text>
                  </TouchableOpacity>
                  {location && (
                    <Text style={styles.locationText}>
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                      {location.accuracy && ` (${location.accuracy.toFixed(0)}m)`}
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Foto (Opcional)</Text>
                  <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
                    <Text style={styles.actionButtonText}>
                      {photoUri ? 'Foto Capturada ✓' : 'Tirar Foto'}
                    </Text>
                  </TouchableOpacity>
                  {photoUri && (
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  )}
                </View>

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
                    !location && styles.completeButtonDisabled,
                  ]}
                  onPress={handleComplete}
                  disabled={completing || !location}
                >
                  {completing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.completeButtonText}>Concluir Tarefa</Text>
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
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 10,
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
