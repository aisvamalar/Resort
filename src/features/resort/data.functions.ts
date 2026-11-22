import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const getResortData = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context})=>{
 const db=context.supabase;
 async function all<T>(fetchPage:(start:number,end:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>) {const result:T[]=[];for(let start=0;;start+=1000){const {data,error}=await fetchPage(start,start+999);if(error)throw new Error(error.message);result.push(...(data??[]));if(!data||data.length<1000)break;}return result;}
 const [resort,profile,reservations,payments,expenses,closings,rooms,roomLinks,expenseNotes]=await Promise.all([
 db.from('resorts').select('*').eq('owner_id',context.userId).maybeSingle(),db.from('profiles').select('*').eq('id',context.userId).maybeSingle(),
 all((s,e)=>db.from('reservations').select('*').order('booking_date',{ascending:false}).order('id').range(s,e)),
 all((s,e)=>db.from('payments').select('*').order('payment_date',{ascending:false}).order('id').range(s,e)),
 all((s,e)=>db.from('expenses').select('*').order('expense_date',{ascending:false}).order('id').range(s,e)),
 all((s,e)=>db.from('cash_closings').select('*').order('closing_date',{ascending:false}).order('id').range(s,e)),
 all((s,e)=>db.from('rooms').select('*').order('room_number').order('id').range(s,e)),all((s,e)=>db.from('reservation_rooms').select('*').order('id').range(s,e)),all((s,e)=>db.from('daily_expense_notes').select('*').order('note_date',{ascending:false}).order('id').range(s,e))]);
 if(resort.error)throw new Error(resort.error.message);if(profile.error)throw new Error(profile.error.message);
 let logoUrl=resort.data?.logo_url??'';
 if(logoUrl&&!logoUrl.startsWith('https://')){const signed=await db.storage.from('resort-logos').createSignedUrl(logoUrl,3600);logoUrl=signed.data?.signedUrl??'';}
 return {logoUrl,resort:resort.data,profile:profile.data,reservations,payments,expenses,closings,rooms,roomLinks,expenseNotes};
});
