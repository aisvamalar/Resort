import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Moon,Sun} from 'lucide-react';
import {Button} from '@/components/ui/button';

type Theme='light'|'dark';
const storageKey='green-valley-theme';
const ThemeContext=createContext<{theme:Theme;toggle:()=>void}>({theme:'light',toggle:()=>{}});

export function ThemeProvider({children}:{children:ReactNode}) {
 const [theme,setTheme]=useState<Theme>('light');
 useEffect(()=>{
  function restore(){
   let next:Theme='light';
   try{if(localStorage.getItem(storageKey)==='dark')next='dark';}catch{/* Use the light default when storage is unavailable. */}
   document.documentElement.classList.toggle('dark',next==='dark');
   setTheme(next);
  }
  restore();
  const sync=(event:StorageEvent)=>{if(event.key===storageKey)restore();};
  window.addEventListener('storage',sync);
  return ()=>window.removeEventListener('storage',sync);
 },[]);
 function toggle(){
  const next=theme==='light'?'dark':'light';
  document.documentElement.classList.toggle('dark',next==='dark');
  setTheme(next);
  try{localStorage.setItem(storageKey,next);}catch{/* Theme switching still works without storage. */}
 }
 return <ThemeContext.Provider value={{theme,toggle}}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle(){
 const {theme,toggle}=useContext(ThemeContext);
 const label=theme==='light'?'Switch to dark theme':'Switch to light theme';
 return <Button variant="ghost" size="icon" className="theme-toggle shrink-0" aria-label={label} title={label} aria-pressed={theme==='dark'} onClick={toggle}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</Button>;
}