import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getEntitlements } from '../services/api';
import { useAuth } from './AuthContext';
import type { PlanId } from '../types';

export interface PlanAccessContextValue {
  planId: PlanId;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_VALUE: PlanAccessContextValue = {
  planId: 'free',
  isLoading: false,
  error: null,
  refresh: async () => {},
};

export const PlanAccessContext = createContext<PlanAccessContextValue>(DEFAULT_VALUE);

export function PlanAccessProvider({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth();
  const [planId, setPlanId] = useState<PlanId>('free');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authState.isAuthenticated) {
      setPlanId('free');
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const entitlements = await getEntitlements();
      setPlanId(entitlements.planId === 'pro' ? 'pro' : 'free');
      setError(null);
    } catch {
      // Fail closed: unknown entitlement must never unlock Pro-only data.
      setPlanId('free');
      setError('套餐信息加载失败，暂按 Free 权益使用');
    } finally {
      setIsLoading(false);
    }
  }, [authState.isAuthenticated, authState.user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PlanAccessContext.Provider value={{ planId, isLoading, error, refresh }}>
      {children}
    </PlanAccessContext.Provider>
  );
}

export function usePlanAccess(): PlanAccessContextValue {
  return useContext(PlanAccessContext);
}
