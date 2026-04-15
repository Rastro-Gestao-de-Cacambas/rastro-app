import { useAuth } from '@/hooks/useAuth';
import { getAllWorkOrders } from '@/lib/db/workOrdersRepository';
import { runSyncEngine } from '@/lib/sync/syncEngine';
import { WorkOrder, WorkOrderStatus, WorkOrderType } from '@/shared';
import { formatDateBr, formatWorkOrderDeliveryDuration } from '@/utils/date';
import { getWorkOrderScheduledDateLabel } from '@/utils/work-order-labels';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isInitialMount = useRef(true);

  const loadWorkOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      try {
        await runSyncEngine();
      } catch (error) {
        console.error('Erro na sincronização:', error);
      }
      let local = await getAllWorkOrders();
      setWorkOrders(local);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
        return 'Outro';
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

  const renderOrderCard = (order: WorkOrder) => {
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
        {order.scheduledAt && (
          <Text style={styles.orderScheduled}>
            {getWorkOrderScheduledDateLabel(order.type)}: {formatDateBr(order.scheduledAt)}
          </Text>
        )}
        <Text style={styles.orderInfo}>
          {(order.dumpster?.code ?? '—') + ' - ' + (order.vehicle?.placa ?? '—')}
        </Text>
        {order.jobSite && (
          <Text style={styles.orderAddress}>
            {order.jobSite.name || 'Endereço'} - {order.jobSite.address}
          </Text>
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
  };

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

      <View style={styles.hintBar}>
        <Text style={styles.hintBarText}>
          Pedidos de hoje e pendentes em aberto (incluindo atrasados)
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {workOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma tarefa no momento</Text>
          </View>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>Em aberto</Text>
                {activeOrders.map((o) => renderOrderCard(o))}
              </View>
            )}
            {completedOrders.length > 0 && (
              <View
                style={[
                  styles.sectionBlock,
                  activeOrders.length > 0 && styles.sectionBlockSpaced,
                ]}
              >
                <Text style={styles.sectionHeading}>Concluídas</Text>
                {completedOrders.map((o) => renderOrderCard(o))}
              </View>
            )}
          </>
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
  hintBar: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  hintBarText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#0369a1',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  sectionBlock: {},
  sectionBlockSpaced: {
    marginTop: 20,
  },
  sectionHeading: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  orderScheduled: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
    fontFamily: 'Inter_600SemiBold',
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
