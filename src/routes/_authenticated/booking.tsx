import {createFileRoute} from '@tanstack/react-router';
import {ProtectedPage,resortQuery} from '@/features/resort/app';
import {pageHead} from '@/features/resort/head';
export const Route=createFileRoute('/_authenticated/booking')({head:()=>pageHead('Add Booking','Manage Add Booking in your private Green Valley Resort workspace.'),loader:({context})=>context.queryClient.ensureQueryData(resortQuery),component:Page});
function Page(){return <ProtectedPage page="booking"/>;}
