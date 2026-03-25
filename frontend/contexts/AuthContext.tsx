import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { getMe, AuthUser, logoutHard } from "../utils/auth";

interface AuthContextValue {
  me: AuthUser | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  logoutAndRedirect: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  me: null,
  loading: true,
  refreshMe: async () => {},
  logoutAndRedirect: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const user = await getMe();
    setMe(user);
  }, []);

  /**
   * Centralized logout used by all layouts/pages.
   * - Clears AuthContext immediately (so protected UI stops rendering)
   * - Then hard redirects to /login (stops in-flight effects + fetches)
   */
  const logoutAndRedirect = useCallback(async () => {
    // Immediately clear client auth state
    setMe(null);

    // Best-effort cookie clear + hard redirect
    await logoutHard();
  }, []);

  useEffect(() => {
    getMe()
      .then((user) => {
        setMe(user);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, refreshMe, logoutAndRedirect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
