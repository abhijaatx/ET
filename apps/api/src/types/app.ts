import type { Session } from "lucia";
import type { AuthUser } from "../auth";

export type AppEnv = {
  Variables: {
    user: AuthUser | null;
    session: Session | null;
  };
};
