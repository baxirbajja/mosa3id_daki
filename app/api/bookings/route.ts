import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { BOOKING_DAYS_AHEAD, CLOSE_MINUTES, localDateString, OPEN_MINUTES, SLOT_MINUTES, datePlusDays, weekdayForDate, casablancaLocalToUtc } from '@/lib/schedule';

const schema=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^(?:[01]\d|2[0-3]):00$/),name:z.string().trim().min(2).max(100),phone:z.string().trim().regex(/^[+0-9 ()-]{8,20}$/)});
export async function POST(req:NextRequest){
 try{
  const parsed=schema.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:'تحقق من الاسم ورقم الهاتف والتاريخ والوقت'}, {status:400});const {date,time,name,phone}=parsed.data;
  const today=localDateString(new Date());if(date<today||date>datePlusDays(today,BOOKING_DAYS_AHEAD))return NextResponse.json({error:'يمكن الحجز خلال الأيام السبعة القادمة فقط'}, {status:400});
  const {data:exception,error:exErr}=await supabase.from('date_exceptions').select('*').eq('date',date).maybeSingle();if(exErr)throw exErr;
  let isOpen=false,start='10:00',end='22:00';if(exception){isOpen=exception.is_open;start=exception.start_time?.slice(0,5)||start;end=exception.end_time?.slice(0,5)||end;}else{const {data:weekly,error}=await supabase.from('weekly_availability').select('*').eq('weekday',weekdayForDate(date)).maybeSingle();if(error)throw error;isOpen=!!weekly?.is_open;start=weekly?.start_time?.slice(0,5)||start;end=weekly?.end_time?.slice(0,5)||end;}
  const minutes=Number(time.slice(0,2))*60;if(!isOpen||minutes<Number(start.slice(0,2))*60+Number(start.slice(3,5))||minutes+SLOT_MINUTES>Number(end.slice(0,2))*60+Number(end.slice(3,5))||minutes<OPEN_MINUTES||minutes+SLOT_MINUTES>CLOSE_MINUTES)return NextResponse.json({error:'هذا الوقت خارج ساعات العمل المتاحة'}, {status:400});
  const startAt=casablancaLocalToUtc(date,time),endAt=new Date(new Date(startAt).getTime()+SLOT_MINUTES*60_000).toISOString();if(new Date(startAt)<=new Date())return NextResponse.json({error:'لا يمكن حجز موعد في الماضي'}, {status:400});
  const reference=randomBytes(5).toString('hex').toUpperCase();const {data,error}=await supabase.from('appointments').insert({reference,customer_name:name,customer_phone:phone,start_at:startAt,end_at:endAt,status:'confirmed'}).select('reference,start_at,end_at,status').single();
  if(error){if(error.code==='23P01'||error.code==='23505')return NextResponse.json({error:'عذراً، حُجز هذا الوقت للتو. اختر وقتاً آخر.'},{status:409});throw error;}
  return NextResponse.json({booking:data}, {status:201});
 }catch(e){console.error('booking error',e);return NextResponse.json({error:'تعذر إتمام الحجز حالياً. حاول مرة أخرى.'},{status:500});}
}
