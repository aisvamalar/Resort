import type {Workbook,CellValue} from 'exceljs';
import {format,parseISO} from 'date-fns';
import {roomsFor,sum,pending,type ResortData} from './accounting';
import {checkExportDates} from './export-check';

const palette={green:'064E35',white:'FFFFFF',ink:'202A25',line:'B8C2BC'};
const currency='"₹" #,##0.00;("₹" #,##0.00);"–"';
const dateValue=(value:string)=>value?parseISO(value):null;
const formula=(text:string,result:number):CellValue=>({formula:text,result});
const amount=(value:number)=>`₹${Number(value).toLocaleString('en-IN',{maximumFractionDigits:2})}`;

/** Plain owner register: sales and actual cash are separate entries in one table. */
export async function buildWorkbook(data:ResortData,kind:string,from:string,to:string):Promise<Workbook> {
 if(from&&to&&to<from)throw new Error('End date must be on or after start date');
 const supported=['Complete Report','Room Bookings','OTA Sales','Website Sales','Walk-in Sales','Payment History','Expenses','Daily Cash Closing','Expense Notepad','Owner Excel Report','Booking Details','Cash Expenses','Dashboard Summary'];
 if(!supported.includes(kind))throw new Error('Unknown report type');
 checkExportDates(data,kind,from,to);
 const ExcelJS=await import('exceljs');
 const wb=new ExcelJS.Workbook();
 const resort=data.resort?.resort_name||'Green Valley Resort';
 wb.creator=resort;wb.created=new Date();wb.calcProperties.fullCalcOnLoad=true;
 const ws=wb.addWorksheet('Owner Report',{properties:{defaultRowHeight:30},views:[{state:'frozen',ySplit:4,showGridLines:false}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:4',margins:{left:.25,right:.25,top:.4,bottom:.4,header:.15,footer:.15}}});
 ws.columns=[18,14,28,19,19,19,50,21,21].map(width=>({width}));
 ws.mergeCells('A1:I1');ws.getCell('A1').value=`${resort} — Excel Report`;
 ws.getCell('A1').font={name:'Arial',size:16,bold:true,color:{argb:palette.ink}};
 ws.getCell('A1').alignment={horizontal:'center',vertical:'middle'};ws.getRow(1).height=36;
 ws.mergeCells('A2:I2');ws.getCell('A2').value=from||to?`${from?format(parseISO(from),'dd MMM yyyy'):'Beginning'} – ${to?format(parseISO(to),'dd MMM yyyy'):'Latest record'} | ${kind} | INR (₹)`:`All recorded dates | ${kind} | INR (₹)`;
 ws.getCell('A2').font={name:'Arial',size:10,color:{argb:palette.ink}};
 ws.getCell('A2').alignment={horizontal:'center',vertical:'middle'};ws.getRow(2).height=24;
 ws.getRow(3).height=24;ws.getRow(4).height=24;
 ['Date','Room','Name','OTA','Website','Walk-in','Reservation'].forEach((title,i)=>{ws.mergeCells(3,i+1,4,i+1);ws.getCell(3,i+1).value=title;});
 ws.mergeCells('H3:I3');ws.getCell('H3').value='Cash';ws.getCell('H4').value='Credit';ws.getCell('I4').value='Debit';
 for(let row=3;row<=4;row++)for(let col=1;col<=9;col++){
  const cell=ws.getCell(row,col);cell.font={name:'Arial',size:11,bold:true,color:{argb:palette.white}};
  cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:palette.green}};
  cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
  cell.border={top:{style:'thin',color:{argb:palette.line}},bottom:{style:'thin',color:{argb:palette.line}},left:{style:'thin',color:{argb:palette.line}},right:{style:'thin',color:{argb:palette.line}}};
 }
 const inside=(date:string)=>(!from||date>=from)&&(!to||date<=to);
 const source=kind==='OTA Sales'?'OTA':kind==='Website Sales'?'Website':kind==='Walk-in Sales'?'Walk-in':null;
 const sourceBookings=data.reservations.filter(r=>!source||(r.booking_source===source&&r.status!=='Cancelled'));
 const bookings=sourceBookings.filter(r=>inside(r.booking_date));
 const payments=data.payments.filter(p=>inside(p.payment_date)&&(!source||sourceBookings.some(r=>r.id===p.reservation_id)));
 const expenses=data.expenses.filter(e=>inside(e.expense_date)&&(kind!=='Cash Expenses'||e.payment_method==='Cash'));
 const complete=kind==='Complete Report'||kind==='Dashboard Summary';
 const entries:{date:string;order:number;values:CellValue[]}[]=[];
 function entry(date:string,order:number,room:string,description:string,sales:[number,number,number]=[0,0,0],credit=0,debit=0,name=''){entries.push({date,order,values:[dateValue(date),room,name,...sales,description,credit,debit]});}
 if(complete||source||['Room Bookings','Owner Excel Report','Booking Details'].includes(kind))bookings.forEach(r=>{
  const sales=r.status==='Cancelled'?0:Number(r.room_rent);
  const collected=sum(data.payments.filter(p=>p.reservation_id===r.id),p=>p.amount);
  const balance=r.status==='Cancelled'?0:pending(r,data.payments);
  entry(r.booking_date,0,roomsFor(data,r.id),`${r.guest_name} · ${r.status}\nReceived ${amount(collected)} · Balance ${amount(balance)}`,[r.booking_source==='OTA'?sales:0,r.booking_source==='Website'?sales:0,r.booking_source==='Walk-in'?sales:0],0,0,r.guest_name);
 });
 if(complete||source||kind==='Payment History')payments.forEach(p=>{
  const r=data.reservations.find(r=>r.id===p.reservation_id);
  entry(p.payment_date,1,roomsFor(data,p.reservation_id),`${r?.guest_name||'Unknown booking'} · ${p.payment_type} · ${p.payment_method} received ${amount(p.amount)}${p.notes?`\n${p.notes}`:''}`,[0,0,0],p.payment_method==='Cash'?Number(p.amount):0,0,r?.guest_name||'Unknown booking');
 });
 if(complete||['Expenses','Cash Expenses'].includes(kind))expenses.forEach(e=>entry(e.expense_date,2,'',`${e.expense_name} · ${e.category}\n${e.payment_method} paid ${amount(e.amount)}${e.notes?` · ${e.notes}`:''}`,[0,0,0],0,e.payment_method==='Cash'?Number(e.amount):0,e.expense_name));
 if(kind==='Expense Notepad')(data.expenseNotes??[]).filter(n=>inside(n.note_date)).forEach(n=>entry(n.note_date,3,'',`${n.description} · ${n.category} · ${amount(n.amount)}\n${n.converted_expense_id?'Already accounted':'Note only'}${n.notes?` · ${n.notes}`:''}`));
 if(kind==='Daily Cash Closing')data.closings.filter(c=>inside(c.closing_date)).forEach(c=>{
  const received=sum(data.payments.filter(p=>p.payment_date===c.closing_date&&p.payment_method==='Cash'),p=>p.amount);
  const spent=sum(data.expenses.filter(e=>e.expense_date===c.closing_date&&e.payment_method==='Cash'),e=>e.amount);
  const expected=Number(c.opening_cash)+received-spent;
  entry(c.closing_date,0,'',`Opening ${amount(c.opening_cash)} · Expected ${amount(expected)}\nActual ${amount(c.actual_closing_cash)} · Difference ${amount(Number(c.actual_closing_cash)-expected)}${c.notes?`\n${c.notes}`:''}`,[0,0,0],received,spent);
 });
 entries.sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order);
 function styleRow(rowNumber:number,bold=false){
  const row=ws.getRow(rowNumber);
  const description=String(row.getCell(7).value??'');
  const lines=description.split('\n').reduce((count,line)=>count+Math.max(1,Math.ceil(line.length/44)),0);
  row.height=Math.max(36,lines*15+12);
  for(let col=1;col<=9;col++){
   const cell=row.getCell(col);cell.font={name:'Arial',size:10,bold,color:{argb:palette.ink}};
   cell.alignment={vertical:'middle',horizontal:col<=2?'center':col===3||col===7?'left':'right',wrapText:col===3||col===7,indent:col<=2?0:1};
   cell.border={top:{style:'thin',color:{argb:palette.line}},bottom:{style:'thin',color:{argb:palette.line}},left:{style:'thin',color:{argb:palette.line}},right:{style:'thin',color:{argb:palette.line}}};
   if([4,5,6,8,9].includes(col))cell.numFmt=currency;
   if(col===1)cell.numFmt='dd mmm yyyy';
  }
 }
 entries.forEach((e,i)=>{ws.getRow(5+i).values=e.values;styleRow(5+i);});
 let lastRow=4+entries.length;
 if(entries.length){
  const total=++lastRow;styleRow(total,true);ws.getRow(total).height=32;ws.getCell(total,1).value='TOTAL';
  [4,5,6,8,9].forEach(col=>{const letter=ws.getColumn(col).letter;ws.getCell(total,col).value=formula(`SUM(${letter}5:${letter}${total-1})`,sum(entries,e=>Number(e.values[col-1])||0));});
  ws.getCell(total,7).value=formula(`SUM(D${total}:F${total})`,sum(entries,e=>sum([4,5,6],col=>Number(e.values[col-1])||0)));
  ws.getCell(total,7).numFmt=currency;
  ws.getCell(total,7).alignment={horizontal:'right',vertical:'middle',indent:1};
  ws.getCell(total,7).note='Total room sales. Credit and Debit contain cash only; UPI and Bank amounts are recorded in the description.';
 }else{lastRow=5;ws.mergeCells('A5:I5');ws.getCell('A5').value='No records in this period';ws.getCell('A5').font={name:'Arial',size:10,color:{argb:palette.ink}};ws.getCell('A5').alignment={horizontal:'center',vertical:'middle'};}
 ws.pageSetup.printArea=`A1:I${lastRow}`;
 return wb;
}

export function workbookFilename(data:ResortData,kind:string,from:string,to:string){
 const name=(data.resort?.resort_name||'Green Valley Resort').replace(/[^a-zA-Z0-9 -]/g,'').trim().replace(/\s+/g,'-')||'Resort';
 return `${name}-${kind.replaceAll(' ','-')}-${from||'All'}-${to||'Records'}.xlsx`;
}
