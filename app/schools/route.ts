import { schoolPage } from '@/lib/school-pages.mjs';
import { validSchoolCode } from '@/lib/school-policy.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const code=new URL(request.url).searchParams.get('code')?.trim().toLowerCase();
  if(code&&validSchoolCode(code))return new Response(null,{status:303,headers:{Location:`/schools/${code}`,'Cache-Control':'no-store'}});
  return new Response(schoolPage(null,!!code),{status:code?400:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
