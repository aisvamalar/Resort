import {Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {MonthCalendar} from './month-calendar';
import type {ResortData} from './accounting';
import type {Editor} from './forms';
export function BookingCalendar({data,edit}:{data:ResortData;edit:(e:Editor)=>void}) {
 return <section className="booking-calendar"><div className="page-heading"><div><h1>Booking calendar</h1><p>{data.rooms.filter(r=>r.is_active).length} rooms · {data.reservations.filter(r=>r.status!=='Cancelled').length} bookings</p></div><Button onClick={()=>edit({kind:'reservation'})}><Plus/>New reservation</Button></div><MonthCalendar data={data} edit={edit}/></section>;
}
