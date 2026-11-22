import {describe,it,expect} from 'vitest';
import {parseISO} from 'date-fns';
import {buildWorkbook} from '@/features/resort/export-workbook';
import {checkWorkbook} from '@/features/resort/export-check';
import {emptyData,type Expense} from '@/features/resort/accounting';

const expense:Expense={id:'e',resort_id:'r',expense_date:'2026-11-22',expense_name:'Electricity',category:'Electricity',amount:300,payment_method:'Cash',notes:'',created_at:'',updated_at:''};
const data={...emptyData,expenses:[expense]};
const build=()=>buildWorkbook(data,'Complete Report','2026-11-22','2026-11-22');
function firstSheet(wb:Awaited<ReturnType<typeof build>>) {const ws=wb.worksheets[0];if(!ws)throw new Error('Missing sheet');return ws;}
const check=(wb:Awaited<ReturnType<typeof build>>)=>checkWorkbook(wb,data,'Complete Report','2026-11-22','2026-11-22');

describe('Excel pre-download checks',()=>{
 it('accepts a valid 300 cash debit before and after file serialization',async()=>{
  const wb=await build();expect(()=>check(wb)).not.toThrow();
  const {Workbook}=await import('exceljs');const restored=new Workbook();await restored.xlsx.load(await wb.xlsx.writeBuffer());
  expect(()=>check(restored)).not.toThrow();
 });
 it('rejects cached totals that do not equal saved amounts',async()=>{
  const wb=await build();firstSheet(wb).getCell('I6').value={formula:'SUM(I5:I5)',result:301};
  expect(()=>check(wb)).toThrow('I total');
 });
 it('rejects wrong formulas even if their cached totals are correct',async()=>{
  const wb=await build();firstSheet(wb).getCell('I6').value={formula:'SUM(I5:I6)',result:300};
  expect(()=>check(wb)).toThrow('I total');
 });
 it('rejects incorrect total sales',async()=>{
  const wb=await build();firstSheet(wb).getCell('G6').value={formula:'SUM(D6:F6)',result:300};
  expect(()=>check(wb)).toThrow('total room sales');
 });
 it('rejects a changed row amount even when its total is changed to match',async()=>{
  const wb=await build();const ws=firstSheet(wb);ws.getCell('I5').value=301;ws.getCell('I6').value={formula:'SUM(I5:I5)',result:301};
  expect(()=>check(wb)).toThrow('saved date and amounts');
 });
 it('rejects impossible calendar dates before generation',async()=>{
  await expect(buildWorkbook({...emptyData,expenses:[{...expense,expense_date:'2026-02-30'}]},'Complete Report','','')).rejects.toThrow('invalid date');
 });
 it('rejects invalid filter dates',async()=>{
  await expect(buildWorkbook(data,'Complete Report','2026-02-30','')).rejects.toThrow('invalid date');
 });
 it('rejects a record outside the requested period',async()=>{
  const wb=await build();firstSheet(wb).getCell('A5').value=parseISO('2026-11-21');
  expect(()=>check(wb)).toThrow('outside the period');
 });
 it('rejects dates changed inside the period while totals stay unchanged',async()=>{
  const wb=await buildWorkbook(data,'Complete Report','','');firstSheet(wb).getCell('A5').value=parseISO('2026-11-23');
  expect(()=>checkWorkbook(wb,data,'Complete Report','','')).toThrow('saved date and amounts');
 });
 it('rejects dates stored as plain text',async()=>{
  const wb=await build();firstSheet(wb).getCell('A5').value='2026-11-22';
  expect(()=>check(wb)).toThrow('invalid Excel date');
 });
 it.each(['A1','A3','A5','B5','C5','G5','I5','G6'])('blocks misaligned %s cells',async address=>{
  const wb=await build();firstSheet(wb).getCell(address).alignment={horizontal:'justify',vertical:'top'};
  expect(()=>check(wb)).toThrow('misaligned');
 });
 it('rejects a missing record',async()=>{
  const wb=await build();firstSheet(wb).spliceRows(5,1);
  expect(()=>check(wb)).toThrow('record count');
 });
 it('allows genuinely empty date ranges',async()=>{
  const wb=await buildWorkbook(data,'Complete Report','2026-11-23','2026-11-23');
  expect(()=>checkWorkbook(wb,data,'Complete Report','2026-11-23','2026-11-23')).not.toThrow();
 });
 it('rejects non-finite amounts',async()=>{
  await expect(buildWorkbook({...emptyData,expenses:[{...expense,amount:NaN}]},'Complete Report','','')).rejects.toThrow('invalid amount');
 });
});