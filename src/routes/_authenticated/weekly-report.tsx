import {createFileRoute} from '@tanstack/react-router';
import {ProtectedPage,resortQuery} from '@/features/resort/app';
import {pageHead} from '@/features/resort/head';
export const Route=createFileRoute('/_authenticated/weekly-report')({head:()=>pageHead('Weekly Report','Your weekly sales, receipts, expenses and cash report for Green Valley Resort.'),loader:({context})=>context.queryClient.ensureQueryData(resortQuery),component:Page});
function Page(){return <ProtectedPage page="weekly-report"/>;}
