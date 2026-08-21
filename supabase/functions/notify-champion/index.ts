import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async request => {
  if(request.method === 'OPTIONS')return new Response('ok',{headers:corsHeaders});
  try{
    const { scoreId } = await request.json();
    if(!Number.isInteger(scoreId))return new Response('invalid score',{status:400,headers:corsHeaders});
    const supabase=createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data:score,error:scoreError }=await supabase.from('todays_champion_scores')
      .select('id,day,name,character_id,ms').eq('id',scoreId).maybeSingle();
    if(scoreError||!score)return new Response('score not found',{status:404,headers:corsHeaders});
    const { data:leader,error:leaderError }=await supabase.from('todays_champion_scores')
      .select('id').eq('day',score.day).order('ms',{ascending:true}).order('created_at',{ascending:true}).limit(1).maybeSingle();
    if(leaderError||leader?.id!==score.id)return new Response('not champion',{headers:corsHeaders});

    // 同じ記録のリトライ通知を防いでからDiscordへ送る。
    const { error:claimError }=await supabase.from('todays_champion_notices').insert({score_id:score.id,day:score.day});
    if(claimError?.code==='23505')return new Response('already notified',{headers:corsHeaders});
    if(claimError)throw claimError;

    const webhook=Deno.env.get('DISCORD_WEBHOOK_URL');
    if(!webhook)throw new Error('DISCORD_WEBHOOK_URL is not configured');
    const response=await fetch(webhook,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({content:`🏆 **本日の最強 決定！**\n${score.name} — **${score.ms}ms**\n使用キャラ: ${score.character_id.toUpperCase()}`})
    });
    if(!response.ok)throw new Error(`Discord webhook failed: ${response.status}`);
    return new Response('notified',{headers:corsHeaders});
  }catch(error){
    console.error(error);
    return new Response('notification failed',{status:500,headers:corsHeaders});
  }
});
