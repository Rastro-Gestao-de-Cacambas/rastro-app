import { useAuth } from '@/hooks/useAuth';
import { workOrdersApi } from '@/lib/api';
import { WorkOrder } from '@/shared';
import { colors } from '@/theme';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatCpf } from '@/utils/cpf';
import { getStatusColor, getStatusLabel, getTypeLabel } from '@/utils/work-order-labels';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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

function boxesSummary(order: WorkOrder): string {
  const boxes = order.workOrderDumpsters ?? [];
  if (boxes.length === 0) return '—';
  if (boxes.length === 1) return boxes[0].dumpster?.code ?? 'A definir';
  const assignedCount = boxes.filter((b) => b.dumpster?.code).length;
  return assignedCount < boxes.length
    ? `${boxes.length} caçambas (${assignedCount} definida${assignedCount === 1 ? '' : 's'})`
    : `${boxes.length} caçambas`;
}

function renderOrderCard(order: WorkOrder, router: ReturnType<typeof useRouter>) {
  const boxLabel = (order.workOrderDumpsters?.length ?? 0) > 1 ? 'Num. das caixas' : 'Num. da caixa';
  return (
    <TouchableOpacity
      key={order.id}
      style={styles.orderCard}
      onPress={() => router.push(`/work-order-detail?id=${order.id}`)}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderType}>{getTypeLabel(order.type)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {getStatusLabel(order.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.orderInfo}>
        {boxLabel} - {boxesSummary(order)}
      </Text>
      {order.jobSite?.customer && (
        <Text style={styles.orderCustomer}>{order.jobSite.customer.name}</Text>
      )}
      {order.jobSite && (
        <Text style={styles.orderAddress}>
          {order.jobSite.name || 'Endereço'} - {order.jobSite.address}
        </Text>
      )}
      {order.yard && <Text style={styles.orderAddress}>{order.yard.name}</Text>}
      {order.observations?.trim() && (
        <Text style={styles.orderNote}>Observação: {order.observations}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const loadWorkOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await workOrdersApi.getMyOrders();
      const sorted = res.data.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
      setWorkOrders(sorted);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível carregar as tarefas. Verifique sua conexão.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const silent = hasLoaded.current;
      hasLoaded.current = true;
      loadWorkOrders(silent);

      const interval = setInterval(() => loadWorkOrders(true), 20000);
      return () => clearInterval(interval);
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

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeOrders = workOrders.filter(
    (wo) => wo.status === 'PENDING' || wo.status === 'IN_PROGRESS',
  );
  const completedOrders = workOrders.filter(
    (wo) => wo.status === 'DONE' || wo.status === 'DELIVERED',
  );

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => loadWorkOrders(false)}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {!error && workOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma tarefa no momento</Text>
          </View>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>Em aberto</Text>
                {activeOrders.map((o) => renderOrderCard(o, router))}
              </View>
            )}
            {completedOrders.length > 0 && (
              <View style={[styles.sectionBlock, activeOrders.length > 0 && styles.sectionBlockSpaced]}>
                <Text style={styles.sectionHeading}>Concluídas</Text>
                {completedOrders.map((o) => renderOrderCard(o, router))}
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
    backgroundColor: colors.appBg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.primary,
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
    color: colors.surface,
  },
  logoutButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  logoutText: {
    color: colors.surface,
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
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderHint,
  },
  hintBarText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primaryDark,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
    marginBottom: 8,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.danger,
  },
  sectionBlock: {},
  sectionBlockSpaced: {
    marginTop: 20,
  },
  sectionHeading: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSlate,
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
    color: colors.textMuted,
  },
  orderCard: {
    backgroundColor: colors.surface,
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
    color: colors.appText,
  },
  orderInfo: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  orderCustomer: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: colors.appText,
    marginBottom: 2,
  },
  orderAddress: {
    fontSize: 12,
    color: colors.textSubtle,
    marginBottom: 4,
  },
  orderNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
