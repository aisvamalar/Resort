import {createFileRoute} from '@tanstack/react-router';
import {ProtectedPage,resortQuery} from '@/features/resort/app';
import {pageHead} from '@/features/resort/head';
export const Route=createFileRoute('/_authenticated/expense-categories')({head:()=>pageHead('Expense Categories','Manage Expense Categories in your private Green Valley Resort workspace.'),loader:({context})=>context.queryClient.ensureQueryData(resortQuery),component:Page});
function Page(){return <ProtectedPage page="expense-categories"/>;}
