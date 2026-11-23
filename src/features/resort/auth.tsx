import {createContext,useContext,type ReactNode} from 'react';
import type {User} from '@supabase/supabase-js';
const AuthContext=createContext<{user:User|null;loading:boolean}>({user:null,loading:false});
export const useOwner=()=>useContext(AuthContext);
export function OwnerProvider({children}:{children:ReactNode}) {
  // Authentication disabled - always return a mock user
  const mockUser = {
    id: 'local-user',
    email: 'owner@resort.local',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: { full_name: 'Resort Owner' },
    aud: 'authenticated',
    role: 'authenticated'
  } as User;
  
  return <AuthContext value={{user:mockUser,loading:false}}>{children}</AuthContext>;
}
export function AuthPage({recovery=false}:{recovery?:boolean}) {
  // Redirect to home since auth is disabled
  window.location.href = '/';
  return null;
}
