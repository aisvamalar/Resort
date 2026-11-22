import {cloneElement,isValidElement,useId,type ReactNode,type ReactElement} from 'react';
import {Inbox,ArrowUpRight,type LucideIcon} from 'lucide-react';
import {Button} from '@/components/ui/button';
export function Field({label,children,full=false}:{label:string;children:ReactNode;full?:boolean}) {const id=useId();return <div className={`field ${full?'full':''}`}><label htmlFor={id}>{label}</label>{isValidElement(children)?cloneElement(children as ReactElement<{id?:string}>,{id}):children}</div>;}
export function Select({options,...props}:{options:string[]}&React.SelectHTMLAttributes<HTMLSelectElement>) {return <select {...props}>{options.map(o=><option key={o}>{o}</option>)}</select>;}
export function Metric({label,value,note,icon:Icon,featured=false}:{label:string;value:string|number;note:string;icon:LucideIcon;featured?:boolean}) {return <div className={`metric ${featured?'featured':''}`}><div className="metric-label">{label}<span className="metric-icon"><Icon size={15}/></span></div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>;}
export function Panel({title,subtitle,action,children}:{title:string;subtitle?:string;action?:ReactNode;children:ReactNode}) {return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>;}
export function Empty({message='No records yet',action}:{message?:string;action?:ReactNode}) {return <div className="empty-state"><Inbox size={27}/><p>{message}</p>{action&&<div className="mt-4">{action}</div>}</div>;}
export function Status({value}:{value:string}) {return <span className={`status-badge ${value.toLowerCase().replaceAll(' ','-')}`}>{value}</span>;}
export function Initial({name}:{name:string}) {return <span className="avatar-initial">{name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()||'MR'}</span>;}
export function ViewAction({onClick}:{onClick:()=>void}) {return <Button variant="link" size="sm" onClick={onClick}>View all<ArrowUpRight size={12}/></Button>;}
export function PageHeading({title,description,children}:{title:string;description:string;children?:ReactNode}) {return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="heading-actions flex gap-2 items-center">{children}</div></div>;}
