import { dumpstersApi } from '@/lib/api';
import { invokePickerCallback } from '@/lib/dumpster-picker-callback';
import { Dumpster } from '@/shared';
import { colors } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PickerMode = 'OUT' | 'IN' | 'DUMP';

const HEADER_TITLE: Record<PickerMode, string> = {
  OUT: 'Selecionar Caçamba',
  IN: 'Selecionar Caçamba a Retirar',
  DUMP: 'Selecionar Caçamba p/ Descarte',
};

const EMPTY_TITLE: Record<PickerMode, string> = {
  OUT: 'Nenhuma caçamba disponível',
  IN: 'Nenhuma caçamba locada neste endereço',
  DUMP: 'Nenhuma caçamba para descarte',
};

export default function DumpsterPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; jobSiteId?: string; excludeIds?: string }>();
  const mode: PickerMode = params.mode === 'IN' || params.mode === 'DUMP' ? params.mode : 'OUT';
  const jobSiteId = params.jobSiteId;
  const excludeIds = useMemo(
    () => new Set((params.excludeIds ?? '').split(',').filter(Boolean)),
    [params.excludeIds],
  );
  const inputRef = useRef<TextInput>(null);

  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res =
          mode === 'IN'
            ? await dumpstersApi.getEligibleForPickup({ jobSiteId })
            : mode === 'DUMP'
              ? await dumpstersApi.getEligibleForDump()
              : await dumpstersApi.getAvailable();
        if (!cancelled) setDumpsters(res.data.data ?? []);
      } catch {
        if (!cancelled) setDumpsters([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, jobSiteId]);

  // Focus the input after a short delay so the keyboard opens naturally
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const withoutUsed = dumpsters.filter((d) => !excludeIds.has(d.id));
    if (!q) return withoutUsed;
    return withoutUsed.filter((d) => d.code.toUpperCase().includes(q));
  }, [dumpsters, query, excludeIds]);

  const handleSelect = (dumpster: Dumpster) => {
    invokePickerCallback(dumpster.id, dumpster.code);
    router.back();
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{HEADER_TITLE[mode]}</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Buscar pelo código..."
          placeholderTextColor={colors.textSubtle}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
        />
        {query.length > 0 && Platform.OS === 'android' && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.textSubtle} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando caçambas…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="search-outline" size={48} color={colors.borderLight} />
          <Text style={styles.emptyTitle}>
            {query.trim() ? 'Nenhuma caçamba encontrada' : EMPTY_TITLE[mode]}
          </Text>
          {query.trim() ? (
            <Text style={styles.emptySubtitle}>
              Tente outro código ou limpe a busca.
            </Text>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <View style={styles.itemLeft}>
                <Text style={styles.itemCode}>{item.code}</Text>
                <Text style={styles.itemCapacity}>
                  {item.capacityValue} {item.capacityUnit}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.borderLight} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Counter */}
      {!loading && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {filtered.length}{' '}
            {filtered.length === 1 ? 'caçamba na lista' : 'caçambas na lista'}
            {query.trim() ? ` para "${query.trim()}"` : ''}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLighter,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.appText,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLighter,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.appText,
    fontFamily: 'Inter_400Regular',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemLeft: {
    gap: 2,
  },
  itemCode: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.appText,
  },
  itemCapacity: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  separator: {
    height: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLighter,
    backgroundColor: colors.surface,
  },
  footerText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
