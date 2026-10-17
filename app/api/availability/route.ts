import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { BOOKING_DAYS_AHEAD, CLOSE_MINUTES, localDateString, OPEN_MINUTES, SLOT_MINUTES, datePlusDays, weekdayForDate, casablancaLocalToUtc } from '@/lib/schedule';

export async function GET(req:NextRequest){
 try {
  const date=req.nextUrl.searchParams.get('date');
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return NextResponse.json({error:'تاريخ غير صالح'}, {status:400});
  const today=localDateString(new Date()); if(date<today||date>datePlusDays(today,BOOKING_DAYS_AHEAD))return NextResponse.json({error:'يمكن الحجز خلال الأيام السبعة القادمة فقط'}, {status:400});
  const {data:exception,error:exErr}=await supabase.from('date_exceptions').select('*').eq('date',date).maybeSingle(); if(exErr)throw exErr;
  let isOpen=false, start='10:00', end='22:00';
  if(exception){isOpen=exception.is_open;start=exception.start_time?.slice(0,5)||start;end=exception.end_time?.slice(0,5)||end;}
  else {const {data:weekly,error}=await supabase.from('weekly_availability').select('*').eq('weekday',weekdayForDate(date)).maybeSingle();if(error)throw error;isOpen=!!weekly?.is_open;start=weekly?.start_time?.slice(0,5)||start;end=weekly?.end_time?.slice(0,5)||end;}
  if(!isOpen)return NextResponse.json({slots:[]});
  const toMin=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3,5)); const from=toMin(start),to=toMin(end); if(to<=from||from<OPEN_MINUTES||to>CLOSE_MINUTES)return NextResponse.json({error:'إعداد ساعات العمل غير صالح'}, {status:500});
  const dayStart=casablancaLocalToUtc(date,'00:00'); const nextDay=casablancaLocalToUtc(datePlusDays(date,1),'00:00');
  const {data:bookings,error}=await supabase.from('appointments').select('start_at,end_at').eq('status','confirmed').gte('start_at',dayStart).lt('start_at',nextDay);if(error)throw error;
  const occupied=new Set((bookings||[]).map(b=>new Date(b.start_at).toISOString())); const slots=[];
  for(let m=from;m+SLOT_MINUTES<=to;m+=SLOT_MINUTES){const hh=String(Math.floor(m/60)).padStart(2,'0'),mm=String(m%60).padStart(2,'0'),time=`${hh}:${mm}`,utc=casablancaLocalToUtc(date,time);slots.push({time,available:!occupied.has(new Date(utc).toISOString())});}
  return NextResponse.json({slots});
 }catch(e){console.error('availability error',e);return NextResponse.json({error:'تعذر تحميل الأوقات المتاحة'}, {status:500});}
}
