import {useState} from 'react';
import {addDays,addMonths,eachDayOfInterval,endOfMonth,endOfWeek,format,isSameMonth,startOfMonth,startOfWeek} from 'date-fns';
import {CalendarDays,ChevronLeft,ChevronRight,ArrowUpRight} from 'lucide-react';
import {Link} from '@tanstack/react-router';
import {Button} from '@/components/ui/button';
import {roomsFor,type ResortData} from './accounting';
import type {Editor} from './forms';

export function MonthCalendar({data,edit,compact=false}:{data:ResortData;edit:(e:Editor)=>void;compact?:boolean}) {
 const today=format(new Date(),'yyyy-MM-dd');
 const [anchor,setAnchor]=useState(new Date());
 const [selected,setSelected]=useState(today);
 const [view,setView]=useState<'Month'|'Week'|'Day'>('Month');
 const day=new Date(selected+'T00:00:00');
 const start=view==='Month'?startOfWeek(startOfMonth(anchor)):view==='Week'?startOfWeek(anchor):anchor;
 const end=view==='Month'?endOfWeek(endOfMonth(anchor)):view==='Week'?addDays(start,6):anchor;
 const days=eachDayOfInterval({start,end});
 const active=data.reservations.filter(r=>r.status!=='Cancelled');
 const arrivals=active.filter(r=>r.check_in_date===selected);
 const departures=active.filter(r=>r.check_out_date===selected);
 const stays=active.filter(r=>r.check_in_date<=selected&&r.check_out_date>selected);
 const events=active.filter(r=>r.check_in_date===selected||r.check_out_date===selected||(r.check_in_date<selected&&r.check_out_date>selected));
 function move(n:number){const next=view==='Month'?addMonths(anchor,n):addDays(anchor,n*(view==='Week'?7:1));setAnchor(next);setSelected(format(next,'yyyy-MM-dd'));}
 return <section className={`month-calendar ${compact?'compact-calendar':''}`} aria-label="Booking calendar">
  <div className="month-calendar-heading"><h2><CalendarDays size={17}/>Booking Calendar</h2><div className="month-navigation"><Button variant="ghost" size="icon" aria-label="Previous calendar period" title="Previous period" onClick={()=>move(-1)}><ChevronLeft/></Button><strong>{format(anchor,'MMMM yyyy')}</strong><Button variant="ghost" size="icon" aria-label="Next calendar period" title="Next period" onClick={()=>move(1)}><ChevronRight/></Button></div><div className="segmented-control">{(['Month','Week','Day'] as const).map(mode=><Button key={mode} variant={view===mode?'default':'ghost'} aria-pressed={view===mode} onClick={()=>setView(mode)}>{mode}</Button>)}</div></div>
  {!compact&&<div className="month-tools"><Button variant="outline" size="sm" onClick={()=>{setAnchor(new Date());setSelected(today);}}>Today</Button><input className="filter-input" aria-label="Calendar date" type="date" value={selected} onChange={e=>{if(e.target.value){setSelected(e.target.value);setAnchor(new Date(e.target.value+'T00:00:00'));}}}/><div className="event-legend"><span className="arrival-dot">Check-in</span><span className="departure-dot">Check-out</span><span className="stay-dot">Reservation</span></div></div>}
  <div className="month-calendar-body"><div className={`month-grid ${view==='Day'?'single-day-grid':''}`} role="grid" aria-label={`${view} bookings`}>
   {view!=='Day'&&['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(name=><div className="month-weekday" role="columnheader" key={name}>{name}</div>)}
   {days.map(date=>{const key=format(date,'yyyy-MM-dd');const checkins=active.filter(r=>r.check_in_date===key);const checkouts=active.filter(r=>r.check_out_date===key);const booked=active.filter(r=>r.check_in_date<key&&r.check_out_date>key);return <div role="gridcell" key={key} className={`month-day ${!isSameMonth(date,anchor)?'outside-month':''} ${key===selected?'selected-day':''}`}><Button variant="ghost" className={`day-number ${key===today?'today-number':''}`} aria-label={`View ${format(date,'dd MMM yyyy')}`} aria-pressed={key===selected} onClick={()=>setSelected(key)}>{format(date,'d')}</Button><div className="day-dots">{checkins.length>0&&<i className="arrival-dot"/>}{checkouts.length>0&&<i className="departure-dot"/>}{booked.length>0&&<i className="stay-dot"/>}</div>{!compact&&[...checkins,...booked].slice(0,view==='Month'?2:5).map(r=><Button variant="ghost" key={r.id} className={`day-event ${r.check_in_date===key?'event-arrival':'event-stay'}`} title={`${r.guest_name} · Room ${roomsFor(data,r.id)}`} onClick={()=>edit({kind:'reservation',row:r})}>{r.guest_name}<small>{roomsFor(data,r.id)}</small></Button>)}{!compact&&checkins.length+booked.length>2&&view==='Month'&&<Button variant="link" className="more-events" onClick={()=>{setSelected(key);setAnchor(date);setView('Day');}}>+{checkins.length+booked.length-2} more</Button>}</div>;})}
  </div><aside className="calendar-agenda"><h3>{selected===today?'Today':'Selected day'} – {format(day,'MMM d')}</h3><div className="agenda-count arrival-dot"><span>Check-in</span><strong>{arrivals.length} bookings</strong></div><div className="agenda-count departure-dot"><span>Check-out</span><strong>{departures.length} bookings</strong></div><div className="agenda-count stay-dot"><span>Reservations</span><strong>{stays.length} bookings</strong></div>{!compact&&<div className="agenda-bookings">{events.length?events.map(r=><Button key={r.id} variant="ghost" onClick={()=>edit({kind:'reservation',row:r})}><strong>{r.guest_name}</strong><span>Room {roomsFor(data,r.id)}</span><small>{r.check_in_date===selected?'Check-in':r.check_out_date===selected?'Check-out':r.status}</small></Button>):<p>No bookings for this date.</p>}</div>}<Button asChild size="sm"><Link to="/reservations">View all bookings<ArrowUpRight/></Link></Button></aside></div>
 </section>;
}