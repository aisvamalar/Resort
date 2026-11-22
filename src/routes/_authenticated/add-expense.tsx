import {createFileRoute} from '@tanstack/react-router';
import {ProtectedPage,resortQuery} from '@/features/resort/app';
import {pageHead} from '@/features/resort/head';
export const Route=createFileRoute('/_authenticated/add-expense')({head:()=>pageHead('Add Expense','Manage Add Expense in your private Green Valley Resort workspace.'),loader:({context})=>context.queryClient.ensureQueryData(resortQuery),component:Page});
function Page(){return <ProtectedPage page="add-expense"/>;}
