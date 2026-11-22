import {createFileRoute} from '@tanstack/react-router';
import {Home} from '@/features/resort/app';
import {pageHead} from '@/features/resort/head';
export const Route=createFileRoute('/')({head:()=>pageHead('Dashboard','Green Valley Resort room occupancy, booking calendar, sales, expenses and physical cash in your private owner workspace.'),component:Home});
