import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_AVATAR, type Avatar } from "../../shared/types.ts";
import { api } from "./api.ts";

interface AvatarState {
  avatar: Avatar;
  loaded: boolean;
  save: (a: Avatar) => Promise<void>;
}

const AvatarCtx = createContext<AvatarState>({ avatar: DEFAULT_AVATAR, loaded: false, save: async () => {} });

export function AvatarProvider({ children }: { children: ReactNode }) {
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api
      .avatar()
      .then(setAvatar)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  const save = useCallback(async (a: Avatar) => {
    setAvatar(await api.saveAvatar(a));
  }, []);
  return <AvatarCtx.Provider value={{ avatar, loaded, save }}>{children}</AvatarCtx.Provider>;
}

export const useAvatar = () => useContext(AvatarCtx);
