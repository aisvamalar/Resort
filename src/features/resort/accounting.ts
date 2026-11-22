import type {ExpenseNote} from './notepad-rules';
import type { Database } from '@/integrations/supabase/types';
type Tables = Database['public']['Tables'];
export type Reservation = Tables['reservations']['Row'];
export type Payment = Tables['payments']['Row'];
export type Expense = Tables['expenses']['Row'];
export type Closing = Tables['cash_closings']['Row'];
export type Room = Tables['rooms']['Row'];
export type Resort = Tables['resorts']['Row'];
export type Profile = Tables['profiles']['Row'];
export type RoomLink = Tables['reservation_rooms']['Row'];
export interface ResortData { expenseNotes?:ExpenseNote[]; logoUrl?:string; resort: Resort | null; profile: Profile | null; reservations: Reservation[]; payments: Payment[]; expenses: Expense[]; closings: Closing[]; rooms: Room[]; roomLinks: RoomLink[] }
export const emptyData: ResortData = { resort:null,profile:null,reservations:[],payments:[],expenses:[],closings:[],rooms:[],roomLinks:[] };
export const sum = <T,>(rows:T[],value:(r:T)=>number) => rows.reduce((total,row)=>total+Number(value(row)),0);
export const pending = (r:Reservation,p:Payment[]) => Math.max(0,Number(r.room_rent)-sum(p.filter(x=>x.reservation_id===r.id),x=>x.amount));
export const advanceSuggestion = (rent:number) => rent * .5;
export function cashSummary(payments:Payment[],expenses:Expense[],opening=0,actual=0) { const received=sum(payments.filter(p=>p.payment_method==='Cash'),p=>p.amount);const spent=sum(expenses.filter(e=>e.payment_method==='Cash'),e=>e.amount);const expected=opening+received-spent;return {received,spent,expected,variance:actual-expected}; }
export function summary(data:ResortData,allPayments:Payment[]=data.payments) { const active=data.reservations.filter(r=>r.status!=='Cancelled');return {sales:sum(active,r=>r.room_rent),collected:sum(data.payments,p=>p.amount),pending:sum(active,r=>pending(r,allPayments)),expenses:sum(data.expenses,e=>e.amount),cash:expectedCash(data),reservations:active.length,current:active.filter(r=>r.status==='Checked In').length}; }
export const money = (n:number,currency='INR') => new Intl.NumberFormat('en-IN',{style:'currency',currency,minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
export const sources = ['OTA','Website','Walk-in'];
export const methods = ['Cash','UPI','Bank'];
export const statuses = ['Reserved','Checked In','Checked Out','Cancelled'];
export const categories = ['Grocery','Milk & Dairy','Electricity','Maintenance','Staff Requirements','Other'];
export function roomsFor(data:ResortData,rid:string) {return data.roomLinks.filter(l=>l.reservation_id===rid).map(l=>data.rooms.find(r=>r.id===l.room_id)?.room_number ?? '').join(', ');}

export function expectedCash(data:ResortData) {const latest=[...data.closings].sort((a,b)=>b.closing_date.localeCompare(a.closing_date))[0];if(!latest)return cashSummary(data.payments,data.expenses).expected;const since=(date:string)=>date>=latest.closing_date;return cashSummary(data.payments.filter(p=>since(p.payment_date)),data.expenses.filter(e=>since(e.expense_date)),latest.opening_cash).expected;}

export function ownerSales(reservations:Reservation[]) {const active=reservations.filter(r=>r.status!=='Cancelled');const ota=sum(active.filter(r=>r.booking_source==='OTA'),r=>r.room_rent);const website=sum(active.filter(r=>r.booking_source==='Website'),r=>r.room_rent);const walkIn=sum(active.filter(r=>r.booking_source==='Walk-in'),r=>r.room_rent);return {ota,website,walkIn,total:ota+website+walkIn};}
export function roomStatus(data:ResortData,roomId:string,day:string):'available'|'reserved'|'occupied' {const bookings=data.reservations.filter(r=>r.status!=='Cancelled'&&r.status!=='Checked Out'&&r.check_in_date<=day&&r.check_out_date>day&&data.roomLinks.some(l=>l.room_id===roomId&&l.reservation_id===r.id));if(bookings.some(r=>r.status==='Checked In'))return 'occupied';return bookings.length?'reserved':'available';}

export interface RoomConflict { reservation:Reservation; roomNumber:string }
/** Active bookings that share a room and overlapping nights (check-out day is free). */
export function roomConflicts(data:ResortData,roomIds:string[],checkIn:string,checkOut:string,excludeId?:string):RoomConflict[] {if(!checkIn||!checkOut||checkOut<=checkIn)return [];const out:RoomConflict[]=[];for(const roomId of new Set(roomIds.filter(Boolean))){for(const r of data.reservations){if(r.id===excludeId||r.status==='Cancelled'||r.status==='Checked Out')continue;if(!(r.check_in_date<checkOut&&r.check_out_date>checkIn))continue;if(!data.roomLinks.some(l=>l.room_id===roomId&&l.reservation_id===r.id))continue;out.push({reservation:r,roomNumber:data.rooms.find(x=>x.id===roomId)?.room_number??''});}}return out;}
