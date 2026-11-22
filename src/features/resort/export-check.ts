import type {Workbook} from 'exceljs';
import {format,isValid,parseISO} from 'date-fns';
import type {ResortData} from './accounting';

type ExpectedRow={date:string;amounts:number[]};
const moneyColumns=[4,5,6,8,9];
function fail(detail:string):never {
 throw new Error(`Excel check failed: ${detail}. Please correct the report and try again.`);
}
function validDate(value:string,label:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!isValid(parseISO(value))||format(parseISO(value),'yyyy-MM-dd')!==value)fail(`${label} has an invalid date`);
}

/** Independent reconciliation against saved records, not the workbook's cached totals. */
function expectedRows(data:ResortData,kind:string,from:string,to:string):ExpectedRow[] {
 if(from)validDate(from,'Start date');
 if(to)validDate(to,'End date');
 if(from&&to&&from>to)fail('end date is before start date');
 const complete=['Complete Report','Dashboard Summary'].includes(kind);
 const source=kind==='OTA Sales'?'OTA':kind==='Website Sales'?'Website':kind==='Walk-in Sales'?'Walk-in':null;
 const bookings=data.reservations.filter(r=>!source||(r.booking_source===source&&r.status!=='Cancelled'));
 const rows:ExpectedRow[]=[];
 const add=(date:string,amounts:number[])=>{
  validDate(date,'Record');
  if(amounts.some(amount=>!Number.isFinite(amount)))fail('a record has an invalid amount');
  if((!from||date>=from)&&(!to||date<=to))rows.push({date,amounts});
 };
 if(complete||source||['Room Bookings','Owner Excel Report','Booking Details'].includes(kind))for(const r of bookings){
  if(!['OTA','Website','Walk-in'].includes(r.booking_source))fail('a booking has an unknown sales source');
  const rent=r.status==='Cancelled'?0:Number(r.room_rent);
  add(r.booking_date,[r.booking_source==='OTA'?rent:0,r.booking_source==='Website'?rent:0,r.booking_source==='Walk-in'?rent:0,0,0]);
 }
 if(complete||source||kind==='Payment History')for(const p of data.payments){
  if(source&&!bookings.some(r=>r.id===p.reservation_id))continue;
  if(!Number.isFinite(Number(p.amount)))fail('a receipt has an invalid amount');
  add(p.payment_date,[0,0,0,p.payment_method==='Cash'?Number(p.amount):0,0]);
 }
 if(complete||['Expenses','Cash Expenses'].includes(kind))for(const e of data.expenses){
  if(kind==='Cash Expenses'&&e.payment_method!=='Cash')continue;
  if(!Number.isFinite(Number(e.amount)))fail('an expense has an invalid amount');
  add(e.expense_date,[0,0,0,0,e.payment_method==='Cash'?Number(e.amount):0]);
 }
 if(kind==='Expense Notepad')for(const n of data.expenseNotes??[])add(n.note_date,[0,0,0,0,0]);
 if(kind==='Daily Cash Closing')for(const c of data.closings){
  const credit=data.payments.filter(p=>p.payment_date===c.closing_date&&p.payment_method==='Cash').reduce((total,p)=>total+Number(p.amount),0);
  const debit=data.expenses.filter(e=>e.expense_date===c.closing_date&&e.payment_method==='Cash').reduce((total,e)=>total+Number(e.amount),0);
  add(c.closing_date,[0,0,0,credit,debit]);
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date));
}

export function checkExportDates(data:ResortData,kind:string,from:string,to:string) {
 expectedRows(data,kind,from,to);
}

/** Throws before any download is created when dates, accounting or layout are unsafe. */
export function checkWorkbook(workbook:Workbook,data:ResortData,kind:string,from:string,to:string):void {
 const rows=expectedRows(data,kind,from,to);
 const ws=workbook.worksheets[0];
 if(workbook.worksheets.length!==1||!ws||ws.state!=='visible')fail('the single report sheet is missing');
 const alignment=(row:number,col:number,horizontal:string,wrap=false)=>{
  const a=ws.getCell(row,col).alignment;
  if(a.horizontal!==horizontal||a.vertical!=='middle'||(wrap&&!a.wrapText))fail(`cell ${ws.getCell(row,col).address} is misaligned`);
 };
 alignment(1,1,'center');alignment(2,1,'center');
 for(let row=3;row<=4;row++)for(let col=1;col<=9;col++)alignment(row,col,'center',true);
 if(ws.rowCount!==(rows.length?rows.length+5:5))fail('the record count does not match saved records');
 if(!rows.length){
  if(ws.getCell('A5').value!=='No records in this period')fail('the empty report is inconsistent');
  alignment(5,1,'center');return;
 }
 const actualTotals=[0,0,0,0,0];
 const expectedTotals=moneyColumns.map((_,index)=>rows.reduce((total,row)=>total+(row.amounts[index]??0),0));
 // Match each date's financial entries too: equal grand totals must not hide wrong dates.
 const remaining=rows.map(row=>({...row,amounts:[...row.amounts]}));
 let previous='';
 for(let row=5;row<rows.length+5;row++){
  const date=ws.getCell(row,1).value;
  if(!(date instanceof Date)||!isValid(date)||ws.getCell(row,1).numFmt!=='dd mmm yyyy')fail(`row ${row} has an invalid Excel date`);
  const day=format(date,'yyyy-MM-dd');
  if(day<previous|| (from&&day<from)|| (to&&day>to))fail(`row ${row} is outside the period or date order`);
  previous=day;
  const amounts=moneyColumns.map((col,index)=>{
   const value=ws.getCell(row,col).value;
   if(typeof value!=='number'||!Number.isFinite(value))fail(`row ${row} has an invalid amount`);
   actualTotals[index]=(actualTotals[index]??0)+value;
   return value;
  });
  const match=remaining.findIndex(entry=>entry.date===day&&entry.amounts.every((value,index)=>Math.abs(value-(amounts[index]??0))<0.000001));
  if(match<0)fail(`row ${row} does not match the saved date and amounts`);
  remaining.splice(match,1);
  for(let col=1;col<=9;col++)alignment(row,col,col<=2?'center':col===3||col===7?'left':'right',col===3||col===7);
 }
 const totalRow=rows.length+5;
 if(ws.getCell(totalRow,1).value!=='TOTAL')fail('the total row is missing');
 for(let col=1;col<=9;col++)alignment(totalRow,col,col<=2?'center':col===3?'left':'right',col===3);
 moneyColumns.forEach((col,index)=>{
  const cell=ws.getCell(totalRow,col);
  const letter=ws.getColumn(col).letter;
  const expected=expectedTotals[index]??0;
  if(cell.formula!==`SUM(${letter}5:${letter}${totalRow-1})`||typeof cell.result!=='number'||Math.abs(cell.result-expected)>0.000001||Math.abs((actualTotals[index]??0)-expected)>0.000001)fail(`the ${letter} total does not match saved records`);
 });
 const sales=expectedTotals.slice(0,3).reduce((total,value)=>total+value,0);
 const total=ws.getCell(totalRow,7);
 if(total.formula!==`SUM(D${totalRow}:F${totalRow})`||typeof total.result!=='number'||Math.abs(total.result-sales)>0.000001)fail('total room sales are incorrect');
}