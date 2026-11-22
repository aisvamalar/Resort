import {createFileRoute} from '@tanstack/react-router';
import {ProtectedPage,resortQuery} from '@/features/resort/app';
import {pageHead} from '@/features/resort/head';
export const Route=createFileRoute('/_authenticated/payments')({head:()=>pageHead('Payment History','Manage your resort payment history securely in My Resort.'),loader:({context})=>context.queryClient.ensureQueryData(resortQuery),component:Page});
function Page(){return <ProtectedPage page="payments"/>;}
