"use client";
import {useEffect,useState} from "react";
import {createClient} from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
export default function DrawingIdAuth({inline=false}){
 const [user,setUser]=useState({email:"",logged:false});
 const [open,setOpen]=useState(false),[mode,setMode]=useState("login"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!db)return;
  let alive=true;
  db.auth.getUser().then(({data,error})=>{if(alive)setUser({email:error?"":data.user?.email||"",logged:!error&&!!data.user});}).catch(()=>{});
  const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>{if(alive)setUser({email:session?.user?.email||"",logged:!!session?.user});});
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{if(!open)return;const listener=(event: KeyboardEvent)=>{if(event.key==="Escape"&&!busy)setOpen(false)};document.addEventListener("keydown",listener);return()=>document.removeEventListener("keydown",listener)},[open,busy]);
 async function logout(){if(!db||busy)return;setBusy(true);try{const {error}=await db.auth.signOut({scope:"local"});if(error)throw error;setUser({email:"",logged:false});setOpen(false);}catch{setMessage("로그아웃에 실패했어요.");}finally{setBusy(false)}}
 return <div className={inline?"di-root di-inline":"di-root"}>
  <button type="button" className="di-open" onClick={()=>{setOpen(true);setMessage("")}}>👤 {user.logged?"내 Drawing ID":"Drawing ID 로그인"}</button>
  {open&&<div className="di-shade" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}>
   <section className="di-card" role="dialog" aria-modal="true" aria-labelledby="di-title">
    <button type="button" className="di-close" onClick={()=>setOpen(false)} disabled={busy} aria-label="닫기">×</button>
    <div className="di-logo">D.</div><h2 id="di-title">Drawing ID</h2><p className="di-note">하나의 계정으로 모든 Drawing 서비스를 이용하세요.</p>
    {!db?<p className="di-msg">인증 서버 연결이 설정되지 않았어요. 운영자에게 문의해 주세요.</p>
    :user.logged?<div className="di-account"><strong>✅ 로그인 완료</strong><p>{user.email||"Drawing ID"}</p><button type="button" onClick={logout} disabled={busy} className="di-submit">이 서비스에서 로그아웃</button></div>
    :<><div className="di-tabs">
      <button type="button" className={mode==="login"?"active":""} onClick={()=>{setMode("login");setMessage("")}}>로그인</button>
      <button type="button" className={mode==="signup"?"active":""} onClick={()=>{setMode("signup");setMessage("")}}>회원가입</button>
     </div><form className="di-form" onSubmit={async e=>{
       e.preventDefault();if(!db||busy)return;
       if(mode==="signup"&&password.length<8){setMessage("새 비밀번호는 8자 이상 입력해 주세요.");return;}
       setBusy(true);setMessage("");
       try{
        if(mode==="login"){const {data,error}=await db.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;if(data.user){setUser({email:data.user.email||"",logged:true});setPassword("");setOpen(false)}}
        else{const {data,error}=await db.auth.signUp({email:email.trim(),password});if(error)throw error;setPassword("");if(data.session&&data.user){setUser({email:data.user.email||"",logged:true});setOpen(false)}else setMessage("가입 요청이 접수됐어요. 필요하다면 인증 이메일을 확인해 주세요.");}
       }catch(error){const m=error instanceof Error?error.message:"";setMessage(m.includes("Invalid login credentials")?"이메일 또는 비밀번호가 잘못되었습니다.":m||"로그인에 실패했어요.");}finally{setBusy(false)}
      }}>
       <label htmlFor="di-email">이메일</label><input id="di-email" type="email" autoComplete="email" value={email} maxLength={254} onChange={e=>setEmail(e.target.value)} required placeholder="name@example.com"/>
       <label htmlFor="di-pass">비밀번호</label><input id="di-pass" type="password" autoComplete={mode==="login"?"current-password":"new-password"} minLength={mode==="signup"?8:undefined} value={password} onChange={e=>setPassword(e.target.value)} required/>
       {message&&<p className="di-msg" role="status">{message}</p>}
       <button className="di-submit" type="submit" disabled={busy}>{busy?"처리 중…":mode==="login"?"로그인":"Drawing ID 생성"}</button>
      </form></>}
    {user.logged&&message&&<p className="di-msg" role="status">{message}</p>}
    <p className="di-foot">기존 Drawing Verse 계정이 그대로 사용됩니다. 다른 사이트는 같은 계정으로 각각 로그인해야 해요.</p>
   </section>
  </div>}
 </div>
}