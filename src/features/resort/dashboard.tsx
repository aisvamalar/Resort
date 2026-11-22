import {useState} from 'react';
import {BedDouble,LogIn,LogOut,Wallet,Banknote,ArrowUpRight,Download,LoaderCircle} from 'lucide-react';
import {toast} from 'sonner';
import {downloadWorkbook} from './export';
import {Link} from '@tanstack/react-router';
import {format} from 'date-fns';
import {Button} from '@/components/ui/button';
import banner from '@/assets/resort-banner.asset.json';
import {money,roomStatus,sum,type ResortData} from './accounting';
import type {Editor} from './forms';
import {DashboardPanels} from './dashboard-panels';
export function Dashboard({data,edit,signedIn}:{data:ResortData;edit:(e:Editor)=>void;signedIn:boolean}) {
 const [exporting,setExporting]=useState(false);
 async function exportExcel(){setExporting(true);try{await downloadWorkbook(data,'Complete Report','','');toast.success('Excel report downloaded');}catch(error){toast.error(error instanceof Error&&error.message.startsWith('Excel check failed:')?error.message:'Unable to export Excel. Please try again.');}finally{setExporting(false);}}
 const today=format(new Date(),'yyyy-MM-dd');const active=data.reservations.filter(r=>r.status!=='Cancelled');const name=data.profile?.full_name?.split(' ')[0]||'Admin';
 const metrics=[{label:'Total Rooms',value:data.rooms.filter(r=>r.is_active).length,icon:BedDouble},{label:'Occupied Rooms',value:data.rooms.filter(r=>r.is_active&&roomStatus(data,r.id,today)==='occupied').length,icon:BedDouble},{label:"Today's Check-ins",value:active.filter(r=>r.check_in_date===today).length,icon:LogIn},{label:"Today's Check-outs",value:active.filter(r=>r.check_out_date===today).length,icon:LogOut},{label:"Today's Revenue",value:money(sum(active.filter(r=>r.booking_date===today),r=>r.room_rent)),icon:Wallet},{label:'Cash Received',value:money(sum(data.payments.filter(p=>p.payment_date===today&&p.payment_method==='Cash'),p=>p.amount)),icon:Banknote}];
 return <div className="reference-dashboard"><header className="dashboard-welcome"><img src={banner.url} alt="Green Valley resort villas and palm trees"/><div className="dashboard-welcome-content"><h1>Good Morning, {name}! <span aria-hidden="true">👋</span></h1><p>Here's what's happening at your resort today.</p></div><Button className="shrink-0" disabled={!signedIn||exporting} onClick={exportExcel}>{exporting?<LoaderCircle className="animate-spin"/>:<Download/>}{exporting?'Exporting…':'Export Excel'}</Button></header>{!signedIn&&<div className="signed-out-notice"><span>Sign in to see your private bookings and business reports.</span><Button asChild size="sm"><Link to="/auth">Sign in<ArrowUpRight/></Link></Button></div>}<div className="reference-metrics">{metrics.map(m=><div className="reference-metric" key={m.label}><span className="reference-metric-icon"><m.icon size={23}/></span><div><span>{m.label}</span><strong>{m.value}</strong><small>Today</small></div></div>)}</div><DashboardPanels data={data} edit={edit}/></div>;
}
