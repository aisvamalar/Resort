import {createFileRoute} from '@tanstack/react-router';
import {ProtectedPage,resortQuery} from '@/features/resort/app';
import {pageHead} from '@/features/resort/head';
export const Route=createFileRoute('/_authenticated/notepad')({head:()=>pageHead('Daily Expense Notepad','Manage Daily Expense Notepad in your private Green Valley Resort workspace.'),loader:({context})=>context.queryClient.ensureQueryData(resortQuery),component:Page});
function Page(){return <ProtectedPage page="notepad"/>;}
