import {createFileRoute} from '@tanstack/react-router';
import {AuthPage} from '@/features/resort/auth';
import {pageHead} from '@/features/resort/head';
export const Route=createFileRoute('/reset-password')({head:()=>pageHead('Reset password','Secure owner access to My Resort.'),component:Page});
function Page(){return <AuthPage recovery={true}/>;}
