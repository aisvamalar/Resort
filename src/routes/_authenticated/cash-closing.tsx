import {createFileRoute} from '@tanstack/react-router';
import {ProtectedPage,resortQuery} from '@/features/resort/app';
import {pageHead} from '@/features/resort/head';
export const Route=createFileRoute('/_authenticated/cash-closing')({head:()=>pageHead('Daily Cash Closing','Manage your resort daily cash closing securely in My Resort.'),loader:({context})=>context.queryClient.ensureQueryData(resortQuery),component:Page});
function Page(){return <ProtectedPage page="cash-closing"/>;}
