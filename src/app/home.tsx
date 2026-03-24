import { useAuth } from '@/hooks/useAuth';
import { useSync } from '@/hooks/useSync';
import { workOrdersApi } from '@/lib/api';
import { WorkOrder, WorkOrderStatus, WorkOrderType } from '@/shared';
import { formatWorkOrderDeliveryDuration } from '@/utils/date';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCpf(cpf: string | undefined): string {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  useSync();
  const today = new Date();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>(() => new Date(today));
  const [dateTo, setDateTo] = useState<Date>(() => new Date(today));
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showPickerFor, setShowPickerFor] = useState<'from' | 'to' | null>(null);
  const isInitialMount = useRef(true);

  const loadWorkOrders = useCallback(async (silent = false, from?: Date, to?: Date) => {
    const fromDate = from ?? dateFrom;
    const toDate = to ?? dateTo;
    if (!silent) setLoading(true);
    try {
      const response = await workOrdersApi.getMyOrders(toDateString(fromDate), toDateString(toDate));
      setWorkOrders(response.data);
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo]);

  const applyFilter = () => {
    loadWorkOrders(true, dateFrom, dateTo);
    setFilterModalVisible(false);
  };

  const clearFilter = () => {
    const now = new Date();
    setDateFrom(now);
    setDateTo(now);
    loadWorkOrders(true, now, now);
    setFilterModalVisible(false);
  };

  const handleDateChange = (event: { type: string }, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPickerFor(null);
    if (event?.type === 'dismissed' || !selectedDate) return;
    if (showPickerFor === 'from') setDateFrom(selectedDate);
    if (showPickerFor === 'to') setDateTo(selectedDate);
    if (Platform.OS === 'ios') setShowPickerFor(null);
  };

  const formatDateDisplay = (d: Date) =>
    `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

  useFocusEffect(
    useCallback(() => {
      const showLoading = isInitialMount.current;
      if (isInitialMount.current) isInitialMount.current = false;
      loadWorkOrders(showLoading);
    }, [loadWorkOrders]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadWorkOrders(true);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const getStatusLabel = (status: WorkOrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'Pendente';
      case 'IN_PROGRESS':
        return 'Em Andamento';
      case 'DONE':
        return 'Concluída';
      case 'CANCELED':
        return 'Cancelada';
      default:
        return status;
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

  const getStatusColor = (status: WorkOrderStatus) => {
    switch (status) {
      case 'PENDING':
        return '#fbbf24';
      case 'IN_PROGRESS':
        return '#3b82f6';
      case 'DONE':
        return '#10b981';
      case 'CANCELED':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  const activeOrders = workOrders.filter(
    (wo) => wo.status === 'PENDING' || wo.status === 'IN_PROGRESS',
  );
  const completedOrders = workOrders.filter((wo) => wo.status === 'DONE');
  const displayOrders = activeOrders.length > 0 ? activeOrders : completedOrders;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Minhas Tarefas</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
        {user && (
          <Text style={styles.driverInfo} numberOfLines={1}>
            {user.name}{user.cpf ? ` • ${formatCpf(user.cpf)}` : ''}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.filterBar}
        onPress={() => setFilterModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.filterBarText}>
          {toDateString(dateFrom) === toDateString(dateTo)
            ? formatDateDisplay(dateFrom)
            : `${formatDateDisplay(dateFrom)} - ${formatDateDisplay(dateTo)}`}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={styles.modalTitle}>Filtrar por período</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Data inicial</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowPickerFor('from')}
              >
                <Text style={styles.dateInputText}>
                  {formatDateDisplay(dateFrom)}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#666" style={styles.dateInputIcon} />
              </TouchableOpacity>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Data final</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowPickerFor('to')}
              >
                <Text style={styles.dateInputText}>
                  {formatDateDisplay(dateTo)}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#666" style={styles.dateInputIcon} />
              </TouchableOpacity>
            </View>
            {showPickerFor && (
              <DateTimePicker
                value={showPickerFor === 'from' ? dateFrom : dateTo}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
            )}
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity style={styles.clearButton} onPress={clearFilter}>
                <Text style={styles.clearButtonText}>Limpar</Text>
              </TouchableOpacity>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setFilterModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterButton} onPress={applyFilter}>
                  <Text style={styles.filterButtonText}>Filtrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {displayOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma tarefa para este dia</Text>
          </View>
        ) : (
          displayOrders.map((order) => {
            const deliveryDuration = formatWorkOrderDeliveryDuration(
              order.startedAt,
              order.completedAt,
              order.status,
            );
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => router.push(`/work-order-detail?id=${order.id}`)}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderSequence}>{order.sequence}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(order.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: getStatusColor(order.status) }]}
                    >
                      {getStatusLabel(order.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderType}>{getTypeLabel(order.type)}</Text>
                <Text style={styles.orderInfo}>
                  {order.dumpster?.code} - {order.vehicle?.placa}
                </Text>
                {order.jobSite && (
                  <Text style={styles.orderAddress}>{order.jobSite.name || 'Endereço'} - {order.jobSite.address}</Text>
                )}
                {order.yard && <Text style={styles.orderAddress}>{order.yard.name}</Text>}
                {deliveryDuration && (
                  <Text style={styles.orderSchedule}>
                    Tempo de entrega: {deliveryDuration}
                    {order.status === WorkOrderStatus.IN_PROGRESS ? ' (até agora)' : ''}
                  </Text>
                )}
                {order.startedAt && (
                  <Text style={styles.orderTime}>
                    Iniciado: {new Date(order.startedAt).toLocaleString('pt-BR')}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  logoutButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  driverInfo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  filterBar: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  filterBarText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#333',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    minWidth: 280,
    alignSelf: 'stretch',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#333',
    marginBottom: 16,
  },
  dateRow: {
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    minWidth: 140,
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginRight: 12,
    paddingRight: 4,
  },
  dateInputIcon: {
    marginLeft: 8,
  },
  modalButtonsContainer: {
    marginTop: 16,
    gap: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  modalCancelText: {
    color: '#666',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  clearButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  clearButtonText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#0ea5e9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderSequence: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  orderType: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#333',
    marginBottom: 4,
  },
  orderInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderAddress: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  orderSchedule: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  orderTime: {
    fontSize: 11,
    color: '#0ea5e9',
    marginTop: 4,
  },
});
