import {afterEach,describe,expect,it,vi} from 'vitest';
import {emptyData} from '@/features/resort/accounting';

const mocks=vi.hoisted(()=>({read:vi.fn(),build:vi.fn(),filename:vi.fn(),write:vi.fn()}));
vi.mock('@/features/resort/data.functions',()=>({getResortData:mocks.read}));
vi.mock('@/features/resort/export-workbook',()=>({buildWorkbook:mocks.build,workbookFilename:mocks.filename}));
import {downloadWorkbook} from '@/features/resort/export';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});
describe('Excel reads saved records before downloading',()=>{
 it('waits for current owner data instead of exporting the empty display fallback',async()=>{
  vi.useFakeTimers({toFake:['setTimeout']});
  const fresh={...emptyData,expenses:[{id:'e',resort_id:'r',expense_date:'2026-11-22',expense_name:'Electricity',category:'Electricity',amount:300,payment_method:'Cash',notes:'',created_at:'',updated_at:''}]};
  let resolveRead:((value:typeof fresh)=>void)|undefined;
  mocks.read.mockReturnValue(new Promise<typeof fresh>(resolve=>{resolveRead=resolve;}));
  const actual=await vi.importActual<typeof import('@/features/resort/export-workbook')>('@/features/resort/export-workbook');
  mocks.build.mockResolvedValue(await actual.buildWorkbook(fresh,'Complete Report','',''));
  mocks.filename.mockReturnValue('report.xlsx');
  vi.stubGlobal('URL',{createObjectURL:vi.fn(()=> 'blob:report'),revokeObjectURL:vi.fn()});
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  const download=downloadWorkbook(emptyData,'Complete Report','','');
  expect(mocks.build).not.toHaveBeenCalled();
  if(!resolveRead)throw new Error('Read did not start');
  resolveRead(fresh);
  await download;
  expect(mocks.build).toHaveBeenCalledWith(fresh,'Complete Report','','');
  expect(mocks.build.mock.calls[0]?.[0].expenses[0]?.amount).toBe(300);
  expect(mocks.filename).toHaveBeenCalledWith(fresh,'Complete Report','','');
  expect(URL.createObjectURL).toHaveBeenCalledOnce();
 });
 it('does not download an empty fallback if the saved-record read fails',async()=>{
  mocks.read.mockRejectedValue(new Error('Unable to read saved records'));
  await expect(downloadWorkbook(emptyData,'Complete Report','','')).rejects.toThrow('Unable to read saved records');
  expect(mocks.build).not.toHaveBeenCalled();
 });
 it('blocks a failed total check before file serialization or download',async()=>{
  const actual=await vi.importActual<typeof import('@/features/resort/export-workbook')>('@/features/resort/export-workbook');
  const data={...emptyData,expenses:[{id:'e',resort_id:'r',expense_date:'2026-11-22',expense_name:'Electricity',category:'Electricity',amount:300,payment_method:'Cash',notes:'',created_at:'',updated_at:''}]};
  const workbook=await actual.buildWorkbook(data,'Complete Report','','');
  const sheet=workbook.worksheets[0];if(!sheet)throw new Error('Missing sheet');
  sheet.getCell('I6').value={formula:'SUM(I5:I5)',result:301};
  const write=vi.spyOn(workbook.xlsx,'writeBuffer');
  const create=vi.fn();vi.stubGlobal('URL',{createObjectURL:create});
  mocks.read.mockResolvedValue(data);mocks.build.mockResolvedValue(workbook);
  await expect(downloadWorkbook(emptyData,'Complete Report','','')).rejects.toThrow('Excel check failed');
  expect(write).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
 });
 it('blocks a file that fails the post-serialization check',async()=>{
  const actual=await vi.importActual<typeof import('@/features/resort/export-workbook')>('@/features/resort/export-workbook');
  const workbook=await actual.buildWorkbook(emptyData,'Complete Report','','');
  const corrupted=await actual.buildWorkbook(emptyData,'Complete Report','','');
  const sheet=corrupted.worksheets[0];if(!sheet)throw new Error('Missing sheet');
  sheet.getCell('A1').alignment={horizontal:'left',vertical:'middle'};
  const bytes=await corrupted.xlsx.writeBuffer();
  vi.spyOn(workbook.xlsx,'writeBuffer').mockResolvedValue(bytes);
  const create=vi.fn();vi.stubGlobal('URL',{createObjectURL:create});
  mocks.read.mockResolvedValue(emptyData);mocks.build.mockResolvedValue(workbook);
  await expect(downloadWorkbook(emptyData,'Complete Report','','')).rejects.toThrow('misaligned');
  expect(create).not.toHaveBeenCalled();
 });
});